process.env.DATABASE_URL='';process.env.SQLITE_FILE=':memory:';process.env.NODE_ENV='test';
const test=require('node:test');
const assert=require('node:assert/strict');
const I=require('../services/scheduleIntervals');
const S=require('../services/scheduleReasoningService');
const rows=require('../data/timetable/timetable.json');
test('synthetic interval fixture: overlap, duplicates, adjacency and clipping',()=>{
 const input=[{start:60,end:120},{start:60,end:120},{start:100,end:180},{start:180,end:240},{start:300,end:500}];
 assert.deepEqual(I.merge(input,{start:90,end:400}),[{start:90,end:240},{start:300,end:400}]);
 assert.deepEqual(I.gaps(input,{start:0,end:400}),[{start:0,end:60},{start:240,end:300}]);
 assert.deepEqual(I.gaps([],{start:480,end:720}),[{start:480,end:720}]);
 assert.throws(()=>I.gaps([],null));
});
test('synthetic interval fixture: invalid time boundaries prevent negative claims',()=>{
 for(const value of ['25:00-26:00','10:60-12:00','10:00','12:00-10:00','24:01-24:10'])assert.equal(I.parseInterval(value),null);
 const result=I.summarize([{time:'08:00-10:00'},{time:'12:00-14:00'},{time:'15:00'}]);
 assert.equal(result.invalidIntervals,1);assert.deepEqual(result.gaps,[]);
});
test('authentic lecturer fixture: every derived gap is disjoint from all retained source intervals',()=>{
 const plan=S.buildPlan('When is Mr D. Tembo free on Wednesday?');
 const result=S.execute(plan);assert.equal(result.status,'calculated');assert.ok(result.provenance.length);
 const actual=rows.filter(r=>r.lecturer_name==='Mr D. Tembo'&&r.day==='Wednesday');
 assert.equal(result.provenance.length,actual.length);
 for(const gap of result.summaries[0].gaps)for(const record of actual){const occupied=I.parseInterval(record.time);assert.ok(!occupied||gap.end<=occupied.start||gap.start>=occupied.end);}
 assert.match(result.answer,/does not confirm consultation/);assert.match(result.answer,/current academic validity/);
});
test('authentic cohort: longest break is computed independently from sorted merged boundaries',()=>{
 const r=S.execute(S.buildPlan('What is the longest break between classes for BIT32 on Monday?'));
 assert.equal(r.status,'calculated');
 const sorted=rows.filter(r=>r.programme_code==='BIT32'&&r.day==='Monday').map(r=>I.parseInterval(r.time)).filter(Boolean).sort((a,b)=>a.start-b.start);
 let end=sorted[0]?.end,largest=0;
 for(const i of sorted.slice(1)){largest=Math.max(largest,i.start-end);end=Math.max(end,i.end);}
 assert.equal(r.summaries[0].longestGap?r.summaries[0].longestGap.end-r.summaries[0].longestGap.start:0,largest);
});
test('room identity requires building when same number exists at one campus',()=>{
 const a=S.execute(S.buildPlan('When is Room 3 free at Silverest on Monday?'));assert.equal(a.status,'clarification');
 const b=S.execute(S.buildPlan('When is Room 3 free at Silverest Knowledge Field 2 on Monday?'));assert.equal(b.status,'calculated');
 assert.match(b.answer,/does not confirm room booking/);
 assert.ok(b.provenance.every(p=>p.source_pages));
});
test('follow-up retains entity and changes day; unrelated topic and another session cannot inherit it',()=>{
 S.tryAnswer('When is Mr D. Tembo free on Wednesday?','context-a');
 const next=S.tryAnswer('What about Thursday?','context-a');assert.equal(next.schedule.plan.day,'Thursday');assert.equal(next.schedule.plan.lecturer,'d tembo');
 assert.equal(S.tryAnswer('What about Thursday?','context-b'),null);
 assert.equal(S.tryAnswer('And what are the fees?','context-a'),null);
 assert.equal(S.tryAnswer('What about Friday?','context-a'),null);
});
test('campus then building clarification preserves pending room question',()=>{
 S.tryAnswer('When is Room 10 free tomorrow?','room-context',new Date('2026-11-17T23:30:00Z'));
 const a=S.tryAnswer('Silverest.','room-context');assert.equal(a.schedule.status,'clarification');
 const b=S.tryAnswer('Knowledge Field 2','room-context');assert.equal(b.schedule.status,'calculated');assert.equal(b.schedule.plan.day,'Thursday');
});
test('planner rejects unrelated, malformed and overlong inputs; no user-selected tool execution',()=>{
 assert.equal(S.buildPlan('Submit a ticket'),null);assert.equal(S.buildPlan(null),null);assert.equal(S.buildPlan('x'.repeat(4001)),null);
 assert.equal(S.tryAnswer('Reset','room-context'),null);
 assert.equal(S.tryAnswer('What about Friday?','room-context'),null);
 assert.equal(S.execute(S.buildPlan('When is my lecturer free on Friday?')).status,'clarification');
});
test('relative days use Lusaka rather than UTC host calendar',()=>{
 assert.equal(S.dayOf('today',new Date('2026-11-17T23:30:00Z')),'Wednesday');
 assert.equal(S.dayOf('tomorrow',new Date('2026-11-17T23:30:00Z')),'Thursday');
});

test.after(async()=>{await require('../services/db').close();});
