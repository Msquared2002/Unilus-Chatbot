const test=require('node:test'),assert=require('node:assert/strict');process.env.STAGE_A_PORT='0';let f,base;
test.before(async()=>{f=await require('../test-support/isolatedApp.cjs').ready;base='http://127.0.0.1:'+f.instance.address().port;});
test.after(async()=>{f.instance.closeAllConnections();await new Promise(r=>f.instance.close(r));await f.db.close();});
async function request(path,body,who,method='POST'){const token=who?require('../services/authService').signToken(f.users[who]).token:null;const r=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return r;}
test('feedback persists once per answer, rejects cross-student access, and admin listing excludes private transcript',async()=>{
 const ownership=require('../services/sessionOwnershipService'),sid=await ownership.resolveSession(null,f.users.b),ref=require('crypto').randomUUID();
 const input={sessionId:sid,answerRef:ref,rating:'down',reason:'unclear',comment:'Please explain the next step',question:'PRIVATE QUESTION',answer:'PRIVATE ANSWER'};
 let r=await request('/feedback',input,'b');assert.equal(r.status,200);const {id}=await r.json();r=await request('/feedback',{...input,rating:'up'},'b');assert.equal((await r.json()).id,id);assert.equal(Number((await f.db.get('SELECT count(*) AS n FROM feedback WHERE session_id=?',[sid])).n),1);
 assert.equal((await request('/feedback/'+id,{sessionId:sid,rating:'down'},'a','PATCH')).status,403);
 assert.equal((await request('/admin/feedback',null,'staff','GET')).status,403);assert.equal((await request('/admin/feedback',null,'b','GET')).status,401);
 r=await request('/admin/feedback',null,'admin','GET');assert.equal(r.status,200);const rows=await r.json();assert.equal(rows[0].id,id);assert.doesNotMatch(JSON.stringify(rows),/PRIVATE|session_id|reference:/);
 assert.equal((await request('/admin/feedback/'+id,{reviewed:true},'admin','PATCH')).status,200);assert.equal((await request('/admin/feedback',null,'admin','GET')).status,200);
 assert.equal((await request('/feedback/'+id,{sessionId:sid,rating:'down',reason:'other'},'b','PATCH')).status,200);
 assert.equal((await request('/feedback',{...input,reason:'invented'},'b')).status,400);
});
test('feedback comments redact contact details, identifiers and academic marks',()=>{const clean=require('../services/answerFeedbackService').cleanComment;assert.doesNotMatch(clean('Contact example@example.test +260971234567 BIT24240001'),/example@|971234567|BIT24240001/);assert.equal(clean('I got 46 in BIT315'),'[Academic marks omitted]');});
test('PDF route exports displayed text, enforces bounds and ownership without reading private records',async()=>{
 const sid=await require('../services/sessionOwnershipService').resolveSession(null,f.users.b);
 let r=await request('/chat/pdf',{markdown:'## Synthetic answer\n\nOnly caller supplied text.',sessionId:sid},'a');assert.equal(r.status,403);
 r=await request('/chat/pdf',{markdown:'## Synthetic answer\n\nOnly caller supplied text.',sessionId:sid},'b');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/application\/pdf/);assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0,4).toString(),'%PDF');
 assert.equal((await request('/chat/pdf',{markdown:'a'.repeat(20001)})).status,400);assert.equal((await request('/chat/pdf',{markdown:'Safe',sources:[{}]})).status,400);
});
