const test = require('node:test'), assert = require('node:assert/strict');
delete process.env.DATABASE_URL; process.env.SQLITE_FILE = ':memory:'; process.env.NODE_ENV = 'test';
process.env.AUTH_JWT_SECRET = 'synthetic-tuition-api-test-secret-more-than-32-characters';
const Module = require('node:module'), load = Module._load;
let calls = 0;
Module._load = function(id, ...args) {
  if (id === 'groq-sdk') return class { constructor() { this.chat={completions:{create:async()=>{calls++;throw Error('No provider call allowed');}}}; } };
  return load.call(this, id, ...args);
};
const {app} = require('../app'), db = require('../services/db');
const token = require('../services/authService').signToken({username:'synthetic-fee-student',role:'student',programme:'BIT',year:3,semester:2}).token;
let server, base;
test.before(async()=>{await db.ready();server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{Module._load=load;server.closeAllConnections();await new Promise(r=>server.close(r));await db.close();});
async function ask(question, auth, sessionId) {const r=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({question,sessionId})});assert.equal(r.status,200);return r.json();}
test('guests and students receive identical public fee evidence with no Groq or timetable calls',async()=>{
  for(const q of ['Computer Science local fees 2025','Computer Science local fees 2026','BIT fees local 2026 year 3 semester 2','Cyber Security tuition local','LLB tuition local','Medicine tuition foreign','Medicine tuition local']){
    const guest=await ask(q,false),student=await ask(q,true);
    assert.equal(guest.answer,student.answer);assert.deepEqual(guest.sources,student.sources);
    for(const r of [guest,student]){assert.equal(r.timetableMatches,0);assert.equal(r.queryType.isTimetable,false);assert.deepEqual(r.suggestedActions,[]);assert.equal(r.usedFallback,false);assert.ok(r.sessionId);assert.equal(r.ticket,null);}
  }
  assert.equal(calls,0);
});
test('real API fee clarification chain retains category, without calling planner or generation',async()=>{
  let r=await ask('yes fees please',false);r=await ask('local',false,r.sessionId);assert.match(r.answer,/which programme/);
  r=await ask('BIT',false,r.sessionId);assert.match(r.answer,/Information Systems and Technology/);assert.match(r.answer,/ZMW 12,000/);assert.equal(calls,0);
});
