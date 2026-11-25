// Registered read-only scheduling capability. No database, model, mutations or arbitrary tools.
const timetable=require('./timetableService');
const intervals=require('./scheduleIntervals');
const {createStore}=require('./programmeAdvisorState');
const state=createStore({ttl:15*60*1000,max:500});
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const canonicalLecturer=s=>normalize(s).replace(/^(mr|mrs|ms|dr|prof) /,'');
function snapshot(){const rows=timetable.getAll();return {rows,venues:[...new Set(rows.map(r=>r.venue_name).filter(Boolean))],lecturers:[...new Set(rows.map(r=>r.lecturer_name).filter(Boolean))],programmes:[...new Set(rows.map(r=>r.programme_code).filter(Boolean))]};}
const limitation='Based on the retained recurring teaching timetable (source links include 2025); current academic validity and complete booking coverage are unverified.';
function dayOf(text,now) {
 const explicit=DAYS.find(d=>new RegExp(`\\b${d}\\b`,'i').test(text));
 if(explicit)return explicit;
 if(/\b(today|tomorrow)\b/i.test(text)) {
  const local=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lusaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const d=new Date(`${local}T12:00:00Z`);if(/tomorrow/i.test(text))d.setUTCDate(d.getUTCDate()+1);
  return DAYS[(d.getUTCDay()+6)%7];
 }
 return null;
}
function buildPlan(question, previous=null, now=new Date()) {
 if(typeof question!=='string'||question.length>4000)return null;
 const {lecturers,programmes}=snapshot();
 if(/^(reset|start over|new topic)$/i.test(question.trim()))return {reset:true};
 const exactLecturer=lecturers.find(n=>canonicalLecturer(n)===canonicalLecturer(question));
 const namedLecturer=lecturers.find(n=>canonicalLecturer(n).split(' ').length>=2&&(' '+normalize(question)+' ').includes(' '+canonicalLecturer(n)+' '));
 const parsedSelection=require('./timetableQueryContext').parse(question);
 const cohortReply=previous?.kind==='student'&&(programmes.includes(question.trim().toUpperCase())||parsedSelection.explicit||parsedSelection.group||parsedSelection.mode);
 const entityFollow=previous&&/^(?:what about|how about|and)\b/i.test(question.trim())&&(/\broom\s*\d+|\b(?:dr|mr|mrs|prof)\b/i.test(question)||namedLecturer);
 const lecturerReply=previous?.kind==='lecturer'&&(Boolean(exactLecturer)||/^(?:dr|mr|mrs|ms|prof)\.?\s+[\w .'-]+[?!.]?$/i.test(question.trim()));
 const follow=cohortReply||lecturerReply||entityFollow||previous&&/^(?:(?:what about|and)(?:\s+on|\s+the)?\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|tomorrow|today|afternoon|morning)|is there (?:a |an )?(?:two.hour|\d+.hour) gap|(?:silverest|pioneer|leopards hill|knowledge field\s*[12]|business block)(?:[ .?!]|$)|(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|afternoon|morning)[ .?!]*$)/i.test(question.trim());
 const scheduling=/\b(free|available|availability|occupied|unscheduled|gap|gaps|break|breaks|fewest|fewer|back.to.back|last lecture|finish before|teaching|teaches|next (?:class|lecture)|no classes|no lectures|vacant|empty)\b/i.test(question);
 const entity=/\b(rooms?|lecturer|class(?:es)?|lectures?|timetable|my|mine|our)\b/i.test(question)||require('./timetableQueryContext').parse(question).explicit||lecturers.some(n=>normalize(question).includes(normalize(n)));
 if(!follow&&!(scheduling&&entity))return null;
 const plan=follow?{...previous}:{capability:'schedule.read',kind:/\brooms?\b/i.test(question)?'room':namedLecturer||/lecturer|\b(?:dr|mr|mrs|prof)\b/i.test(question)?'lecturer':'student'};
 if(exactLecturer&&lecturerReply)plan.lecturer=canonicalLecturer(exactLecturer);
 if(namedLecturer&&plan.kind==='lecturer')plan.lecturer=canonicalLecturer(namedLecturer);
 if(follow&&/\broom\s*\d+/i.test(question))plan.kind='room';else if(follow&&(/\b(?:dr|mr|mrs|prof)\b/i.test(question)||namedLecturer))plan.kind='lecturer';
 const day=dayOf(question,now);if(day)plan.day=day;
 const room=question.match(/\broom\s*0*(\d+)\b/i);if(room)plan.room=Number(room[1]);
 const campus=question.match(/\b(silverest|pioneer|leopards hill)\b/i);if(campus)plan.campus=campus[1].toLowerCase();
 const building=question.match(/knowledge field\s*[12]|business block|main block|new block/i);if(building)plan.building=normalize(building[0]);
 const mentioned=programmes.filter(p=>new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(question));
 if(mentioned.length===1)plan.programme=mentioned[0];
 if(plan.kind==='lecturer') {
  const name=question.match(/(?:dr|mr|mrs|ms|prof)\.?\s+(.+?)(?=\s+(?:free|available|teaching|have|on|tomorrow|today)|[?!]|$)/i);
  if(name)plan.lecturer=normalize(name[1]);
 }
 if(/next (?:class|lecture)/i.test(question)){
  plan.operation='next';plan.day=day||dayOf('today',now);
  const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lusaka',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);plan.at=intervals.parseTime(clock);
 }
 else if(/fewest|fewer|finish before/i.test(question)){plan.operation=/finish before/i.test(question)?'finishBefore':'loads';plan.day=null;}
 else if(/last lecture|last class/i.test(question))plan.operation='last';
 else if(/back.to.back/i.test(question))plan.operation='consecutive';
 else if(/occupied/i.test(question))plan.operation='occupancy';
 else if(/teaching|teaches/i.test(question))plan.operation='teaching';
 else if(/longest/i.test(question))plan.operation='longest';
 else if(!follow)plan.operation='gaps';
 const at=question.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
 if(at){const h=Number(at[1]),m=Number(at[2]||0);plan.at=h>=1&&h<=12&&m<60?(h%12+(at[3].toLowerCase()==='pm'?12:0))*60+m:null;}
 if(/afternoon/i.test(question))plan.window={start:720,end:1080}; // Explicit comparison period, never claimed as opening hours.
 if(/morning/i.test(question))plan.window={start:480,end:720};
 const range=question.match(/\b(?:from|between)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(?:to|and)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
 if(range){const start=intervals.parseClock(range[1]),end=intervals.parseClock(range[2]);if(start!==null&&end!==null&&end>start)plan.window={start,end};}
 const duration=question.match(/\b(one|two|three|four|\d{1,2})[- ]hour\s+gap\b/i);
 if(duration){plan.minimumGap=({one:1,two:2,three:3,four:4}[duration[1].toLowerCase()]||Number(duration[1]))*60;plan.operation='gaps';}
 if(/\bwhich rooms\b/i.test(question))plan.operation='rooms';
 if(/\bthis (?:afternoon|morning)\b/i.test(question)&&!plan.day)plan.day=dayOf('today',now);
 return require('./timetableQueryContext').apply(plan,question);
}
function resolve(plan,profile=null) {
 const {rows,venues,lecturers}=snapshot();
 if(plan.kind==='student')return require('./timetableQueryContext').resolve(plan,profile);
 if(plan.kind==='lecturer') {
  if(!plan.lecturer)return {matches:[],clarification:'Which lecturer do you mean?'};
  const query=canonicalLecturer(plan.lecturer),tokens=query.split(' ').filter(Boolean);
  const labels=lecturers.filter(n=>tokens.every(t=>canonicalLecturer(n).split(' ').includes(t)));
  const exact=labels.find(n=>canonicalLecturer(n)===query);
  // Collapse only literal punctuation/title variants and explicit co-teaching labels.
  // Shared lecturer codes alone are unsafe: retained codes sometimes name unrelated people.
  const names=[...new Map(labels.map(n=>[canonicalLecturer(n),n])).values()];
  const matches=exact?[exact]:names.filter(n=>!names.some(other=>other!==n&&(' '+canonicalLecturer(n)+' ').includes(' '+canonicalLecturer(other)+' ')));
  const records=matches.length===1?rows.filter(r=>(' '+canonicalLecturer(r.lecturer_name)+' ').includes(' '+canonicalLecturer(matches[0])+' ')):[];
  const codes=new Set(records.map(r=>r.lecturer_code).filter(Boolean));
  const conflictingAliases=rows.some(r=>codes.has(r.lecturer_code)&&r.lecturer_name&&!(' '+canonicalLecturer(r.lecturer_name)+' ').includes(' '+canonicalLecturer(matches[0])+' '));
  return {matches,records,identityWarning:conflictingAliases?'The matched lecturer code also has other name labels in this dataset; those unverified aliases were not merged.':''};
 }
 if(!plan.room)return {matches:[],clarification:'Which room number and campus do you mean?'};
 let matches=venues.filter(v=>new RegExp(`\\broom\\s*0*${plan.room}\\b`,'i').test(v));
 if(plan.campus)matches=matches.filter(v=>normalize(v).includes(plan.campus)||rows.some(r=>r.venue_name===v&&normalize(r.campus).includes(plan.campus)));
 if(plan.building)matches=matches.filter(v=>normalize(v).includes(plan.building));
 // Do not merge similar labels automatically: a repeated number can refer to another building.
 return {matches,records:matches.length===1?rows.filter(r=>r.venue_name===matches[0]):[]};
}
function execute(plan,profile=null) {
 if(plan.operation==='rooms')return compareRooms(plan);
 const r=resolve(plan,profile);
 const base={capability:'schedule.read',plan,status:'calculated',evidenceType:'deterministic_calculation',limitation};
 if(r.unavailable)return {...base,status:'unavailable',answer:r.unavailable};
 if(r.clarification)return {...base,status:'clarification',answer:r.clarification};
 if(r.matches.length!==1)return {...base,candidates:r.matches,status:r.matches.length?'clarification':'unavailable',answer:r.matches.length?`Which ${plan.kind} do you mean? ${r.matches.slice(0,8).join('; ')}${r.matches.length>8?'; more matches exist':''}. Please specify the campus/building or full name.`:`I cannot identify that ${plan.kind} in the retained teaching records. Please check the name, campus and building; absence does not establish availability.`};
 const label=r.matches[0];base.resolvedLabel=label;base.displayName=r.displayName||label;
 if(!plan.day&&!['loads','finishBefore','teaching'].includes(plan.operation))return {...base,status:'clarification',answer:`Which day should I check for ${label}?`};
 const days=plan.day?[plan.day]:DAYS;
 const summaries=days.map(day=>({day,...intervals.summarize(r.records.filter(x=>x.day===day),plan.window)}));
 const selected=r.records.filter(x=>days.includes(x.day));
 const provenance=selected.map(x=>({day:x.day,time:x.time,course_code:x.course_code,source_pages:x.source_pages}));
 const joinedEvidence=[];
 let answer;
 if(plan.operation==='next') {
  const candidates=selected.map(record=>({record,interval:intervals.parseInterval(record.time)})).filter(x=>x.interval&&x.interval.start>=(plan.at||0)).sort((a,b)=>a.interval.start-b.interval.start);
  const next=candidates.filter(x=>x.interval.start===candidates[0]?.interval.start);
  base.nextSessions=next.map(x=>x.record);
  answer=next.length?`Next recorded start after ${intervals.formatTime(plan.at||0)}: ${[...new Set(next.map(x=>`${x.record.course_code} at ${x.record.time} in ${x.record.venue_name||'an unspecified venue'}`))].join('; ')}.`:'No later class start is recorded in this day\'s retained timetable.';
  const distinctVenues=[...new Map(next.map(x=>[x.record.venue_name,x])).values()];
  for(const {record} of distinctVenues.slice(0,4)){
   if(!record.venue_name)continue;
   const matches=require('./locationSearchService').findAllMatches(record.venue_name,{limit:4});
   // Match only a named building phrase from the source venue, never a guessed room centroid.
   const precise=matches.filter(m=>m.matchedAlias&&normalize(m.matchedAlias).split(' ').length>=3&&normalize(record.venue_name).includes(normalize(m.matchedAlias)));
   if(precise.length===1){joinedEvidence.push({tool:'campus.search',venue:record.venue_name,placeId:precise[0].place.id||precise[0].place.osm_ref,name:precise[0].place.name});answer+=` Campus building match: ${precise[0].place.name}; exact room coordinates are not established.`;}
  }
 } else if(plan.operation==='loads'||plan.operation==='finishBefore') {
  const minimum=Math.min(...summaries.map(s=>s.classCount));
  answer=plan.operation==='finishBefore'?summaries.filter(s=>!s.invalidIntervals&&s.occupied.length&&s.occupied.at(-1).end<=720).map(s=>s.day).join(', ')||'No supported recorded teaching day finishes by noon':`Fewest recorded sessions: ${summaries.filter(s=>s.classCount===minimum).map(s=>s.day).join(', ')} (${minimum}). `+summaries.map(s=>`${s.day}: ${s.classCount} distinct recorded sessions${s.invalidIntervals?' (invalid time intervals)':''}`).join('; ')+'. Zero records do not establish complete coverage for that day.';
 } else {
  const s=summaries[0], times=s.occupied.map(intervals.formatInterval).join(', ')||'none';
  if(s.invalidIntervals)answer=`${s.invalidIntervals} record(s) have invalid or missing time boundaries; I cannot safely calculate unscheduled intervals. Valid recorded intervals: ${times}.`;
  else if(plan.operation==='occupancy')answer=plan.at==null?`Recorded teaching intervals: ${times}. Specify a valid time (for example at 11 AM) for an occupancy check.`:s.occupied.some(i=>i.start<=plan.at&&plan.at<i.end)?`A class is recorded at ${intervals.formatTime(plan.at)}.`:`No class is recorded at ${intervals.formatTime(plan.at)} in this scope.`;
  else if(plan.operation==='teaching')answer=`Recorded teaching intervals: ${times}.`;
  else if(plan.operation==='last')answer=s.occupied.length?`Last recorded class ends at ${intervals.formatTime(s.occupied.at(-1).end)}.`:'No classes recorded for this day; an end time cannot be established.';
  else if(plan.operation==='consecutive') {
   const uniq=[...new Map(selected.map(x=>[x.time,intervals.parseInterval(x.time)])).values()].filter(Boolean).sort((a,b)=>a.start-b.start);
   answer=uniq.some((x,i)=>uniq.slice(i+1).some(y=>x.end===y.start))?'Back-to-back recorded sessions are present.':'No back-to-back sessions were found in the retained records.';
  } else answer=`${plan.minimumGap?(s.gaps.some(g=>g.end-g.start>=plan.minimumGap)?'Yes, a gap meeting that duration is recorded. ':'No gap meeting that duration is supported in the comparison window. '):''}Recorded teaching: ${times}. ${plan.operation==='longest'?'Longest internal break: ':'No class recorded between: '}${(plan.operation==='longest'?(s.longestGap?[s.longestGap]:[]):s.gaps).map(intervals.formatInterval).join(', ')||'no calculable gaps'}. Comparison window: ${s.window?intervals.formatInterval(s.window):'not established'} (${s.windowSource}).`;
 }
 const caveat=plan.kind==='room'?'This does not confirm room booking availability.':plan.kind==='lecturer'?'This does not confirm consultation availability or absence of other duties.':'Cohort teaching records may include alternative course groups; this is not a verified personal enrolment schedule.';
 return {...base,displayName:r.displayName||label,resolvedLabel:label,sessions:selected,groupUnverified:r.groupUnverified,answer:`${label}${plan.day?' — '+plan.day:''}: ${answer}\n\n${caveat} ${r.identityWarning||''} ${limitation}`,summaries,provenance,joinedEvidence,recordCount:selected.length};
}
function compareRooms(plan){
 const base={capability:'schedule.read',plan,evidenceType:'deterministic_calculation',limitation};
 if(!plan.campus||!plan.day||!plan.window)return {...base,status:'clarification',answer:'Which campus, day and comparison time range should I use? You can specify, for example, Silverest on Monday from 12:00 to 17:00.'};
 const {rows,venues}=snapshot(),campus=normalize(plan.campus);
 const labels=venues.filter(v=>/\broom\b/i.test(v)&&(normalize(v).includes(campus)||rows.some(r=>r.venue_name===v&&normalize(r.campus).includes(campus))));
 if(!labels.length)return {...base,status:'unavailable',answer:'No individually identifiable room labels match that campus in the retained timetable. Please check the campus or building.'};
 const candidates=labels.filter(v=>{const records=rows.filter(r=>r.venue_name===v&&r.day===plan.day);const s=intervals.summarize(records,plan.window);return !s.invalidIntervals&&!intervals.merge(s.occupied,plan.window).length;});
 const missingVenues=rows.filter(r=>r.day===plan.day&&!r.venue_name).length;
 return {...base,status:'calculated',candidateVenueLabels:candidates,recordCount:rows.filter(r=>r.day===plan.day).length,provenance:[],summaries:[],answer:`No class is recorded from ${intervals.formatInterval(plan.window)} on ${plan.day} for ${candidates.length} matching source venue labels${candidates.length?': '+candidates.slice(0,8).join('; '):''}${candidates.length>8?'; additional labels omitted from this short answer':''}. This comparison window is not verified opening hours. These are timetable labels, not a verified inventory of distinct physical rooms. ${missingVenues} records for this day lack venues. This does not confirm room booking availability. ${limitation}`};
}
function validatePlan(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 if(Object.keys(value).some(k=>!['capability','kind','operation','room','campus','building','lecturer','programme','day','at','window','minimumGap'].includes(k)))return null;
 if(value.capability!=='schedule.read'||!['room','lecturer','student'].includes(value.kind)||!['gaps','longest','loads','consecutive','last','occupancy','teaching','finishBefore','next','rooms'].includes(value.operation))return null;
 if(value.day!=null&&!DAYS.includes(value.day))return null;
 if(value.room!=null&&(!Number.isInteger(value.room)||value.room<1||value.room>9999))return null;
 for(const key of ['campus','building','lecturer','programme'])if(value[key]!=null&&(typeof value[key]!=='string'||value[key].length>120))return null;
 if(value.at!=null&&(!Number.isInteger(value.at)||value.at<0||value.at>=1440))return null;
 if(value.minimumGap!=null&&(!Number.isInteger(value.minimumGap)||value.minimumGap<=0||value.minimumGap>1440))return null;
 if(value.window!=null&&(!Number.isInteger(value.window.start)||!Number.isInteger(value.window.end)||value.window.start<0||value.window.end>1440||value.window.end<=value.window.start))return null;
 return structuredClone(value);
}
function response(plan,sessionId,profile=null){
 const schedule=execute(plan,profile);state.set(sessionId,plan);
 return {answer:schedule.answer,schedule,queryType:{isTimetable:true,isKnowledge:false,entities:{...plan,programmeFamily:plan.selection?.family,year:plan.selection?.year,semester:plan.selection?.semester}},sources:[{source_file:'data/timetable/timetable.json',title:'Retained recurring teaching timetable; current validity unverified'}],resources:[],recommendedResources:[],timetableMatches:schedule.recordCount||0,suggestedActions:[]};
}
function tryAnswer(question,sessionId,now=new Date(),history=[],profile=null) {
 const previous=state.get(sessionId), plan=buildPlan(question,previous,now);
 if(!plan||plan.reset){state.clear(sessionId);return null;}
 if(plan.kind==='student'&&!plan.programme){
  // Only an explicit cohort selected in the latest user turn is a selection;
  // assistant prose and profile guesses never establish a class group.
  const last=[...history].reverse().find(t=>t.role==='user');
  if(last&&/\b(timetable|schedule|classes|break)\b/i.test(last.content)){
   const {programmes}=snapshot();
   const matches=programmes.filter(p=>new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(last.content));
   if(matches.length===1)plan.programme=matches[0];
  }
 }
 require('./timetableQueryContext').apply(plan,question,profile);
 return response(plan,sessionId,profile);
}
function observeQuestion(question,sessionId){if(!buildPlan(question,state.get(sessionId)))state.clear(sessionId);}
function canHandle(question,sessionId){const plan=buildPlan(question,state.get(sessionId));return Boolean(plan&&!plan.reset);}
function rememberTimetable(question,sessionId,profile){const plan={capability:'schedule.read',kind:'student',operation:/next.*(?:class|lecture)/i.test(question)?'next':'teaching',day:dayOf(question)};require('./timetableQueryContext').apply(plan,question,profile);state.set(sessionId,plan);}
module.exports={buildPlan,execute,tryAnswer,dayOf,resolve,observeQuestion,validatePlan,response,canHandle,rememberTimetable};
