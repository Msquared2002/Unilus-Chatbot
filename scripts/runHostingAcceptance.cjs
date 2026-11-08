// Explicitly inventoried local-container acceptance; never pushes/deploys.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFile}=require('child_process'),{promisify}=require('util');
const exec=promisify(execFile),root=path.resolve(__dirname,'..');
const dotenv=require('../backend/node_modules/dotenv');
const read=f=>dotenv.parse(fs.readFileSync('C:/UNILUS-secrets/'+f));
async function docker(args){const r=await exec('docker',args,{windowsHide:true,timeout:30000,maxBuffer:4*1024*1024});return(r.stdout+(args[0]==='logs'?r.stderr:'')).trim();}
async function main(){
 const advisorOnly=process.argv.includes('--advisor-only');
 const hosting=read('hosting.env'),access=read('demo-access.env');hosting.QUERY_PLANNER_ENABLED='true';hosting.KNOWLEDGE_WARM_SNAPSHOT_ON_START='yes';
 fs.writeFileSync('C:/UNILUS-secrets/hosting.env',Object.entries(hosting).map(([k,v])=>k+'='+v).join('\n')+'\n');
 const url=new URL(hosting.DATABASE_URL);url.searchParams.set('options','-c default_transaction_read_only=on');
 fs.writeFileSync('C:/UNILUS-secrets/hosting-readonly.env',Object.entries({...hosting,DATABASE_URL:url.toString()}).map(([k,v])=>k+'='+v).join('\n')+'\n');
 const result={run:'hosting-demo-'+crypto.randomUUID(),coldStarts:[],requests:[],syntheticSessions:[],originalRecordsPreserved:null};
 const out=path.join(root,advisorOnly?'deployment/hosting-advisor-acceptance.json':'deployment/hosting-acceptance.json');const save=()=>fs.writeFileSync(out,JSON.stringify(result,null,2));save();let retainedToken;
 for(let attempt=advisorOnly?2:0;attempt<3;attempt++){
  const name='unilus-hosting-'+crypto.randomUUID();let created=false;
  const startup={attempt,readOnly:attempt<2};result.coldStarts.push(startup);save();
  try{
   await docker(['run','--detach','--name',name,'--memory=512m','--cpus=0.1','--env-file','C:/UNILUS-secrets/'+(attempt<2?'hosting-readonly.env':'hosting.env'),
    '--mount','type=bind,source=C:/UNILUS-secrets/supabase-ca.crt,target=/etc/secrets/supabase-ca.crt,readonly',
    '--mount','type=bind,source=C:/UNILUS-secrets/demo-users.json,target=/etc/secrets/demo-users.json,readonly',
    '--publish',advisorOnly?'127.0.0.1:8875:10000':'127.0.0.1::10000','unilus-hosting:local','node','-r','./scripts/hostingWriteGuard.js','server.js']);created=true;
   const binding=await docker(['port',name,'10000/tcp']),base='http://127.0.0.1:'+binding.split(':').at(-1),at=Date.now();let ready=false;
   for(let poll=0;poll<90;poll++){
    try{const r=await fetch(base+'/readyz',{signal:AbortSignal.timeout(5000)});startup.lastProbeStatus=r.status;await r.text();ready=r.ok;}catch(e){startup.lastProbeError=e.cause?.code||e.code||e.name;}
    if(ready)break;
    if(await docker(['inspect','--format','{{.State.Running}}',name])!=='true')break;
    if(poll%10===0)console.log(JSON.stringify({attempt,startupPending:true,seconds:Math.round((Date.now()-at)/1000)}));
    await new Promise(r=>setTimeout(r,3000));
   }
   startup.ready=ready;startup.seconds=Math.round((Date.now()-at)/1000);
   startup.exitCode=Number(await docker(['inspect','--format','{{.State.ExitCode}}',name]));startup.oomKilled=(await docker(['inspect','--format','{{.State.OOMKilled}}',name]))==='true';
   startup.logs=(await docker(['logs',name])).split('\n').filter(l=>l.startsWith('{')).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean);save();
   if(!ready){startup.internalProbe=await docker(['exec',name,'python3','-c',"import urllib.request,json; r=urllib.request.urlopen('http://127.0.0.1:10000/readyz',timeout=10); print(json.dumps({'status':r.status}))"]);save();throw Error('Cold startup failed');}
   startup.stats=JSON.parse(await docker(['stats','--no-stream','--format','{{json .}}',name]));
   async function request(label,route,body,token,method='POST'){
    const entry={label,method,route,plannedAt:new Date().toISOString()};result.requests.push(entry);save();const t=performance.now();
    const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',Origin:'https://unilus-demo.netlify.app',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(120000)});
    const data=await r.json();Object.assign(entry,{ms:Math.round(performance.now()-t),status:r.status,sourceCount:data.sources?.length||0,aiUnavailable:/temporarily unavailable/i.test(data.answer||'')});
    if(data.sessionId&&!result.syntheticSessions.includes(data.sessionId))result.syntheticSessions.push(data.sessionId);save();return{status:r.status,data};
   }
   const login=await request('stable student login','/api/auth/login',{username:access.STUDENT_USERNAME,password:access.STUDENT_PASSWORD});
   if(login.status!==200)throw Error('Student login failed');
   if(retainedToken&&(await request('JWT survives process restart','/api/auth/me',undefined,retainedToken,'GET')).status!==200)throw Error('Stable JWT failed');retainedToken=login.data.token;
   for(const role of ['ACADEMIC','ADMIN']){const signed=await request('stable '+role.toLowerCase()+' login','/api/auth/login',{username:access[role+'_USERNAME'],password:access[role+'_PASSWORD']});if(signed.status!==200||role==='ACADEMIC'&&signed.data.user.department!=='Academic Office')throw Error('Staff login failed');}
   if(advisorOnly){const response=await request('guided programme advisor','/api/chat',{question:'Help me choose a university programme'});result.guidedAdvisorVerified=response.status===200&&response.data.queryType?.isProgrammeAdvisor===true;if(!result.guidedAdvisorVerified)throw Error('Advisor routing failed');}
   if(attempt===2&&!advisorOnly){
    const guest=await request('guest greeting','/api/chat',{question:'hello'}),student=await request('student greeting','/api/chat',{question:'hello'},retainedToken);
    if(guest.status!==200||student.status!==200)throw Error('Greeting failed');
    const sid=student.data.sessionId,gid=guest.data.sessionId;
    await request('timetable','/api/chat',{question:'Show BIT third year second semester timetable',sessionId:sid},retainedToken);
    await request('campus','/api/chat',{question:'Where is the library?',sessionId:gid});
    await request('programme advisor','/api/chat',{question:'Help me choose a university programme'});
    const question='For demonstration '+result.run+', explain university student housing and residence policy.';
    await request('first complete RAG','/api/chat',{question,sessionId:sid},retainedToken);
    await request('repeated complete RAG','/api/chat',{question,sessionId:sid},retainedToken);
    await Promise.all([request('concurrent authenticated RAG','/api/chat',{question,sessionId:sid},retainedToken),request('concurrent guest RAG','/api/chat',{question,sessionId:gid})]);
    startup.statsAfter=JSON.parse(await docker(['stats','--no-stream','--format','{{json .}}',name]));
   }
   save();console.log(JSON.stringify({attempt,ready,startupSeconds:startup.seconds}));
  }finally{if(created)await docker(['rm','--force',name]);}
 }
 Object.assign(process.env,read('hosting-readonly.env'),{DATABASE_CA_FILE:'C:/UNILUS-secrets/supabase-ca.crt'});
 const db=require('../backend/services/db');try{
  const baseline=JSON.parse(fs.readFileSync(path.join(root,'deployment/migration-gate-preflight-2026-11-08.json')));
  const preserved={};for(const [table,limit]of Object.entries({conversations:28,tickets:2,staff_answers:1,feedback:0})){
   const r=await db.get("SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,'[]')) AS digest FROM public."+table+' t WHERE id<=?',[limit]);preserved[table]=r.digest===baseline.fingerprints[table];
  }result.originalRecordsPreserved=preserved;
  result.syntheticInventory={conversations:(await db.all('SELECT id FROM conversations WHERE session_id=ANY(?::text[])',[result.syntheticSessions])).map(r=>r.id),sessions:result.syntheticSessions};
 }finally{await db.close();}
 result.complete=result.coldStarts.every(x=>x.ready)&&result.requests.every(x=>x.status===200)&&result.requests.filter(x=>/RAG/.test(x.label)).every(x=>x.sourceCount>0&&!x.aiUnavailable)&&Object.values(result.originalRecordsPreserved).every(Boolean);save();console.log(JSON.stringify({complete:result.complete,requests:result.requests.map(x=>({label:x.label,status:x.status,ms:x.ms})),originalRecordsPreserved:result.originalRecordsPreserved}));if(!result.complete)process.exitCode=1;
}
main().catch(e=>{console.error(JSON.stringify({event:'hosting_acceptance_failed',code:e.code||'ACCEPTANCE_FAILED'}));process.exitCode=1;});
