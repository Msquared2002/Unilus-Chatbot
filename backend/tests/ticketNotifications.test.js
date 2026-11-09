const test=require('node:test'),assert=require('node:assert/strict');
delete process.env.DATABASE_URL;process.env.SQLITE_FILE=':memory:';process.env.NODE_ENV='test';
const db=require('../services/db'),sessions=require('../services/sessionOwnershipService');
require('../services/sessionService');
const tickets=require('../services/supportService'),events=require('../services/ticketWorkflowService');
const notifications=require('../services/ticketNotificationService');
const a={role:'student',username:'synthetic-notification-a'},b={role:'student',username:'synthetic-notification-b'};
let ref;
test.before(async()=>{await db.ready();const sid=await sessions.resolveSession(null,a);ref=(await tickets.createTicket({sessionId:sid,question:'Synthetic notification test'})).ticket.ref;});
test.after(()=>db.close());
test('reply becomes an unread inbox event and private contents never enter payload',async()=>{
 await events.add(ref,{kind:'reply',body:'PRIVATE STUDENT REPLY',actor:'staff',visibility:'student'});
 await events.add(ref,{kind:'note',body:'PRIVATE INTERNAL NOTE',actor:'staff',visibility:'staff'});
 const result=await notifications.inbox(a);assert.equal(result.unreadCount,1);assert.equal(result.items.length,1);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE|actor|staff_username/);
});
test('another account and anonymous users cannot receive private notifications',async()=>{
 assert.equal((await notifications.inbox(b)).items.length,0);
 for(const user of [null,{role:'staff',username:a.username}])await assert.rejects(notifications.inbox(user),{status:403});
});
test('read acknowledgement is idempotent and owner scoped',async()=>{
 const {items}=await notifications.inbox(a);await assert.rejects(notifications.markRead(b,items[0].id),{status:404});
 assert.equal((await notifications.inbox(a)).unreadCount,1);
 await notifications.markRead(a,items[0].id);await notifications.markRead(a,items[0].id);
 assert.equal((await notifications.inbox(a)).unreadCount,0);assert.equal((await notifications.inbox(a)).items[0].read,true);
 assert.equal((await db.get('SELECT count(*) AS n FROM ticket_notification_reads')).n,1);
});
test('successful status transitions notify once and same-status retries do not duplicate',async()=>{
 await tickets.updateTicketStatus(ref,'Resolved');await tickets.updateTicketStatus(ref,'Resolved');
 const first=await notifications.inbox(a),second=await notifications.inbox(a);
 assert.deepEqual(first,second);assert.equal(first.items.length,2);assert.equal(first.unreadCount,1);
 assert.match(first.items[0].message,/status changed/);
});
test('guest ticket events are excluded even when a student knows the reference',async()=>{
 const sid=await sessions.resolveSession(null,null);const guest=(await tickets.createTicket({sessionId:sid,question:'Synthetic guest ticket'})).ticket;
 await events.add(guest.ref,{kind:'reply',body:'Guest reply',actor:'staff'});
 assert.equal((await notifications.inbox(a)).items.length,2);assert.equal((await notifications.inbox(b)).items.length,0);
});
