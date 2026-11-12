const test=require('node:test'),assert=require('node:assert/strict');
delete process.env.DATABASE_URL;process.env.SQLITE_FILE=':memory:';process.env.NODE_ENV='test';process.env.AUTH_JWT_SECRET='synthetic-unified-notification-secret-over-32-characters';
const {app}=require('../app'),db=require('../services/db'),tt=require('../services/timetableNotificationService'),auth=require('../services/authService');
const tokens=Object.fromEntries(['a','b','admin'].map(name=>[name,auth.signToken({username:'synthetic-unified-'+name,role:name==='admin'?'admin':'student'}).token]));
let server,base,ref,eventId,first;
const records=()=>Array.from({length:4},(_,i)=>({programme_code:'BIT41',class_group:'A1',course_code:'BIT'+(400+i),session_type:'Lecture',day:'Monday',time:'09:00-11:00',venue_name:'Room A',lecturer_name:'Synthetic Staff'})).concat([{programme_code:'BBA41',class_group:'A1',course_code:'BBA400',day:'Tuesday',time:'09:00-11:00',venue_name:'Room C'}]);
const options=id=>({expectedPrevious:id,period:'2099-sem1',complete:true,sourceValidated:true,source:'Isolated synthetic validated pipeline fixture'});
async function req(path,body,who='a',method){const r=await fetch(base+path,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(who?{Authorization:'Bearer '+tokens[who]}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};}
test.before(async()=>{await db.ready();server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await db.close();});
test('workflow A: staff reply, owner inbox, safe ticket detail, read acknowledgement and isolation',async()=>{
 const ticket=await req('/api/tickets',{question:'TEST ONLY synthetic notification integration',consent:true});assert.equal(ticket.status,201);ref=ticket.data.ticket.ref;
 assert.equal((await req('/api/admin/tickets/'+ref+'/events',{kind:'reply',body:'Synthetic visible reply'},'admin')).status,200);
 await req('/api/admin/tickets/'+ref+'/events',{kind:'note',body:'PRIVATE_INTERNAL_NOTE'},'admin');
 const inbox=await req('/api/notifications');assert.equal(inbox.status,200);assert.equal(inbox.data.unreadCount,1);eventId=inbox.data.items[0].id;assert.equal(inbox.data.items[0].action.ticketRef,ref);assert.doesNotMatch(JSON.stringify(inbox.data),/Synthetic visible reply|PRIVATE_INTERNAL_NOTE/);
 const detail=await req('/api/notifications/ticket/'+ref);assert.equal(detail.status,200);assert.match(JSON.stringify(detail.data),/Synthetic visible reply/);assert.doesNotMatch(JSON.stringify(detail.data),/PRIVATE_INTERNAL_NOTE|session_id|history_json/);
 assert.equal((await req('/api/notifications/ticket/'+ref,null,'b')).status,404);
 assert.equal((await req('/api/notifications/'+eventId+'/read',{},'b')).status,404);
 assert.equal((await req('/api/notifications/'+eventId+'/read',{})).status,200);assert.equal((await req('/api/notifications')).data.unreadCount,0);
 assert.equal((await req('/api/notifications',null,null)).status,403);assert.equal((await req('/api/notifications',null,'admin')).status,403);
});
test('workflow B: accepted venue change reaches only its subscribed cohort and opens updated timetable',async()=>{
 first=await tt.publish(records(),options(null));assert.equal(first.changes,0);
 const oldTimetable=await req('/api/timetable/programme/BIT41');assert.ok(oldTimetable.data.every(r=>r.venue_name==='Room A'));
 const choices=await req('/api/notifications/timetable/options');assert.equal(choices.data.choices.length,2);
 assert.equal((await req('/api/notifications/timetable/subscription',{period:'2099-sem1',programmeCode:'BIT41',group:'A1'},'a','PUT')).status,200);
 await req('/api/notifications/timetable/subscription',{period:'2099-sem1',programmeCode:'BBA41',group:'A1'},'b','PUT');
 const updated=records();updated[0].venue_name='Room B';await tt.publish(updated,options(first.publicationId));
 const inbox=await req('/api/notifications');assert.equal(inbox.data.unreadCount,1);assert.deepEqual(new Set(inbox.data.items.map(i=>i.category)),new Set(['ticket','timetable']));
 const change=inbox.data.items.find(i=>i.category==='timetable');assert.match(change.message,/ROOM A to ROOM B/);assert.equal(change.action.programmeCode,'BIT41');assert.equal((await req('/api/notifications',null,'b')).data.items.length,0);
 const timetable=await req('/api/timetable/programme/BIT41?publication='+change.action.publicationId);assert.ok(timetable.data.some(r=>r.venue_name==='Room B'));
 assert.equal((await req('/api/notifications/'+encodeURIComponent(change.id)+'/read',{},'b')).status,404);
 await req('/api/notifications/'+encodeURIComponent(change.id)+'/read',{});assert.equal((await req('/api/notifications')).data.unreadCount,0);
});
test('workflow C/D: unchanged and failed extraction preserve snapshots and alert counts',async()=>{
 const current=await tt.latest(),before=(await req('/api/notifications')).data;
 const duplicate=await tt.publish(JSON.parse(current.snapshot_json).records,options(current.id));assert.equal(duplicate.duplicate,true);
 await assert.rejects(tt.publish(records().slice(0,1),{...options(current.id),reviewedRemovals:true}),/Incomplete source/);
 assert.equal((await tt.latest()).id,current.id);assert.deepEqual((await req('/api/notifications')).data,before);
});
