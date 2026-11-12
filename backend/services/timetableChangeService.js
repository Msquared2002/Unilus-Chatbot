const crypto=require('node:crypto');
const clean=v=>String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ').toUpperCase();
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fields=['day','time','venue_name','lecturer_name'];
const group=r=>clean(r.class_group).replace(/\s/g,'')||(clean(r.programme_name).match(/\b([A-Z]\d+)$/)?.[1]||'');
function normalize(records){
 if(!Array.isArray(records)||!records.length||records.length>200000)throw Error('A complete nonempty timetable is required');
 const normalized=records.map(r=>{
  const row={};for(const k of ['programme_code','class_group','course_code','course_variant','session_type','course_name',...fields])row[k]=clean(r[k]);
  row.programme_code=row.programme_code.replace(/\s/g,'');row.class_group=row.class_group.replace(/\s/g,'');
  row.class_group=group(r);row.course_group=clean(r.course_name).match(/\bGROUP\s+([A-Z](?:\d+)?)\b/)?.[1]||'';
  row.venue_name||=clean(r.venue_code);row.lecturer_name||=clean(r.lecturer_code);
  row.session_type||='LECTURE';row.time=row.time.replace(/\s/g,'').replace(/[–—]/g,'-').replace(/(^|-)(\d):/g,'$10$2:');
  if(!row.course_code||!['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'].includes(row.day))throw Error('Incomplete timetable course or day');
  const t=row.time.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if(!t||+t[1]>23||+t[3]>23||+t[2]>59||+t[4]>59||(+t[3]*60 + +t[4])<=(+t[1]*60 + +t[2]))throw Error('Invalid timetable time');
  return row;
 });
 return [...new Map(normalized.map(r=>[JSON.stringify(r),r])).values()].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
const scope=r=>JSON.stringify([r.programme_code,r.class_group]);
const key=r=>JSON.stringify([r.programme_code,r.class_group,r.course_group||'',r.course_code,r.course_variant,r.session_type]);
function compare(before,after){
 before=before.filter(r=>r.programme_code);after=after.filter(r=>r.programme_code);
 const groups=rows=>{const m=new Map();for(const r of rows){const k=key(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m;};
 const a=groups(before),b=groups(after),changes=[];
 for(const k of [...new Set([...a.keys(),...b.keys()])].sort()){
  let old=a.get(k)||[],next=b.get(k)||[];
  const equality=r=>JSON.stringify(fields.map(f=>r[f]));
  const common=new Set(old.filter(o=>next.some(n=>equality(o)===equality(n))).map(equality));
  old=old.filter(o=>!common.has(equality(o)));next=next.filter(n=>!common.has(equality(n)));
  if(old.length===1&&next.length===1){const changed=fields.filter(f=>old[0][f]!==next[0][f]);changes.push({kind:'modified',before:old[0],after:next[0],fields:changed,scope:scope(next[0])});}
  else{for(const r of old)changes.push({kind:'removed',before:r,after:null,fields:[],scope:scope(r)});for(const r of next)changes.push({kind:'added',before:null,after:r,fields:[],scope:scope(r)});}
 }
 return changes;
}
function describe(change){const r=change.after||change.before;const label=`${r.programme_code} ${r.course_code} ${r.session_type.toLowerCase()}`;
 if(change.kind==='removed')return `${label}: session removed from the published timetable (${r.day} ${r.time}). This does not confirm cancellation.`;
 if(change.kind==='added')return `${label}: new session listed on ${r.day} ${r.time}.`;
 return label+': '+change.fields.map(f=>`${({venue_name:'venue',lecturer_name:'lecturer'})[f]||f} changed from ${change.before[f]||'not listed'} to ${change.after[f]||'not listed'}`).join('; ')+'.';}
module.exports={normalize,compare,describe,scope,digest,group};
