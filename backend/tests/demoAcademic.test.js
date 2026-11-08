const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'unilus-academic-'));
delete process.env.DATABASE_URL;process.env.NODE_ENV='development';process.env.SQLITE_FILE=path.join(dir,'synthetic.sqlite');process.env.AUTH_JWT_SECRET='synthetic-academic-test-secret-longer-than-32';process.env.DEMO_ACADEMIC_ENABLED='yes';process.env.DEMO_ACADEMIC_USERS='synthetic-a,synthetic-b';process.env.DEMO_ACADEMIC_STORE_DIR=path.join(dir,'profiles');
const db=require('../services/db'),service=require('../services/demoAcademicService'),auth=require('../services/authService'),{app}=require('../app');
const a={username:'synthetic-a',name:'Account A',role:'student',programme:'BIT',year:3,semester:2},b={...a,username:'synthetic-b',name:'Account B'};
const ta=auth.signToken(a).token,tb=auth.signToken(b).token,staff=auth.signToken({username:'synthetic-staff',role:'staff',department:'Academic Office'}).token;
let server,base,pa,pb;const nativeFetch=global.fetch;
async function request(route,body,token=ta){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};}
const chat=(profile,question,token=ta,extra={})=>request('/api/chat',{question,sessionId:profile.sessionId,demoProfileId:profile.id,...extra},token);
test.before(async()=>{await db.ready();server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;global.fetch=(url,options)=>{assert.ok(String(url).startsWith(base+'/'),'No remote calls permitted');return nativeFetch(url,options);};});
test.after(async()=>{global.fetch=nativeFetch;server.closeAllConnections();await new Promise(r=>server.close(r));await db.close();fs.rmSync(dir,{recursive:true,force:true});});
test('two existing authenticated accounts automatically receive independent stable fictional profiles',async()=>{pa=(await request('/api/demo-academics/profile')).data;pb=(await request('/api/demo-academics/profile',undefined,tb)).data;assert.notEqual(pa.id,pb.id);assert.notEqual(pa.studentNumber,pb.studentNumber);assert.notEqual(pa.sessionId,pb.sessionId);assert.equal(pa.year,3);assert.equal(pa.semester,2);assert.match(pa.studentNumber,/^DEMO-/);assert.equal(pa.seed,undefined);assert.deepEqual((await request('/api/demo-academics/profile')).data,pa);});
test('guest, staff, non-demo account and forged IDs cannot retrieve another academic profile',async()=>{assert.equal((await request('/api/demo-academics/profile',undefined,null)).status,403);assert.equal((await request('/api/demo-academics/profile',undefined,staff)).status,403);const outsider=auth.signToken({...a,username:'other'}).token;assert.equal((await request('/api/demo-academics/profile',undefined,outsider)).status,403);assert.equal((await request('/api/demo-academics/profile/'+pb.id)).status,404);assert.equal((await chat({...pb},'Show my CA marks')).status,409);assert.equal((await chat(pa,'Show my CA marks',tb)).status,409);assert.equal((await request('/api/demo-academics/profile?profileId='+pb.id)).data.id,pa.id);});
test('verified observed course codes, mathematically consistent CA and unfinished finals',()=>{
 const map=service.mappings(),{undergraduateGrade}=require('../services/undergraduateAcademicPolicy');
 for(const p of [pa,pb])for(const period of p.periods){const codes=map[p.programme].periods[period.key].courses.map(c=>c.code);assert.ok(codes.length>=3);
  for(const c of period.courses){assert.ok(codes.includes(c.code));assert.match(c.code,/^[A-Z]{2,6}\d{3}$/);assert.doesNotMatch(c.name,/Group [A-Z](?:\s|$)/);assert.equal(c.assessments.reduce((n,a)=>n+a.weight,0),40);
   const sum=Math.round(c.assessments.reduce((s,x)=>s+(x.contribution||0),0)*10)/10;assert.equal(c.visibleCA,sum);assert.equal(c.totalCA,c.ready?sum:null);
   for(const a of c.assessments){if(a.status==='available')assert.equal(a.contribution,Math.round(a.score*a.weight/10)/10);else assert.equal(a.score,null);if(!a.weight){assert.equal(a.status,'not-applicable');assert.equal(a.contribution,0);}}
   if(period.completed){assert.equal(c.finalMark,Math.round(c.totalCA+c.finalExam.contribution));assert.equal(c.finalGrade,undergraduateGrade(c.finalMark));}else{assert.equal(c.finalMark,null);assert.equal(c.finalGrade,null);}}
 }assert.match(pa.policy,/class tests 10/);assert.ok(pa.periods.find(p=>p.key===pa.activePeriod).courses.some(c=>!c.ready));
});
test('portal and structured chat return identical CA and letter-only final records',async()=>{const current=pa.periods.find(p=>p.key===pa.activePeriod);const r=await chat(pa,'What are my CA marks?');assert.equal(r.data.queryType.isSimulatedAcademic,true);assert.deepEqual(r.data.academic.courses,current.courses);const prior=pa.periods.find(p=>p.key==='2-2');const finals=await chat(pa,'Show my final results year 2 semester 2');assert.deepEqual(finals.data.academic.courses,prior.courses);assert.doesNotMatch(finals.data.answer,/\/100|simulation rules|not university/);assert.match(finals.data.answer,/\| Grade \|/);assert.match((await chat(pa,'What was my best course last semester?')).data.answer,/unavailable/);assert.match((await chat(pa,'Show me my final results')).data.answer,/not published/);assert.match((await chat(pa,'What programme and year am I in?')).data.answer,new RegExp(pa.studentNumber));});
test('comparisons, pending assessment queries and missing mapped periods are deterministic',async()=>{const r=await chat(pa,'Compare my Year 2 and Year 3 performance');assert.match(r.data.answer,/Year 2, Semester 2/);assert.match(r.data.answer,/Some requested years/);const pending=await chat(pa,'Which courses still have pending assessment marks?');assert.match(pending.data.answer,/Class tests/);assert.doesNotMatch(pending.data.answer,/Practical|Project 1/);assert.match((await chat(pa,'Show my final results year 4 semester 2')).data.answer,/unavailable/);});
test('profile survives a separate Node process restart with the same durable records',()=>{const script=`const s=require('./services/demoAcademicService'),db=require('./services/db');s.get(${JSON.stringify(a)}).then(p=>{console.log(JSON.stringify(p));return db.close()}).catch(()=>process.exit(1));`;const out=execFileSync(process.execPath,['-e',script],{cwd:path.join(__dirname,'..'),env:{...process.env},encoding:'utf8'});assert.deepEqual(JSON.parse(out.trim()),pa);});
test('unsupported programme fails without changing the current profile',async()=>{const r=await request('/api/demo-academics/profile',{mode:'specific',programme:'INVENTED',expectedProfileId:pa.id});assert.equal(r.status,422);assert.deepEqual((await request('/api/demo-academics/profile')).data,pa);});
test('focused academic requests use structured data without verbose policies',async()=>{
 for(const question of ["What's my lowest CA?","What's my highest CA?",'Which assessments are pending?','Did I clear the semester?','Which subjects require attention?','Compare my results across semesters']){
  const r=await chat(pa,question);assert.equal(r.data.queryType.isSimulatedAcademic,true,question);assert.equal(r.data.academic.profileId,pa.id);assert.doesNotMatch(r.data.answer,/Fictional academic simulation|simulation rules|\/100|not university records/);
 }
 const ranked=pa.periods.find(p=>p.key===pa.activePeriod).courses.filter(c=>c.ready);
 const high=await chat(pa,"What's my highest CA?");assert.ok(high.data.answer.includes(Math.max(...ranked.map(c=>c.totalCA)).toFixed(1)));
});
test('pending-assessment follow-up stays structured and cannot confirm an older support topic',async()=>{
 const count=(await db.get('SELECT count(*) AS n FROM tickets')).n;
 assert.equal((await chat(pa,'Create a ticket for my synthetic problem')).data.support.status,'pending');
 await chat(pa,'What are my CA marks?');const yes=await chat(pa,'Yes please');
 assert.equal(yes.data.queryType.isSimulatedAcademic,true);assert.match(yes.data.answer,/Class tests/);assert.equal((await db.get('SELECT count(*) AS n FROM tickets')).n,count);
});
test('New Profile resets conversation and support confirmation without changing JWT/account identity',async()=>{assert.equal((await chat(pa,'Create a ticket for my synthetic problem')).data.support.status,'pending');const before=(await db.get('SELECT count(*) AS n FROM tickets')).n;const old=pa;pa=(await request('/api/demo-academics/profile',{mode:'keep',expectedProfileId:pa.id})).data;assert.notEqual(pa.id,old.id);assert.notEqual(pa.sessionId,old.sessionId);assert.equal(pa.programme,old.programme);assert.equal(pa.accountUsername,a.username);assert.equal(auth.verifyToken(ta).user.username,a.username);assert.equal((await chat(old,'Yes, submit it')).status,409);assert.equal((await chat(pa,'Yes, submit it')).data.support.status,'none');assert.equal((await db.get('SELECT count(*) AS n FROM tickets')).n,before);assert.deepEqual((await request('/api/demo-academics/profile',undefined,tb)).data,pb);});
test('specific and random selections only use mapped programmes and stable returned periods',async()=>{pa=(await request('/api/demo-academics/profile',{mode:'specific',programme:'BCS',expectedProfileId:pa.id})).data;assert.equal(pa.programme,'BCS');assert.deepEqual((await request('/api/demo-academics/profile')).data,pa);pa=(await request('/api/demo-academics/profile',{mode:'random',expectedProfileId:pa.id})).data;assert.ok(service.mappings()[pa.programme]);assert.equal((await request('/api/demo-academics/profile',{mode:'keep',expectedProfileId:'forged'})).status,409);});
test('in-flight old-profile chat is serialized before regeneration and stale retries are rejected',async()=>{let release,entered;const started=new Promise(r=>entered=r),hold=new Promise(r=>release=r);const old=pa;const task=service.withChat(a,old.id,old.sessionId,async p=>{entered();await hold;return p.id;});await started;let completed=false;const regeneration=service.renew(a,{mode:'keep',expectedProfileId:old.id}).then(p=>{completed=true;return p;});await new Promise(r=>setImmediate(r));assert.equal(completed,false);release();assert.equal(await task,old.id);pa=await regeneration;await assert.rejects(()=>service.withChat(a,old.id,old.sessionId,()=>{}),{status:409});});
test('simulated academic context drives the existing timetable and preserves Advisor routing',async()=>{pa=(await request('/api/demo-academics/profile',{mode:'specific',programme:'BIT',expectedProfileId:pa.id})).data;const t=await chat(pa,"What's my timetable?");assert.equal(t.data.queryType.entities.year,pa.year);assert.equal(t.data.queryType.entities.semester,pa.semester);const advisor=await chat(pa,'Help me choose a programme');assert.equal(advisor.data.queryType.isProgrammeAdvisor,true);const guest=await request('/api/chat',{question:'What are my CA marks?'},null);assert.equal(guest.data.queryType.isAcademicResultsUnavailable,true);});

test('private Storage adapter persists profiles, uses server-only headers and fails closed',async()=>{
    const keys=['DEMO_ACADEMIC_STORE_DIR','SUPABASE_URL','SUPABASE_DOCUMENT_BUCKET','SUPABASE_STORAGE_KEY'];
    const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]])),originalFetch=global.fetch;
    delete process.env.DEMO_ACADEMIC_STORE_DIR;
    process.env.SUPABASE_URL='https://synthetic-storage.invalid';process.env.SUPABASE_DOCUMENT_BUCKET='private-test';process.env.SUPABASE_STORAGE_KEY='sb_secret_synthetic_test_only';
    let stored=null,unavailable=false,writes=0;
    global.fetch=async(url,options)=>{
        const target=new URL(url);assert.equal(target.origin,'https://synthetic-storage.invalid');
        assert.match(target.pathname,/^\/storage\/v1\/object\/private-test\/demo-academics\/v1\/[a-f0-9]{64}\/active\.txt$/);
        assert.equal(options.headers.apikey,process.env.SUPABASE_STORAGE_KEY);assert.equal(options.headers.Authorization,undefined);assert.ok(options.signal);
        if(unavailable)return new Response('{}',{status:503});
        if(options.method==='POST'){writes++;assert.equal(options.headers['Content-Type'],'text/plain');assert.equal(options.headers['x-upsert'],'true');stored=JSON.parse(options.body);return new Response('{}');}
        return stored?Response.json(stored):Response.json({statusCode:'404',error:'not_found'},{status:400});
    };
    try{
        const cloud=await service.get(a);assert.equal(writes,1);assert.equal(cloud.seed,undefined);assert.ok(stored.seed);
        assert.deepEqual(await service.get(a),cloud);assert.equal(writes,1);
        unavailable=true;await assert.rejects(()=>service.get(a),{status:503});assert.equal(writes,1);
        unavailable=false;assert.deepEqual(await service.get(a),cloud);
        process.env.DEMO_ACADEMIC_STORE_DIR=path.join(dir,'profiles');const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';
        try{await assert.rejects(()=>service.get(a),{status:503});}finally{process.env.NODE_ENV=previous;}
    }finally{global.fetch=originalFetch;for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});

test('old assessment profiles require explicit New Profile and never silently regenerate',async()=>{
 const crypto=require('node:crypto'),file=path.join(process.env.DEMO_ACADEMIC_STORE_DIR,crypto.createHash('sha256').update(a.username).digest('hex')+'.json');
 const stored=fs.readFileSync(file,'utf8'),old=JSON.parse(stored);delete old.modelVersion;fs.writeFileSync(file,JSON.stringify(old));
 try{const r=await request('/api/demo-academics/profile');assert.equal(r.data.id,old.id);assert.equal(r.data.requiresNewProfile,true);assert.deepEqual(r.data.periods,[]);assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).seed,old.seed);assert.equal((await chat(old,'What are my CA marks?')).status,409);
 const renewed=await request('/api/demo-academics/profile',{expectedProfileId:old.id,mode:'keep'});assert.equal(renewed.data.modelVersion,2);assert.notEqual(renewed.data.id,old.id);
 }finally{fs.writeFileSync(file,stored);}
});
