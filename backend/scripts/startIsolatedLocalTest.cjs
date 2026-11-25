// Local-only acceptance harness. Never loads dotenv or starts production workers.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const args=process.argv.slice(2),port=Number(args.find(a=>a.startsWith('--port='))?.split('=')[1]||5000);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Use a valid local port');
const password=process.env.UNILUS_LOCAL_TEST_PASSWORD;
if(typeof password!=='string'||password.length<12)throw Error('Set UNILUS_LOCAL_TEST_PASSWORD to a new local-only password of at least 12 characters; it will not be printed.');
// Keep only OS/runtime essentials. Discard all inherited application/cloud settings.
const keep=new Set(['systemroot','windir','path','pathext','temp','tmp','userprofile','homedrive','homepath','localappdata','appdata']);
for(const key of Object.keys(process.env))if(!keep.has(key.toLowerCase()))delete process.env[key];
const work=fs.mkdtempSync(path.join(os.tmpdir(),'unilus-isolated-test-'));
Object.assign(process.env,{NODE_ENV:'test',PORT:String(port),DATABASE_URL:'',SQLITE_FILE:':memory:',VECTOR_BACKEND:'json',
 AUTH_JWT_SECRET:crypto.randomBytes(48).toString('hex'),AUTH_USERS_FILE:path.join(work,'test-users.json'),
 QUERY_PLANNER_ENABLED:'false',GROQ_API_KEY:'',WARM_MODEL_ON_START:'no',DEMO_ACADEMIC_ENABLED:'yes',
 DEMO_ACADEMIC_USERS:'demo,student',DEMO_FIXED_ACCOUNT:'demo',DEMO_ACADEMIC_STORE_DIR:path.join(work,'profiles'),
 KNOWLEDGE_TEST_WORK_DIR:path.join(work,'knowledge'),CORS_ORIGINS:'http://127.0.0.1:8080,http://localhost:8080'});
// Deny non-loopback sockets as well as fetch, even if a service attempts a request.
const loopback=host=>['localhost','127.0.0.1','::1','[::1]'].includes(String(host).toLowerCase());
const net=require('node:net'),connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...values){let first=values[0];if(Array.isArray(first))first=first[0];
 const host=first&&typeof first==='object'?first.host||first.hostname||'localhost':typeof first==='number'?(typeof values[1]==='string'?values[1]:'localhost'):null;
 if(!host||!loopback(host))throw Object.assign(Error('External network access is disabled by the isolated local launcher'),{code:'LOCAL_TEST_NETWORK_BLOCKED'});
 return connect.apply(this,values);
};
const nativeFetch=global.fetch;
global.fetch=(input,options)=>{const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(!loopback(u.hostname))return Promise.reject(Object.assign(Error('External fetch is disabled by the isolated local launcher'),{code:'LOCAL_TEST_NETWORK_BLOCKED'}));return nativeFetch(input,options);};
const backend=path.resolve(__dirname,'..'),load=file=>require(path.join(backend,file));
const auth=load('services/authService');
fs.writeFileSync(process.env.AUTH_USERS_FILE,JSON.stringify({users:['demo','student'].map(username=>({username,name:username==='demo'?'Luka Hamududu':'Namonje Besa',role:'student',programme:'BIT',year:3,semester:2,password_hash:auth.hashPassword(password)}))}),{mode:0o600});
load('services/aiService').askAI=async()=> 'This isolated local test has external AI disabled. Structured timetable, academic, fees, campus and support workflows remain available; free-form generated answers are not being evaluated.';
load('services/embeddingService').createEmbedding=async()=>{throw Error('Isolated local test: lexical retrieval only');};
const {app}=load('app'),db=load('services/db'),express=load('node_modules/express');
const wrapper=express();
wrapper.get('/__local-test/status',(req,res)=>res.json({mode:'isolated-local-test',pid:process.pid,port,backendRoot:backend,database:'SQLite :memory:',vectorStore:'read-only local JSON snapshot',remoteCredentialsLoaded:false,externalNetwork:'blocked',AI:'offline',demoUsers:['demo','student'],temporaryDataDirectory:work}));
wrapper.get('/readyz',(req,res)=>res.json({status:'ready',mode:'isolated-local-test'}));
wrapper.use(app);
let server;
async function stop(){server?.closeAllConnections();if(server)await new Promise(r=>server.close(r));await db.close();console.log('Isolated server stopped. Temporary local test files retained at '+work);}
(async()=>{await db.ready();server=wrapper.listen(port,'127.0.0.1');server.on('error',()=>{console.error('Local test port unavailable; existing servers were not stopped.');process.exitCode=1;db.close();});await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 console.log(JSON.stringify({mode:'isolated-local-test',url:`http://127.0.0.1:${port}`,database:'SQLite :memory:',externalNetwork:'blocked',inference:'offline',localDataDirectory:work,signIn:'Use demo or student with the local-only password you supplied; no password or token is printed.'},null,2));
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>stop().then(()=>process.exit(0)));
})().catch(()=>{console.error('Isolated startup failed; no production configuration was loaded.');process.exitCode=1;});
