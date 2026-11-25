// Minute-based half-open intervals. Pure operations shared by all timetable entities.
function parseTime(value) {
 const m=String(value||'').trim().match(/^(\d{1,2}):(\d{2})$/);
 if(!m)return null;
 const h=Number(m[1]),min=Number(m[2]);
 return h<=24&&min<60&&(h!==24||min===0)?h*60+min:null;
}
function parseInterval(value) {
 const p=String(value||'').split(/\s*[-–—]\s*/);
 if(p.length!==2)return null;
 const start=parseTime(p[0]),end=parseTime(p[1]);
 return start!==null&&end!==null&&end>start?{start,end}:null;
}
function parseClock(value) {
 const text=String(value||'').trim(),m=text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
 if(!m)return parseTime(text);
 const h=Number(m[1]),minute=Number(m[2]||0);
 return h>=1&&h<=12&&minute<60?(h%12+(m[3].toLowerCase()==='pm'?12:0))*60+minute:null;
}
function merge(intervals, window=null) {
 const sorted=intervals.filter(i=>i&&Number.isFinite(i.start)&&Number.isFinite(i.end)&&i.end>i.start)
  .map(i=>({start:window?Math.max(window.start,i.start):i.start,end:window?Math.min(window.end,i.end):i.end}))
  .filter(i=>i.end>i.start).sort((a,b)=>a.start-b.start||a.end-b.end);
 const result=[];
 for(const item of sorted){const last=result.at(-1);if(last&&item.start<=last.end)last.end=Math.max(last.end,item.end);else result.push({...item});}
 return result;
}
function gaps(intervals,window) {
 if(!window||!Number.isFinite(window.start)||!Number.isFinite(window.end)||window.end<=window.start)throw new Error('Explicit valid comparison window required');
 const result=[];let cursor=window.start;
 for(const i of merge(intervals,window)){if(i.start>cursor)result.push({start:cursor,end:i.start});cursor=i.end;}
 if(cursor<window.end)result.push({start:cursor,end:window.end});
 return result;
}
const formatTime = minutes => `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
const formatInterval = i => `${formatTime(i.start)}–${formatTime(i.end)}`;
function summarize(records,window=null) {
 const intervals=records.map(r=>parseInterval(r.time));
 const invalid=intervals.filter(i=>!i).length;
 const occupied=merge(intervals);
 // Without verified operating hours, only calculate internal gaps between first and last recorded classes.
 const scope=window||(occupied.length?{start:occupied[0].start,end:occupied.at(-1).end}:null);
 const breaks=!invalid&&scope&&scope.end>scope.start?gaps(intervals,scope):[];
 const unique=[...new Set(records.map(r=>[r.day,r.time,r.course_code,r.lecturer_code,r.venue_name].join('|')))];
 return {occupied,gaps:breaks,invalidIntervals:invalid,window:scope,windowSource:window?'explicit comparison window':'first to last recorded class; not opening hours',classCount:unique.length,longestGap:breaks.reduce((a,b)=>!a||b.end-b.start>a.end-a.start?b:a,null)};
}
module.exports={parseTime,parseClock,parseInterval,merge,gaps,formatTime,formatInterval,summarize};
