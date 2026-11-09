// Existing durable ticket events are the inbox; unique event IDs prevent duplicates.
const db = require('./db');
db.schema({ sqlite: [`CREATE TABLE IF NOT EXISTS ticket_notification_reads (
 owner TEXT NOT NULL, event_id INTEGER NOT NULL, PRIMARY KEY(owner,event_id))`] });
const scope = ` FROM ticket_events e JOIN tickets t ON t.ticket_ref=e.ticket_ref
 JOIN chat_sessions s ON s.id=t.session_id
 WHERE s.owner=? AND e.visibility='student' AND e.kind IN ('reply','status')`;
function owner(user) {
 if (user?.role !== 'student' || !user.username) throw Object.assign(Error('Student sign-in required'), {status:403});
 return 'user:'+user.username;
}
async function inbox(user) {
 const who=owner(user);
 const unread=await db.get(`SELECT count(*) AS n${scope} AND NOT EXISTS
 (SELECT 1 FROM ticket_notification_reads r WHERE r.owner=? AND r.event_id=e.id)`,[who,who]);
 const rows=await db.all(`SELECT e.id,e.kind,e.created_at,t.ticket_ref,
 CASE WHEN EXISTS(SELECT 1 FROM ticket_notification_reads r WHERE r.owner=? AND r.event_id=e.id) THEN 1 ELSE 0 END AS is_read
 ${scope} ORDER BY e.id DESC LIMIT 50`,[who,who]);
 return {unreadCount:Number(unread.n),items:rows.map(r=>({id:r.id,ticketRef:r.ticket_ref,createdAt:r.created_at,
  read:!!r.is_read,message:r.kind==='reply'?'Staff replied to your support ticket.':'Your support ticket status changed. Open the ticket for details.'}))};
}
async function markRead(user,id) {
 const who=owner(user);
 if(!/^[1-9]\d*$/.test(String(id)))throw Object.assign(Error('Notification unavailable'),{status:404});
 if(!await db.get(`SELECT e.id${scope} AND e.id=?`,[who,Number(id)]))throw Object.assign(Error('Notification unavailable'),{status:404});
 // Ownership and insertion in one statement; no guest tickets or staff notes.
 const result=await db.run(`INSERT INTO ticket_notification_reads(owner,event_id)
 SELECT ?,e.id${scope} AND e.id=? ON CONFLICT(owner,event_id) DO NOTHING`,[who,who,Number(id)]);
 return result;
}
module.exports={inbox,markRead};
