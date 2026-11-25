const test=require('node:test'),assert=require('node:assert/strict');
process.env.DATABASE_URL='';process.env.SQLITE_FILE=':memory:';process.env.NODE_ENV='test';process.env.QUERY_PLANNER_ENABLED='false';process.env.GROQ_API_KEY='';process.env.AUTH_JWT_SECRET='local-synthetic-schedule-test-secret-1234567890';
const db=require('../services/db'),planner=require('../services/queryUnderstandingService'),schedules=require('../services/scheduleReasoningService');
const {app}=require('../app'),auth=require('../services/authService');
let server,base;
const userA={username:'schedule-fixture-a',role:'student',programme:'BIT',year:3,semester:2};
const tokenA=auth.signToken(userA).token,tokenB=auth.signToken({...userA,username:'schedule-fixture-b'}).token;
async function ask(question,token,sessionId,extra={}){const r=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify({question,sessionId,...extra})});return {status:r.status,data:await r.json()};}
test.before(async()=>{await db.ready();server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{await new Promise(r=>server.close(r));await db.close();});
test('guest body cannot grant timetable access or receive calculated evidence',async()=>{
 const r=await ask('When is Room 10 free tomorrow?',null,null,{audience:'student',role:'staff'});
 assert.equal(r.status,200);assert.equal(r.data.signInRequired,true);assert.equal(r.data.schedule,undefined);assert.equal(r.data.timetableMatches,0);
});
test('guest capability gate does not invoke teaching-record lookup',async()=>{
 const timetable=require('../services/timetableService'),get=timetable.getAll;
 timetable.getAll=()=>{throw Error('Guest timetable lookup forbidden');};
 try{const r=await planner.tryReadOnlyCapability('When is Room 10 free tomorrow?','guest-fixture','public');assert.equal(r.signInRequired,true);}
 finally{timetable.getAll=get;}
});
test('student schedule response carries calculated provenance and cross-user session reuse fails closed',async()=>{
 const a=await ask('When is Mr D. Tembo free on Wednesday?',tokenA);
 assert.equal(a.data.schedule?.status,'calculated');assert.ok(a.data.schedule.provenance.length);assert.match(a.data.answer,/gap between classes/);assert.match(a.data.schedule.limitation,/current academic validity/);
 const b=await ask('What about Thursday?',tokenB,a.data.sessionId);assert.equal(b.status,403);assert.equal(b.data.schedule,undefined);
 const c=await ask('What about Thursday?',tokenA,a.data.sessionId);assert.equal(c.data.schedule?.plan.day,'Thursday');
});
test('validated planner output rejects arbitrary tools, excessive scopes and malformed parameters',()=>{
 for(const bad of [null,[],{capability:'db.query',sql:'SELECT * FROM users'},{capability:'schedule.read',kind:'room',operation:'gaps',room:-1},{capability:'schedule.read',kind:'room',operation:'gaps',room:10,window:{start:0,end:99999}},{capability:'schedule.read',kind:'room',operation:'gaps',execute:'delete'}])assert.equal(schedules.validatePlan(bad),null);
 const plan=planner.parsePlannerResponse(JSON.stringify({normalizedQuery:'teaching gaps',schedule:{capability:'schedule.read',kind:'lecturer',operation:'gaps',lecturer:'Mr D. Tembo',day:'Wednesday'}}),'teaching gaps');
 assert.equal(plan.schedule.capability,'schedule.read');assert.equal(schedules.execute(plan.schedule).status,'calculated');
});
test('cohort clarification accepts actual selected group code rather than asking repeatedly',()=>{
 schedules.tryAnswer('What is my longest break between classes on Monday?','cohort-clarify');
 const r=schedules.tryAnswer('BIT32','cohort-clarify');assert.equal(r.schedule.status,'calculated');assert.equal(r.schedule.plan.programme,'BIT32');
});
test('accepted timetable replacement is visible to scheduling without module reload',()=>{
 const timetable=require('../services/timetableService'),original=timetable.getAll();
 try{timetable.acceptSnapshot(original.filter(r=>r.lecturer_name!=='Mr D. Tembo'));assert.equal(schedules.execute({kind:'lecturer',lecturer:'d tembo',day:'Wednesday',operation:'gaps'}).status,'unavailable');}
 finally{timetable.acceptSnapshot(original);}
});
test('existing query planner can select a calculation for a semantic paraphrase without final generation',async()=>{
 const ai=require('../services/aiService'),knowledge=require('../services/knowledgeService');
 const oldPlan=planner.planQuery,oldAnswer=ai.askAI,oldSearch=knowledge.searchKnowledge;
 planner.planQuery=async()=>planner.parsePlannerResponse(JSON.stringify({normalizedQuery:'lecturer teaching gaps',schedule:{capability:'schedule.read',kind:'lecturer',operation:'gaps',lecturer:'Mr D. Tembo',day:'Wednesday'}}),'downtime');
 ai.askAI=async()=>{throw Error('Calculated answers must not require final generation');};
 knowledge.searchKnowledge=async()=>[];
 try{const r=await require('../services/chatService').answerQuestion('What is the downtime for UNILUS lecturer Mr D. Tembo on Wednesday?',require('node:crypto').randomUUID(),'student');assert.equal(r.schedule?.status,'calculated');assert.match(r.answer,/14:00 to 17:30/);}
 finally{planner.planQuery=oldPlan;ai.askAI=oldAnswer;knowledge.searchKnowledge=oldSearch;}
});
test('room-set comparison excludes every venue with a recorded overlapping class',()=>{
 const r=schedules.execute(schedules.buildPlan('Which rooms have no classes at Silverest on Monday from 12:00 to 17:00?'));
 assert.equal(r.status,'calculated');assert.match(r.answer,/lack venues/);
 const I=require('../services/scheduleIntervals'),rows=require('../data/timetable/timetable.json');
 for(const venue of r.candidateVenueLabels)assert.ok(!rows.some(x=>x.venue_name===venue&&x.day==='Monday'&&I.parseInterval(x.time)?.start<1020&&I.parseInterval(x.time)?.end>720));
});
test('history establishes only an explicit user cohort, never assistant assertions',()=>{
 const question='What is my longest break between classes on Monday?';
 const a=schedules.tryAnswer(question,'explicit-history',new Date(),[{role:'user',content:'Show my BIT32 timetable'}]);assert.equal(a.schedule.status,'calculated');
 const b=schedules.tryAnswer(question,'assistant-history',new Date(),[{role:'assistant',content:'You are in BIT32 timetable'}]);assert.equal(b.schedule.status,'clarification');
});
test('primitive planner JSON falls back and invalid comparison clocks are rejected',()=>{
 for(const value of ['null','[]','42','true'])assert.equal(planner.parsePlannerResponse(value,'original').usedPlanner,false);
 const I=require('../services/scheduleIntervals');assert.equal(I.parseClock('12 AM'),0);assert.equal(I.parseClock('12 PM'),720);assert.equal(I.parseClock('13 PM'),null);
 const r=schedules.execute(schedules.buildPlan('When is Mr D. Tembo free on Thursday from 8 AM to 5 PM?'));assert.deepEqual(r.summaries[0].gaps,[{start:480,end:1020}]);assert.match(r.answer,/does not confirm consultation/);
});
test('weekday tokens cannot silently select a lecturer whose name contains Friday',()=>{
 const router=require('../services/retrievalRouter');
 assert.equal(router.extractLecturerQuery('What time does my last lecture end for BIT32 on Friday?'),null);
});
test('literal lecturer punctuation aliases consolidate without trusting conflicting shared codes',()=>{
 const r=schedules.resolve({kind:'lecturer',lecturer:'Dr J Kalyongwe'});assert.equal(r.matches.length,1);
 assert.ok(r.records.some(x=>x.lecturer_name==='Dr J. Kalyongwe'));assert.ok(r.records.some(x=>x.lecturer_name==='Dr J.Kalyongwe'));
 const conflict=schedules.resolve({kind:'lecturer',lecturer:'Dr MC Hara'});assert.equal(conflict.matches.length,1);assert.match(conflict.identityWarning,/not merged/);assert.ok(!conflict.records.some(x=>x.lecturer_name==='Dr Nawa'));
});
test('untitled retained lecturer names and lecturer-name clarification select the teaching entity',()=>{
 const plan=schedules.buildPlan('When is Fayala Sinyangwe free on Monday?');assert.equal(plan.kind,'lecturer');assert.equal(schedules.execute(plan).status,'calculated');
 schedules.tryAnswer('When is my lecturer free on Monday?','lecturer-name-clarify');
 const r=schedules.tryAnswer('Dr Banda','lecturer-name-clarify');assert.ok(['clarification','calculated'].includes(r.schedule.status));assert.equal(r.schedule.plan.kind,'lecturer');assert.equal(r.schedule.plan.lecturer,'banda');
});
