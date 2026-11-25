// Public timetable selection, separate from immutable account/private-record identity.
const timetable=require('./timetableService');
const normalize=s=>String(s||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const escape=s=>String(s).replace(/[\\^$.*+?()[\]{}|]/g,'\\$&');
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
function dayOf(text,now=new Date()){const day=DAYS.find(d=>new RegExp('\\b'+d+'\\b','i').test(text));if(day)return day;if(!/\b(today|tomorrow|this morning|this afternoon)\b/i.test(text))return null;const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lusaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),d=new Date(date+'T12:00:00Z');if(/\btomorrow\b/i.test(text))d.setUTCDate(d.getUTCDate()+1);return DAYS[(d.getUTCDay()+6)%7];}
function descriptors(){const map=new Map();for(const r of timetable.getAll()){if(!r.programme_code)continue;const compact=r.programme_code.replace(/\s/g,''),m=compact.match(/^([A-Z][A-Z0-9_]*?)([1-9])([1-9])(?:-.*)?$/i)||compact.match(/^(.+?)_?\(([1-9]),([1-9])\)$/);if(!map.has(compact))map.set(compact,{code:r.programme_code,family:m?m[1].replace(/_$/,''):compact,year:Number(r.year)||Number(m?.[2])||null,semester:Number(r.semester)||Number(m?.[3])||null,mode:/-PT$/i.test(compact)?'PT':'FT',name:(r.programme_name||compact).replace(/\s+\d+(?:st|nd|rd|th)?\s*(?:yr|year).*$/i,'').trim()});}return [...map.values()];}
function parse(question){
 const ds=descriptors(),q=String(question||'').replace(/[’]/g,"'"),text=normalize(q),ord={first:1,second:2,third:3,fourth:4,fifth:5,sixth:6,seventh:7,eighth:8},stage=text.replace(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth)\b/g,w=>ord[w]);
 const year=Number(stage.match(/\b([1-8])(?:st|nd|rd|th)?\s*(?:year|yr)\b/)?.[1]||stage.match(/\b(?:year|yr)\s*([1-8])\b/)?.[1])||null,semester=Number(stage.match(/\b([12])(?:st|nd|rd|th)?\s*(?:semester|sem)\b/)?.[1]||stage.match(/\b(?:semester|sem)\s*([12])\b/)?.[1])||null;
 const exact=ds.filter(d=>new RegExp('\\b'+escape(d.code)+"(?=\\b|['’])",'i').test(q)),families=[...new Set(ds.map(d=>d.family))];
 let family=exact.length===1?exact[0].family:families.find(f=>new RegExp('\\b'+escape(f)+'\\b','i').test(q));
 if(!family){const noise=new Set(['bachelor','science','arts','master','doctor','diploma','programme','program','students','student','of','in','and','the','for','year','semester','my','our','class','classes','timetable','schedule']),words=text.split(' ').filter(w=>w.length>3&&!noise.has(w)&&ds.some(d=>normalize(d.name).split(' ').includes(w)));if(words.length){const fs=[...new Set(ds.filter(d=>words.every(w=>normalize(d.name).split(' ').includes(w))).map(d=>d.family))];if(fs.length===1)family=fs[0];}}
 return {explicit:Boolean(family||year||semester),family:family||null,programme:exact.length===1?exact[0].code:null,year:year||exact[0]?.year||null,semester:semester||exact[0]?.semester||null,group:q.match(/\b(?:class\s+)?group\s+([a-z]\d*)\b/i)?.[1].toUpperCase()||null,mode:/part[\s-]?time/i.test(q)?'PT':/full[\s-]?time/i.test(q)?'FT':null};
}
function apply(plan,question,profile=null){
 if(plan.kind!=='student')return plan;
 const selected=parse(question),ds=descriptors(),old=plan.selection||{};
 if(selected.explicit||selected.mode){
  const changedFamily=selected.family&&normalize(selected.family)!==normalize(old.family);
  const changedYear=selected.year&&selected.year!==old.year;
  delete plan.programme;if(selected.explicit)delete plan.personal;
  plan.selection={family:selected.family||old.family||profile?.programme||null,year:selected.year||old.year||null,semester:selected.semester||(!changedYear?old.semester:null)||null,group:selected.group||(!changedFamily&&!changedYear?old.group:null)||null,mode:selected.mode||(!changedFamily?old.mode:null)||null};
  if(selected.programme)plan.programme=selected.programme;
 }else if(!plan.programme&&!plan.selection&&profile){plan.selection={family:profile.timetableProgramme||profile.programme,year:profile.year,semester:profile.semester,group:profile.classGroup||profile.group||null,mode:profile.mode||null};plan.personal=true;}
 if(selected.group)plan.selection={...(plan.selection||{}),group:selected.group};
 const s=plan.selection;
 if(s&&!plan.programme){const candidates=ds.filter(d=>normalize(d.family)===normalize(s.family)&&d.year===s.year&&d.semester===s.semester&&(!s.mode||d.mode===s.mode));if(candidates.length===1)plan.programme=candidates[0].code;}
 return plan;
}
function resolve(plan,profile=null){const ds=descriptors(),s=plan.selection||{},family=s.family||ds.find(d=>d.code===plan.programme)?.family;
 if(!plan.programme){const matching=ds.filter(d=>normalize(d.family)===normalize(family)&&d.year===s.year&&d.semester===s.semester);if(matching.length>1&&!s.mode&&new Set(matching.map(d=>d.mode)).size>1)return {matches:[],clarification:'Are you studying full-time or part-time?'};if(!family)return {matches:[],clarification:'Which programme and year should I check?'};if(!s.year||!s.semester)return {matches:[],clarification:!s.year&&!s.semester?'Which year and semester should I check?':!s.year?'Which year should I check?':'Which semester should I check?'};return {matches:[],records:[],unavailable:'I don’t have a timetable for '+(ds.find(d=>normalize(d.family)===normalize(family))?.name||family)+', Year '+s.year+', Semester '+s.semester+'.'};}
 let rows=timetable.getByProgramme(plan.programme);if(plan.personal&&profile?.registeredCourses?.length)rows=rows.filter(r=>profile.registeredCourses.includes(r.course_code));
 if(plan.personal&&profile?.programme==='BCS'&&!profile.timetableProgramme)return {matches:[],clarification:'Your programme has conflicting timetable labels. Please confirm the programme name before I use those classes.'};
 const group=s.group||null,groups=[...new Set(rows.map(r=>r.class_group).filter(Boolean))];if(!group&&groups.length>1)return {matches:[],clarification:'Which class group are you in: '+groups.join(', ')+'?'};if(group)rows=rows.filter(r=>!r.class_group||r.class_group.toUpperCase()===group.toUpperCase());
 const d=ds.find(d=>d.code===plan.programme);return {matches:[plan.programme],records:rows,displayName:d?d.name+', Year '+d.year+', Semester '+d.semester:plan.programme,groupUnverified:!group&&rows.some(r=>r.programme_name?.match(/\b[A-Z]\d+$/))};}
module.exports={parse,apply,resolve,descriptors,dayOf,normalize};