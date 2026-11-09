const express=require('express'),cors=require('cors');
const {attachUser}=require('./middleware/attachUser');const db=require('./services/db');
const app=express();const production=process.env.NODE_ENV==='production';
const origins=String(process.env.CORS_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
app.disable('x-powered-by');app.set('trust proxy',Number(process.env.TRUST_PROXY_HOPS)||false);
app.use((req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Cache-Control','no-store');res.set('X-Frame-Options','DENY');next();});
app.use(cors({origin(origin,done){if(!origin||origins.includes(origin)||!production&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))return done(null,true);done(Object.assign(Error('Origin not allowed'),{status:403}));},allowedHeaders:['Content-Type','Authorization','X-Admin-Key','X-Chat-Session']}));
app.use(express.json({limit:'64kb'}));app.use(attachUser);
const buckets=new Map();app.use('/api',(req,res,next)=>{const key=req.ip;const now=Date.now();let b=buckets.get(key);if(!b||now-b.at>60000)b={at:now,n:0};b.n++;if(buckets.size>10000)buckets.clear();buckets.set(key,b);if(b.n>120)return res.status(429).json({error:'Too many requests; try again shortly'});next();});
app.use('/api',(req,res,next)=>production&&!ready?res.set('Retry-After','5').status(503).json({error:'The assistant is starting. Please try again shortly.',retryable:true}):next());
app.use('/api/auth',require('./routes/authRoutes'));
app.use('/api/notifications',require('./routes/notificationRoutes'));
app.use('/api/demo-academics',require('./routes/demoAcademicRoutes'));
app.use('/api/timetable',require('./routes/timetableRoutes'));
app.use('/api/chat',require('./routes/chatRoutes'));
app.use('/api/campus',require('./routes/campusRoutes'));
app.use('/api',require('./routes/supportRoutes'));
app.use('/api',require('./routes/staffAnswerRoutes'));
app.use('/api',require('./routes/knowledgeRoutes'));
app.get('/healthz',(req,res)=>res.json({status:'alive'}));
let ready=false;
app.get('/readyz',async(req,res)=>{try{if(!ready)throw Error('Initializing');await db.get('SELECT 1 AS ok');res.json({status:'ready'});}catch{res.status(503).json({status:'not_ready'});}});
app.get('/',(req,res)=>res.json({service:'UNILUS chatbot',status:ready?'ready':'initializing'}));
app.use((err,req,res,next)=>{console.error(JSON.stringify({event:'request_failed',path:req.path,status:err.status||500}));res.status(err.status||500).json({error:err.status===413?'Request too large':'Request could not be completed'});});
async function initialize(){
 const stage=async(name,fn)=>{const at=performance.now();try{const value=await fn();console.log(JSON.stringify({event:'initialization_stage',stage:name,ms:Math.round(performance.now()-at),rss:process.memoryUsage().rss}));return value;}catch(e){e.initializationStage=name;console.error(JSON.stringify({event:'initialization_failed',stage:name,code:e.code||e.cause?.code||(/connection timeout|timeout exceeded when trying to connect/i.test(e.message)?'DB_CONNECT_TIMEOUT':e.name||'INITIALIZATION_FAILED'),ms:Math.round(performance.now()-at)}));throw e;}};
 if(production){if(!process.env.GROQ_API_KEY)throw Error('GROQ_API_KEY required');if(db.dialect!=='postgres')throw Error('PostgreSQL required');if(!origins.length||origins.some(o=>!o.startsWith('https://')))throw Error('Explicit HTTPS CORS_ORIGINS required');if(!require('./services/authService').isConfigured())throw Error('AUTH_JWT_SECRET required');if(process.env.VECTOR_BACKEND!=='database')throw Error('Production requires durable knowledge records');if(!require('./services/managedKnowledgeService').configured())throw Error('Production object storage required');}
 await stage('database',async()=>{await db.ready();for(let attempt=0;attempt<2;attempt++){try{await db.get('SELECT 1 AS ok');break;}catch(e){const transient=['ETIMEDOUT','ECONNRESET','ECONNREFUSED'].includes(e.code)||/connection timeout|timeout exceeded when trying to connect/i.test(e.message);if(!production||!transient||attempt===1)throw e;console.warn(JSON.stringify({event:'initialization_retry',stage:'database',attempt:attempt+1,code:e.code||'DB_CONNECT_TIMEOUT'}));await new Promise(r=>setTimeout(r,500));}}});
 if(production){await stage('permissions',()=>require('./services/runtimePermissionService').verifyRuntime(db));await stage('storage',()=>require('./services/managedKnowledgeService').verifyBucket());}
 if(process.env.VECTOR_BACKEND==='database')await stage('hydrate',()=>require('./services/managedKnowledgeService').hydrate());
 const count=await stage('knowledge',()=>require('./services/knowledgeService').getStore().count());if(!count)throw Error('Knowledge is unavailable; run the approved bootstrap');
 if(process.env.WARM_MODEL_ON_START==='yes'){const vector=await stage('model',()=>require('./services/embeddingService').createEmbedding('Readiness verification'));if(vector.length!==384)throw Error('Embedding mismatch');}
 if(production&&process.env.KNOWLEDGE_WARM_SNAPSHOT_ON_START!=='no')await stage('knowledge_snapshot',async()=>{const records=await require('./services/knowledgeService').getStore().list();require('./services/lexicalSearchService').prepareRecords(records);});
 require('./services/knowledgeUpdater').syncRestrictedSources();ready=true;console.log(JSON.stringify({event:'initialization_complete',rss:process.memoryUsage().rss}));
}
async function start(){const server=app.listen(Number(process.env.PORT)||5000);try{await initialize();}catch(e){server.closeAllConnections();await new Promise(r=>server.close(r));await db.close();throw e;}server.requestTimeout=60000;server.headersTimeout=15000;const shutdown=()=>{ready=false;server.close(async()=>{await db.close();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();};process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);return server;}
module.exports={app,initialize,start};
