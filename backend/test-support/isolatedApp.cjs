// Stage A only: isolated existing application, never loads private env/cloud configuration.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
for(const key of Object.keys(process.env))if(/DATABASE|SUPABASE|GROQ|AUTH_|DEMO_|TICKET_ATTACHMENT|SUPPORT_CONTACT|VECTOR|ADMIN_API/.test(key))delete process.env[key];
const dir=process.env.STAGE_A_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'unilus-stage-a-'));
Object.assign(process.env,{NODE_ENV:'test',SQLITE_FILE:path.join(dir,'acceptance.sqlite'),AUTH_JWT_SECRET:crypto.randomBytes(48).toString('hex'),AUTH_USERS_FILE:path.join(dir,'users.json'),DEMO_ACADEMIC_ENABLED:'yes',DEMO_FIXED_ACCOUNT:'unilus-demo-student-b',DEMO_ACADEMIC_USERS:'unilus-demo-student,unilus-demo-student-b',DEMO_ACADEMIC_STORE_DIR:path.join(dir,'profiles'),TICKET_ATTACHMENT_STORE_DIR:path.join(dir,'attachments'),DEMO_TIMETABLE_OVERRIDE_ENABLED:'yes',VECTOR_BACKEND:'json'});
const nativeFetch=global.fetch;
let localPort=null;
global.fetch=(url,options)=>{const u=new URL(url);if(u.hostname!=='127.0.0.1'||u.port!==String(localPort))return Promise.reject(Error('Stage A external network disabled'));return nativeFetch(url,options);};
const express=require('../node_modules/express'),{app}=require('../app'),db=require('../services/db'),auth=require('../services/authService');
const users={b:{username:'unilus-demo-student-b',name:'Luka Hamududu',role:'student',programme:'BIT',year:3,semester:2},a:{username:'unilus-demo-student',name:'Flexible Synthetic Student',role:'student',programme:'BIT',year:3,semester:2},staff:{username:'synthetic-finance',name:'Synthetic Finance Staff',role:'staff',department:'Finance Office'},admin:{username:'synthetic-admin',name:'Synthetic Administrator',role:'admin'}};
// Random local-only passwords remain in temporary private fixtures, never logs/source.
fs.writeFileSync(process.env.AUTH_USERS_FILE,JSON.stringify({users:Object.values(users).map(u=>({...u,password_hash:auth.hashPassword(crypto.randomBytes(24).toString('hex'))}))}),{mode:0o600});
module.exports.ready=(async()=>{await db.ready();const profiles=require('../services/demoAcademicService');for(const u of [users.a,users.b])await profiles.get(u);
 const tt=require('../services/timetableNotificationService');await tt.publish(require('../data/timetable/timetable.json'),{complete:true,sourceValidated:true,period:'2026-sem2',source:'Isolated acceptance of existing dataset; not live extractor',expectedPrevious:null});await tt.refreshAccepted(true);
 const server=express();server.get('/js/runtime-config.js',(q,r)=>r.type('js').send('window.UNILUS_API_BASE=location.origin+"/api";'));
 // Loopback fixture selection, intentionally not an application authentication endpoint.
 server.get('/stage-a/:account',(q,r)=>{const user=users[q.params.account];if(!user)return r.sendStatus(404);const key=user.role==='student'?'unilusAuthToken':'unilusStaffToken';r.set('Cache-Control','no-store').type('html').send('<!doctype html><title>Isolated Stage A fixture</title><script>sessionStorage.clear();sessionStorage.setItem("unilusDemoSession","authenticated");sessionStorage.setItem("unilusDemoProgramme","bachelor-of-science-in-information-systems-and-technology");sessionStorage.setItem('+JSON.stringify(key)+','+JSON.stringify(auth.signToken(user).token)+');location.replace('+JSON.stringify(user.role==='student'?'/portal.html':'/admin.html')+');</script>');});
 server.use(express.static(path.resolve(__dirname,'../../dummy-environment'),{index:false}));server.use(app);
 const instance=server.listen(process.env.STAGE_A_PORT===undefined?8793:Number(process.env.STAGE_A_PORT),'127.0.0.1');
 await new Promise((resolve,reject)=>{instance.once('listening',resolve);instance.once('error',reject);});
 localPort=instance.address().port;
 console.log('Stage A isolated local fixture http://127.0.0.1:'+localPort+'/website.html; student selection /stage-a/b or /stage-a/a; stop Ctrl+C');
 process.once('SIGINT',()=>instance.close(async()=>{await db.close();process.exit(0);}));
 return {instance,db,users,dir};
})();
if(require.main===module)module.exports.ready.catch(e=>{console.error('Stage A startup failed:',e.message);process.exit(1);});
