const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
process.env.DATABASE_URL='';process.env.SQLITE_FILE=':memory:';process.env.NODE_ENV='test';process.env.GROQ_API_KEY='';process.env.QUERY_PLANNER_ENABLED='false';process.env.DEMO_ACADEMIC_ENABLED='yes';process.env.DEMO_ACADEMIC_USERS='demo,ux-flex';process.env.DEMO_FIXED_ACCOUNT='demo';process.env.AUTH_JWT_SECRET='synthetic-local-ux-regression-secret-12345678';process.env.DEMO_ACADEMIC_STORE_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'unilus-ux-profiles-'));
const db=require('../services/db'),profiles=require('../services/demoAcademicService'),ownership=require('../services/sessionOwnershipService'),chat=require('../services/chatService'),S=require('../services/scheduleReasoningService'),C=require('../services/timetableQueryContext'),present=require('../services/responsePresentationService'),I=require('../services/scheduleIntervals');
require('../services/aiService').askAI=async()=>{throw Error('Structured question reached final generation');};require('../services/knowledgeService').searchKnowledge=async()=>[];
const fixed={username:'demo',role:'student',programme:'BIT',year:3,semester:2},flex={...fixed,username:'ux-flex'};
let p;
async function ask(question,session=p.sessionId){return chat.answerQuestion(question,session,'student',p,{user:fixed,academicProfile:p});}
test.before(async()=>{await db.ready();p=await profiles.get(fixed);});
test.after(async()=>{await db.close();fs.rmSync(process.env.DEMO_ACADEMIC_STORE_DIR,{recursive:true,force:true});});
test('fixed Luka profile is byte-for-byte unchanged from the pre-change deterministic fixture',()=>{
 const original=require('../../docs/intelligence-ux/before.json').fixedProfile,actual=profiles.generate(fixed);assert.deepEqual(actual,original);assert.equal(actual.name,'Luka Hamududu');
});
test('all verified programme choices remain selectable without invented course records',()=>{
 const expected=require('../services/programmeCatalogueService').catalogue.filter(p=>p.evidence.length||p.offeringStatus==='current_application_catalogue');
 const choices=profiles.programmeChoices();assert.equal(choices.length,expected.length);assert.equal(new Set(choices.map(p=>p.programmeId)).size,expected.length);
 for(const choice of choices){const profile=profiles.generate(flex,null,{mode:'specific',programme:choice.code,year:choice.periods[0].year,semester:choice.periods[0].semester});assert.equal(profile.programmeId,choice.programmeId);assert.equal(profile.name,'Namonje Besa');assert.ok(profile.periods.some(p=>p.key===profile.activePeriod));if(choice.simulationStatus==='curriculum_unavailable'){assert.equal(profile.simulationStatus,'curriculum_unavailable');assert.ok(profile.periods.every(p=>p.courses.length===0));}}
});
test('actual random programme picker reaches the complete catalogue, including unimplemented curricula',()=>{
 const codes=profiles.programmeChoices().map(p=>p.code),seen=new Set();for(let i=0;i<5000;i++)seen.add(profiles.pickProgramme('deterministic synthetic random seed '+i,codes));assert.equal(seen.size,codes.length);assert.deepEqual([...seen].sort(),codes.sort());
});
test('flexible profile rename preserves ownership, ID, seed, grades and storage key',async()=>{
 const a=await profiles.get(flex),key=crypto.createHash('sha256').update(flex.username).digest('hex'),file=path.join(process.env.DEMO_ACADEMIC_STORE_DIR,key+'.json'),stored=JSON.parse(fs.readFileSync(file));stored.name='Previous display label';fs.writeFileSync(file,JSON.stringify(stored));const b=await profiles.get(flex);assert.equal(b.name,'Namonje Besa');assert.equal(a.id,b.id);assert.deepEqual(a.periods,b.periods);assert.equal(JSON.parse(fs.readFileSync(file)).seed,stored.seed);assert.equal(b.accountUsername,flex.username);
});
test('my and possessive cohort break queries calculate actual records without generation',async()=>{
 const mine=await ask("What's my longest break on Monday?");assert.equal(mine.schedule.status,'calculated');assert.equal(mine.answer,'Your longest break on Monday is 4 hours, from 12:00 to 16:00.');
 const possessive=await ask("What's BIT32's longest break on Monday?");assert.equal(possessive.schedule.status,'calculated');assert.match(possessive.answer,/4 hours.*12:00 to 16:00/);assert.doesNotMatch(possessive.answer,/BIT32|pipeline|comparison window|2025/);
});
test('natural programme stages, next day and timetable follow-ups keep authorized context',async()=>{
 const tomorrow=await ask("What's my timetable tomorrow?");assert.equal(tomorrow.academic.kind,'timetable');assert.ok(tomorrow.academic.sessions.every(s=>p.registeredCourses.includes(s.course_code)));assert.doesNotMatch(tomorrow.answer,/Africa\/Lusaka|Qualification|2025/);
 await ask("What's my longest break on Monday?");const friday=await ask('What about Friday?');assert.equal(friday.schedule.plan.day,'Friday');assert.equal(friday.schedule.plan.programme,'BIT32');
 const other=await ask("What's the longest break for third-year BIT students in second semester on Monday?");assert.equal(other.schedule.plan.programme,'BIT32');assert.equal((await profiles.get(fixed)).year,3);
 const stage=C.parse("Can you check the timetable for first-year nursing students?");assert.equal(stage.year,1);assert.equal(stage.family,'NursingSC');assert.equal(stage.semester,null);
});
test('a lecturer with no listed classes gets a plain answer, with provenance retained',async()=>{
 const r=await ask('When is Mr D. Tembo free on Thursday?');assert.equal(r.answer,'Mr D. Tembo has no classes listed on Thursday.');assert.ok(r.sources.length);assert.match(r.schedule.limitation,/academic validity/);
 const w=await ask('When is Mr D. Tembo free on Wednesday?');assert.match(w.answer,/3-hour-30-minute gap.*14:00 to 17:30/);
});
test('synthetic group ambiguity clarifies and explicit group selection filters without changing profile',()=>{
 const tt=require('../services/timetableService'),original=tt.getAll(),row=original.find(r=>r.programme_code==='BIT32');
 try{tt.acceptSnapshot([{...row,class_group:'A1'},{...row,class_group:'A2',time:'14:00-16:00'}]);let plan=C.apply({kind:'student',operation:'longest',day:'Monday'},'my longest break on Monday',p);assert.match(S.execute(plan,p).answer,/Which class group/);plan=C.apply(plan,'group A2',p);const selected=C.resolve(plan,p);assert.ok(selected.records.every(r=>r.class_group==='A2'));assert.equal(p.classGroup,null);}
 finally{tt.acceptSnapshot(original);}
});
test('literal entity follow-ups change room or lecturer without reusing another student session',()=>{
 S.tryAnswer('When is Room 10 free at Silverest Knowledge Field 2 on Monday?','ux-room');const r=S.tryAnswer('What about Room 11?','ux-room');assert.equal(r.schedule.plan.room,11);assert.equal(r.schedule.plan.day,'Monday');assert.equal(S.tryAnswer('What about Friday?','unrelated-ux-session'),null);
});
test('wardrobe rules and all assets remain byte-identical; every catalogue choice uses existing eligibility',()=>{
 const before=require('../../docs/intelligence-ux/before.json'),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),base=path.join(__dirname,'../../dummy-environment/chatbot-widget');
 assert.equal(hash(fs.readFileSync(path.join(base,'avatar-entitlements.js'))),before.entitlementHash);for(const a of before.outfits)assert.equal(hash(fs.readFileSync(path.join(base,'outfits',a.name))),a.sha256);
 require('../../dummy-environment/js/demo-programmes');const session=require('../../dummy-environment/js/demo-session'),wardrobe=require('../../dummy-environment/chatbot-widget/avatar-entitlements');session.registerProgrammes(profiles.programmeChoices());
 for(const p of profiles.programmeChoices()){const student=session.studentForProgramme(p.programmeId),ent=wardrobe.resolveEntitlements(student),groups=Object.entries(wardrobe.AVATAR_PROGRAMME_GROUPS).filter(([,ids])=>ids.includes(p.programmeId));assert.equal(ent.programme,groups.length===1?groups[0][0]:null);for(const [group,config] of Object.entries(wardrobe.PROGRAMME_AVATAR_CONFIG))if(group!==ent.programme)for(const outfit of config.outfits)assert.ok(!ent.outfits.includes(outfit));}
});


test('every verified programme passes the authenticated selection API and preserves account ownership',async()=>{
 const app=require('../app').app,auth=require('../services/authService');const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port,token=auth.signToken(flex).token;
 async function request(route,body){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
 try{let current=(await request('/api/demo-academics/profile')).data;const list=(await request('/api/demo-academics/programmes')).data;assert.equal(list.length,profiles.programmeChoices().length);assert.equal(list.length,89);assert.equal(new Set(list.map(p=>p.code)).size,89);
  for(const choice of list){const r=await request('/api/demo-academics/profile',{mode:'specific',programme:choice.code,year:choice.periods[0].year,semester:choice.periods[0].semester,expectedProfileId:current.id});assert.equal(r.status,200,choice.name);current=r.data;assert.equal(current.programmeId,choice.programmeId);assert.equal(current.accountUsername,flex.username);assert.equal(current.name,'Namonje Besa');}
  assert.equal((await profiles.get(fixed)).name,'Luka Hamududu');
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('room ambiguity is human-readable and natural nursing clarification retains its programme',async()=>{
 const room=await ask('Is Room 10 free this afternoon?');assert.equal(room.schedule.status,'clarification');assert.doesNotMatch(room.answer,/SVT\d|#\d|schema|pipeline/);assert.match(room.answer,/campus and building/);
 const nursing=await ask('Can you check the timetable for first-year nursing students?');assert.match(nursing.answer,/semester/i);const follow=await ask('Semester 1');assert.equal(follow.schedule.plan.selection.family,'NursingSC');assert.equal(follow.schedule.plan.selection.year,1);assert.equal(follow.schedule.plan.selection.semester,1);assert.equal(follow.schedule.status,'unavailable');
});


test('guest natural personal scheduling questions fail closed without using profile context',async()=>{
 const r=await chat.answerQuestion("What's my longest break on Monday?",crypto.randomUUID(),'public');assert.equal(r.signInRequired,true);assert.equal(r.schedule,undefined);assert.doesNotMatch(r.answer,/external AI|offline|pipeline/);
});

test('new flexible Computer Science and Cyber Security records follow their own retained source families',()=>{
 const cs=profiles.generate(flex,null,{mode:'specific',programme:'BCS'}),cyber=profiles.generate(flex,null,{mode:'specific',programme:'CYBER'});
 assert.equal(cs.programmeId,'bachelor-of-science-in-computer-science');assert.equal(cs.timetableProgramme,'BSC');
 assert.equal(cyber.programmeId,'bachelor-of-science-in-cyber-security');assert.equal(cyber.timetableProgramme,'BCS');
 const rows=require('../data/timetable/timetable.json');
 for(const profile of [cs,cyber])for(const period of profile.periods)for(const course of period.courses)assert.ok(rows.some(r=>r.programme_code===profile.timetableProgramme+period.year+period.semester&&r.course_code===course.code));
});
