// Student dates are interpreted in Africa/Lusaka, independently of host timezone.
let testClock=null;
const now=()=>new Date(testClock?testClock():Date.now());
const fail=message=>Object.assign(Error(message),{status:400});
function local(date=now()){return require('./personalAcademicService').localTime(date);}
function day(iso,offset){return new Date(Date.parse(iso+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);}
function due(value,date=now()){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}\.\d{3}Z|:00Z|Z|\+02:00)?$/.test(value))throw fail('Use a valid date and time in Africa/Lusaka');const match=value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);const [,d,h,m]=match;const validDate=new Date(d+'T00:00:00Z');if(+h>23||+m>59||!Number.isFinite(validDate.getTime())||validDate.toISOString().slice(0,10)!==d)throw fail('Invalid date or time');const timestamp=value.endsWith('Z')?Date.parse(value):Date.parse(d+'T'+h+':'+m+':00+02:00');if(!Number.isFinite(timestamp)||timestamp<=date.getTime())throw fail('Choose a future reminder time');if(timestamp>date.getTime()+366*86400000)throw fail('Choose a reminder within the next year');return new Date(timestamp).toISOString();}
function parse(query,previous={},date=now()){
 if(/\b(?:every|daily|weekly|monthly|recurring)\b/i.test(query))throw fail('Only one-time reminders are supported. Please choose one date and time');
 const q=query.toLowerCase(),today=local(date),explicit=q.match(/\b(\d{4}-\d{2}-\d{2})\b/);let d=explicit?.[1]||(/tomorrow/.test(q)?day(today.iso,1):/today|this (?:morning|evening|afternoon)/.test(q)?today.iso:previous.date||null);
 const days=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],weekday=days.findIndex(x=>new RegExp('\\b'+x+'\\b').test(q));if(weekday>=0)d=day(today.iso,(weekday-today.weekday+7)%7);
 const clock=q.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)||q.match(/\bat\s+(\d{1,2}):(\d{2})\b/)||q.match(/^(\d{1,2}):(\d{2})$/);let t=previous.time||null;
 if(clock){let h=+clock[1],m=+(clock[2]||0);if(clock[3]){if(h<1||h>12)throw fail('Invalid reminder time');h=h%12+(clock[3]==='pm'?12:0);}if(h>23||m>59)throw fail('Invalid reminder time');t=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');}
 if(weekday>=0&&d===today.iso&&t&&Date.parse(d+'T'+t+':00+02:00')<=date.getTime())d=day(d,7);
 let title=previous.title||'';if(/\bremind me\b/i.test(query)){title=query.replace(/^.*?\bremind me\b\s*/i,'');if(/\bto\s+/i.test(title))title=title.replace(/^.*?\bto\s+/i,'');title=title.replace(/\b(?:today|tomorrow)(?:\s+(?:morning|evening|afternoon))?\b/ig,'').replace(/\bthis\s+(?:morning|evening|afternoon)\b/ig,'').replace(/\b(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/ig,'').replace(/\b(?:on\s+)?\d{4}-\d{2}-\d{2}\b/g,'').replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/ig,'').replace(/\s+/g,' ').replace(/[.?!]+$/,'').trim();}
 return {date:d,time:t,title,...(d&&t?{dueAt:due(d+'T'+t,date)}:{})};
}
function setTestClock(clock){if(process.env.NODE_ENV!=='test')throw Error('Test clock is not available');testClock=clock;}
module.exports={now,local,day,due,parse,setTestClock};
