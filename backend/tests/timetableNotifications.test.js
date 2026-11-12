const test=require('node:test'),assert=require('node:assert/strict');
delete process.env.DATABASE_URL;process.env.SQLITE_FILE=':memory:';process.env.NODE_ENV='test';
const db=require('../services/db'),service=require('../services/timetableNotificationService'),diff=require('../services/timetableChangeService');
const a={username:'synthetic-tt-a',role:'student'},b={username:'synthetic-tt-b',role:'student'};
const rows=()=>Array.from({length:4},(_,i)=>({programme_code:'BIT41',class_group:'A1',course_code:'BIT'+(400+i),course_name:'Synthetic course '+i,session_type:'Lecture',day:'Monday',time:'09:00-11:00',venue_name:'Room A',lecturer_name:'Synthetic Lecturer'}));
const options=expectedPrevious=>({complete:true,sourceValidated:true,period:'2099-sem1',source:'Synthetic validated fixture',expectedPrevious});
async function baseline(){return service.publish(rows(),options(null));}
async function subscribe(user=a,code='BIT41',group='A1'){return service.subscribe(user,{period:'2099-sem1',programmeCode:code,group});}
test.before(async()=>db.ready());
test.beforeEach(async()=>{for(const table of ['timetable_notification_reads','timetable_subscriptions','timetable_changes','timetable_publications'])await db.run('DELETE FROM '+table);});
test.after(()=>db.close());
test('baseline, unchanged, order, whitespace and capitalization changes are silent',async()=>{
 const first=await baseline();assert.equal(first.changes,0);const altered=rows().reverse().map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,'  '+v.toLowerCase()+'  '])));
 const same=await service.publish(altered,options(first.publicationId));assert.equal(same.duplicate,true);assert.equal((await db.get('SELECT count(*) AS n FROM timetable_changes')).n,0);
});
for(const [field,value]of [['time','12:00-14:00'],['day','Tuesday'],['venue_name','Room B'],['lecturer_name','Synthetic Other Lecturer']])test(field+' changes create one accurate targeted event',async()=>{
 const first=await baseline();await subscribe();const updated=rows();updated[0][field]=value;
 const next=await service.publish(updated,options(first.publicationId));assert.equal(next.changes,1);
 const inbox=await service.inbox(a);assert.equal(inbox.unreadCount,1);assert.equal(inbox.items[0].change.before[field],diff.normalize(rows())[0][field]);assert.equal(inbox.items[0].change.after[field],diff.normalize(updated).find(r=>r.course_code==='BIT400')[field]);assert.equal(inbox.items[0].action.programmeCode,'BIT41');
 assert.equal((await service.inbox(b)).items.length,0);
 await assert.rejects(service.markRead(b,inbox.items[0].id.slice(10)),{status:404});
 await service.markRead(a,inbox.items[0].id.slice(10));await service.markRead(a,inbox.items[0].id.slice(10));assert.equal((await service.inbox(a)).unreadCount,0);
 assert.equal((await service.publish(updated,options(first.publicationId))).duplicate,true);assert.equal((await service.inbox(a)).items.length,1);
});
test('additions and reviewed removals are accurate and never called cancellation',async()=>{
 const first=await baseline();await subscribe();const changed=rows().slice(1);changed.push({...rows()[0],course_code:'BIT499'});
 await assert.rejects(service.publish(changed,options(first.publicationId)),/explicit review/);
 await service.publish(changed,{...options(first.publicationId),reviewedRemovals:true});const inbox=await service.inbox(a);assert.equal(inbox.items.length,2);assert.ok(inbox.items.some(i=>i.change.kind==='added'));assert.match(inbox.items.find(i=>i.change.kind==='removed').message,/does not confirm cancellation/);
});
test('failed and incomplete extraction leaves accepted data and events intact',async()=>{
 const first=await baseline();for(const input of [[],rows().slice(0,1),[{...rows()[0],time:'bad'}]])await assert.rejects(service.publish(input,{...options(first.publicationId),reviewedRemovals:true}));
 await assert.rejects(service.publish(rows(),{...options(first.publicationId),complete:false}));
 assert.equal((await service.latest()).id,first.publicationId);assert.equal((await db.get('SELECT count(*) AS n FROM timetable_changes')).n,0);
});
test('publication transaction failure cannot leave a changed snapshot without its events',async()=>{
 const first=await baseline(),updated=rows();updated[0].venue_name='Room B';const run=db.run;db.run=async(sql,params)=>{if(sql.startsWith('INSERT INTO timetable_changes'))throw Error('Synthetic interrupted publication');return run(sql,params);};
 try{await assert.rejects(service.publish(updated,options(first.publicationId)),/interrupted/);}finally{db.run=run;}
 assert.equal((await service.latest()).id,first.publicationId);assert.equal((await db.get('SELECT count(*) AS n FROM timetable_changes')).n,0);
});
test('subscriptions validate cohort, stage, study mode and group without assuming enrolment',async()=>{
 const data=[...rows(),...rows().map(r=>({...r,programme_code:'BBA41'})),...rows().map(r=>({...r,programme_code:'BIT31-PT',class_group:'A2'}))];await service.publish(data,options(null));
 await subscribe(a);await service.subscribe(b,{period:'2099-sem1',programmeCode:' bit31-pt ',group:' a2 '});
 const old=await service.latest();data[0].venue_name='Room B';await service.publish(data,options(old.id));assert.equal((await service.inbox(a)).items.length,1);assert.equal((await service.inbox(b)).items.length,0);
 await assert.rejects(subscribe(b,'BIT41','A2'),{status:400});await assert.rejects(service.subscription(null),{status:403});
});
test('multiple field changes are coherent, stale publication is refused, new period establishes a silent baseline',async()=>{
 const first=await baseline(),updated=rows();updated[0].day='Tuesday';updated[0].venue_name='Room B';await service.publish(updated,options(first.publicationId));
 assert.equal((await db.get('SELECT count(*) AS n FROM timetable_changes')).n,1);
 await assert.rejects(service.publish(rows().map(r=>({...r,venue_name:'Room C'})),options(first.publicationId)),/version changed/);
 const latest=await service.latest();const next=await service.publish(rows(),{...options(latest.id),period:'2100-sem1'});assert.equal(next.changes,0);
});
test('real pipeline records normalize without discarding lecturer-only records or inventing recipients',()=>{
 const actual=require('../data/timetable/timetable.json'),normalized=diff.normalize(actual);
 assert.ok(actual.length>1000);assert.ok(normalized.length>1000);assert.ok(normalized.some(r=>!r.programme_code));
 const example=actual.find(r=>r.programme_name?.endsWith('A1'));assert.equal(diff.group(example),'A1');
 assert.equal(diff.compare(normalized,normalized).length,0);
});
test('source cohort group and part-time code formatting normalize consistently',async()=>{
 const raw=rows().map(r=>({...r,class_group:null,programme_code:'BIT41- PT',programme_name:'Synthetic BIT year 4 semester 1 A1'}));
 const first=await service.publish(raw,options(null));await service.subscribe(a,{period:'2099-sem1',programmeCode:'bit41-pt',group:'a1'});
 raw[0].venue_name='Room B';await service.publish(raw,options(first.publicationId));assert.equal((await service.inbox(a)).items.length,1);
 await service.hydrate();assert.equal(require('../services/timetableService').getByProgramme('BIT41-PT').length,4);
});
test('lecturer-only changes are preserved but never broadcast to a guessed programme',async()=>{
 const initial=rows().concat([{...rows()[0],programme_code:null,course_code:'SHARED100'}]);const first=await service.publish(initial,options(null));assert.equal(first.untargetedRecords,1);await subscribe();
 initial.at(-1).venue_name='Another Room';const next=await service.publish(initial,options(first.publicationId));assert.equal(next.changes,0);assert.equal((await service.inbox(a)).items.length,0);
});
