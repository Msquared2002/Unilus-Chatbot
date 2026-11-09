const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'unilus-integration-'));
process.env.SQLITE_FILE=path.join(dir,'test.sqlite');process.env.AUTH_USERS_FILE=path.join(dir,'users.json');process.env.AUTH_JWT_SECRET='synthetic-test-secret-with-at-least-32-characters';process.env.TONE_REWRITE='off';process.env.QUERY_PLANNER='off';
const db=require('../services/db');const {app}=require('../app');const auth=require('../services/authService');
fs.writeFileSync(process.env.AUTH_USERS_FILE,JSON.stringify({users:[{username:'synthetic-login',name:'Synthetic Student',role:'student',programme:'BIT',year:3,semester:2,password_hash:auth.hashPassword('Synthetic-Test-Password') }]}));
let server,base;const tokens={a:auth.signToken({username:'synthetic-a',role:'student',programme:'BIT',year:3,semester:2}).token,b:auth.signToken({username:'synthetic-b',role:'student',programme:'BIT',year:3,semester:2}).token,admin:auth.signToken({username:'synthetic-admin',role:'admin'}).token,staff:auth.signToken({username:'synthetic-finance',role:'staff',department:'Finance'}).token};
async function request(route,body,token,method='POST',headers={}){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json()};}
test.before(async()=>{await db.ready();server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await db.close();fs.rmSync(dir,{recursive:true,force:true});});
test('authenticated conversations reject another account and guest reuse',async()=>{const a=await request('/api/chat',{question:'hello'},tokens.a);assert.equal(a.status,200);assert.equal((await request('/api/chat',{question:'hello',sessionId:a.data.sessionId},tokens.b)).status,403);assert.equal((await request('/api/chat',{question:'hello',sessionId:a.data.sessionId})).status,403);});
test('guest cannot claim student timetable access',async()=>{assert.equal((await request('/api/timetable',undefined,null,'GET')).status,401);const r=await request('/api/chat',{question:'Show BIT year 3 semester 2 timetable',audience:'student'});assert.equal(r.data.signInRequired,true);});
test('full advisor journey retains temporary grades and does not persist them',async()=>{let sid;for(const q of ['I love business and computers','Maths 4, English 5, Biology 6, Commerce 2, Civic Education 3','ECZ School Certificate','What about Computer Science?']){const r=await request('/api/chat',{question:q,sessionId:sid});assert.equal(r.status,200);sid=r.data.sessionId;if(q.startsWith('What about'))assert.equal(r.data.advisor.recommendations[0].eligibility.status,'meets_checked_published_conditions');}
 const corrected=await request('/api/chat',{question:'Actually Maths was 5',sessionId:sid});assert.equal(corrected.data.advisor.recommendations[0].eligibility.status,'does_not_meet_checked_condition');assert.match((await request('/api/chat',{question:'Compare it with BBA',sessionId:sid})).data.answer,/Programme comparison/);assert.equal((await db.get('SELECT COUNT(*) AS n FROM conversations WHERE session_id = ?',[sid])).n,0);assert.match((await request('/api/chat',{question:'Start a new assessment',sessionId:sid})).data.answer,/cleared/);});
test('student timetable defaults and parser fix work without Groq',async()=>{for(const q of ["What's my timetable?",'What classes do I have Wednesday?','Show BIT third year second semester timetable']){const r=await request('/api/chat',{question:q},tokens.a);assert.equal(r.status,200);assert.ok(r.data.timetableMatches>0);assert.equal(r.data.queryType.entities.semester,2);}});
test('campus metadata and legacy fields survive',async()=>{const r=await request('/api/chat',{question:'Where is the library?'});assert.equal(r.data.navigation.placeId,'unilus_library');for(const k of ['answer','sources','resources','recommendedResources','timetableMatches','sessionId','suggestedActions'])assert.ok(Object.hasOwn(r.data,k));});
test('ticket creation is idempotent and scoped; replies persist; answers route is mounted',async()=>{const session=(await request('/api/chat',{question:'hello'},tokens.a)).data.sessionId;const support=require('../services/supportService');const records=await Promise.all(Array.from({length:5},()=>support.createTicket({sessionId:session,question:'synthetic missing results'})));assert.equal(new Set(records.map(x=>x.ticket.ref)).size,1);const ref=records[0].ticket.ref;
 assert.equal((await request('/api/tickets/'+ref,undefined,tokens.a,'GET',{'X-Chat-Session':session})).status,200);assert.equal((await request('/api/tickets/'+ref,undefined,tokens.b,'GET',{'X-Chat-Session':session})).status,403);assert.equal((await request('/api/admin/tickets/'+ref,undefined,tokens.staff,'GET')).status,403);
 assert.equal((await request('/api/admin/tickets/'+ref+'/events',{kind:'reply',body:'Synthetic response'},tokens.admin)).status,200);assert.equal((await request('/api/admin/tickets/'+ref,undefined,tokens.admin,'GET')).data.events.length,1);
 const saved=await request('/api/admin/answers',{question:'synthetic approved answer',answer:'Synthetic approved response',visibility:'visitor'},tokens.admin);assert.equal(saved.status,200);const faq=require('../services/faqService');assert.equal(await faq.findStaffAnswer('synthetic approved answer','student'),null);assert.ok(await faq.findStaffAnswer('synthetic approved answer','public'));});

test('real login endpoint validates passwords and signed profile',async()=>{const denied=await request('/api/auth/login',{username:'synthetic-login',password:'wrong'});assert.equal(denied.status,401);const r=await request('/api/auth/login',{username:'synthetic-login',password:'Synthetic-Test-Password'});assert.equal(r.status,200);assert.equal(r.data.user.programme,'BIT');assert.equal(auth.verifyToken(r.data.token).valid,true);});
test('chat returns authorized resolved replies and never internal notes or foreign tickets',async()=>{
 const sid=(await request('/api/chat',{question:'hello'},tokens.a)).data.sessionId;
 const support=require('../services/supportService'),workflow=require('../services/ticketWorkflowService');
 const {ticket}=await support.createTicket({sessionId:sid,question:'Synthetic reply integration test'});
 await workflow.add(ticket.ref,{kind:'reply',body:'Synthetic staff response: your request has been reviewed.',actor:'synthetic-staff',visibility:'student'});
 await workflow.add(ticket.ref,{kind:'note',body:'PRIVATE_INTERNAL_NOTE_TEST',actor:'synthetic-staff',visibility:'staff'});
 await support.updateTicketStatus(ticket.ref,'Resolved');
 await workflow.assign(ticket.ref,'Academic Office',null,'synthetic-admin');
 const r=await request('/api/chat',{question:'Has anyone replied to '+ticket.ref+'?',sessionId:sid},tokens.a);
 assert.equal(r.status,200);assert.match(r.data.answer,/Synthetic staff response/);assert.match(r.data.answer,/Resolved/);assert.match(r.data.answer,/Academic Office/);assert.doesNotMatch(r.data.answer,/PRIVATE_INTERNAL/);
 const other=(await request('/api/chat',{question:'hello'},tokens.b)).data.sessionId;
 const denied=await request('/api/chat',{question:'Any response on '+ticket.ref+'?',sessionId:other},tokens.b);
 assert.doesNotMatch(denied.data.answer,/Synthetic staff response|Academic Office|Resolved/);
});
test('confirmation variants preserve consent, synthetic issue text and cancellation',async()=>{
 for(const phrase of ['Confirmed.','Yes, I confirm.','Go ahead and submit.','Please submit the ticket.','Proceed with submission.']){
  const sid=(await request('/api/chat',{question:'hello'},tokens.a)).data.sessionId;
  const draft=await request('/api/chat',{sessionId:sid,question:'I want to create a support ticket. My fictional student demo account cannot display its timetable. Please help me report this issue, but do not submit it until I confirm.'},tokens.a);
  assert.equal(draft.data.support.status,'pending');
  const submitted=await request('/api/chat',{sessionId:sid,question:phrase},tokens.a);assert.equal(submitted.data.support.status,'submitted');
  const row=await db.get('SELECT question FROM tickets WHERE ticket_ref = ?',[submitted.data.ticket.ref]);
  assert.match(row.question,/fictional student demo account cannot display its timetable/);assert.doesNotMatch(row.question,/until I confirm|Please help me report/);
 }
 const sid=(await request('/api/chat',{question:'hello'},tokens.a)).data.sessionId;
 await request('/api/chat',{sessionId:sid,question:'Create a ticket for my fictional test'},tokens.a);
 const r=await request('/api/chat',{sessionId:sid,question:'No, do not submit it.'},tokens.a);assert.equal(r.data.support.status,'cancelled');
 assert.equal((await request('/api/chat',{sessionId:sid,question:'Confirmed.'},tokens.a)).data.ticket,null);
});
test('twelve-turn advisor conversation works through the real chat route',async()=>{
 const qs=['Hi, I need help choosing a programme to study at UNILUS.',"I'm interested in technology, programming, and cybersecurity. What programmes would you recommend?",'Why would you recommend Computer Science for me?',"What's the difference between Computer Science and Information Systems and Technology?",'Which one would suit someone who prefers software development?',"What if I'm more interested in business systems and managing technology than writing software?",'What are the entry requirements for both programmes?','Do I qualify if I have five O-Level credits, including English, Mathematics and Science?','What other information would you need to determine whether I qualify?','Forget about my grades for now. Which programme best matches my interests?','What are the career opportunities for each programme?',"Based on everything I've told you, which programme would you recommend and why?"];
 let sid,r;for(const q of qs){r=await request('/api/chat',{question:q,sessionId:sid});assert.equal(r.status,200);sid=r.data.sessionId;assert.equal(r.data.queryType.isProgrammeAdvisor,true,q);assert.doesNotMatch(r.data.answer,/additional_grade_information_required|missing_or_unrecognized|requirements_not_sufficiently_documented/);}
 assert.match(r.data.answer,/I recommend Information Systems and Technology/);assert.doesNotMatch(r.data.answer,/Economics|Development Studies/);
});
test('expired guest cannot retrieve replies, and guest status accurately reports no reply',async()=>{
 const sid=(await request('/api/chat',{question:'hello'})).data.sessionId;
 const {ticket}=await require('../services/supportService').createTicket({sessionId:sid,question:'Synthetic guest expiry test'});
 const noReply=await request('/api/chat',{sessionId:sid,question:'Any response on '+ticket.ref+'?'});assert.match(noReply.data.answer,/No student-visible staff response/);
 await require('../services/ticketWorkflowService').add(ticket.ref,{kind:'reply',body:'SECRET_EXPIRED_GUEST_REPLY',actor:'synthetic',visibility:'student'});
 await db.run('UPDATE chat_sessions SET expires_at = ? WHERE id = ?',['2000-01-01T00:00:00.000Z',sid]);
 assert.equal((await request('/api/tickets/'+ticket.ref,undefined,null,'GET',{'X-Chat-Session':sid})).status,403);
 const denied=await request('/api/chat',{sessionId:sid,question:'Any response on '+ticket.ref+'?'});assert.doesNotMatch(denied.data.answer,/SECRET_EXPIRED_GUEST_REPLY/);
});

test('feedback and support requests reject foreign sessions and invalid events',async()=>{
 const sid=(await request('/api/chat',{question:'hello'},tokens.a)).data.sessionId;
 assert.equal((await request('/api/feedback',{sessionId:sid,rating:'up'},tokens.b)).status,403);
 assert.equal((await request('/api/tickets',{sessionId:sid,question:'Synthetic support'},tokens.b)).status,403);
 const t=await request('/api/tickets',{sessionId:sid,question:'Synthetic support'},tokens.a);assert.equal(t.status,201);
 const ref=t.data.ticket.ref;
 assert.equal((await request('/api/admin/tickets/'+ref+'/events',{kind:'unknown',body:'bad'},tokens.admin)).status,400);
 assert.equal((await request('/api/admin/tickets/'+ref,{status:'Closed'},tokens.admin,'PATCH')).status,400);
 assert.equal((await request('/api/admin/tickets/'+ref,{status:'Resolved'},tokens.admin,'PATCH')).status,200);
 assert.equal((await request('/api/admin/tickets/'+ref,undefined,tokens.admin,'GET')).data.events[0].actor,'synthetic-admin');
});
