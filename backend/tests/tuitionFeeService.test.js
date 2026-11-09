const test = require('node:test');
const assert = require('node:assert/strict');
const fees = require('../services/tuitionFeeService');
const data = require('../data/tuition-fees.json');
const { classifyQuery } = require('../services/retrievalRouter');
test('all published schedules reproduce exactly from the original PDFs', async () => {
  assert.deepEqual(await require('../scripts/buildTuitionCatalogue').build(), data);
  assert.equal(data.schedules.length, 48);
});
for (const year of [2025, 2026]) test(`Computer Science local/SADC ${year} preserves every semester and provenance`, () => {
  const r = fees.tryAnswer(`fees for computer science bachelors local ${year}`);
  assert.equal(r.tuition.status, 'answered');
  assert.deepEqual(r.tuition.schedules[0].semesters.map(s => s.amount), [12800,12800,12800,12800,13600,13600,13600,13600]);
  assert.equal(r.sources[0].academic_year, year);
  assert.equal(r.sources[0].source_file, year === 2025 ? 'UNDERGRADUATE-FEES-ZMW.pdf' : 'UNILUS-PROSPECTUS-2026-11.pdf');
  assert.equal(r.sources[0].page_number, year === 2025 ? 1 : 13);
  assert.match(r.sources[0].source_sha256, /^[a-f0-9]{64}$/);
  assert.equal(r.timetableMatches, 0); assert.deepEqual(r.suggestedActions, []);
  assert.doesNotMatch(r.answer, /15,600|postgraduate|Master of/);
});
test('BIT 2026 is Information Systems and Technology, not Information Technology', () => {
  const r = fees.tryAnswer('fees for BIT 2026 local year 3 semester 2');
  assert.equal(r.tuition.schedules[0].programme, 'Bachelor of Science in Information Systems and Technology');
  assert.match(r.answer, /ZMW 15,050/); assert.doesNotMatch(r.answer, /Bachelor of Information Technology/);
  assert.equal(r.tuition.schedules[0].semesters.find(s => s.studyYear === 3 && s.semester === 2).amount, 15050);
  assert.equal(fees.tryAnswer('BIT fees 2025 local').tuition.status, 'unavailable');
  assert.equal(fees.tryAnswer('Information Technology fees 2026 local').tuition.status, 'unavailable');
  assert.equal(fees.tryAnswer('Information Technology fees 2025 local').tuition.status, 'answered');
});
test('Cyber Security and LLB retain their own source rows', () => {
  assert.match(fees.tryAnswer('Cyber Security tuition local 2026 year 4 semester 2').answer, /ZMW 13,600/);
  // The existing timetable labels BCS as Cyber Security, never Computer Science.
  assert.equal(fees.tryAnswer('BCS fees local 2026').tuition.schedules[0].programme, 'Bachelor of Science in Cyber Security');
  assert.match(fees.tryAnswer('LLB tuition local 2026 year 3 semester 2').answer, /ZMW 16,100/);
});
test('Medicine local versus foreign categories and year provenance remain separate', () => {
  const local = fees.tryAnswer('Medicine tuition local 2026 year 1 semester 1');
  const foreign = fees.tryAnswer('Medicine tuition foreign 2026 year 1 semester 1');
  assert.match(local.answer, /ZMW 20,550/); assert.doesNotMatch(local.answer, /USD/);
  assert.match(foreign.answer, /USD 2,080/); assert.doesNotMatch(foreign.answer, /ZMW/);
  assert.match(foreign.answer, /body omits the calendar year/);
  assert.equal(local.sources[0].audience, 'local_sadc'); assert.equal(foreign.sources[0].audience, 'foreign');
});
test('fee clarifications preserve local category across programme selection using existing history', () => {
  const history = [];
  function ask(q) { const r = fees.tryAnswer(q, history); assert.ok(r); history.push({role:'user',content:q},{role:'assistant',content:r.answer}); return r; }
  assert.equal(ask('yes fees please').tuition.status, 'clarification');
  assert.match(ask('local').answer, /which programme/);
  assert.equal(ask('BIT').tuition.status, 'answered');
  assert.match(history.at(-1).content, /Information Systems and Technology/);
  assert.equal(fees.tryAnswer('local', [{role:'assistant',content:'What timetable do you need?'}]), null);
});
test('missing stage shows schedule, ambiguous programmes and contradictory categories do not guess', () => {
  assert.equal(fees.tryAnswer('fees for BIT').tuition.status, 'clarification');
  assert.equal(fees.tryAnswer('BIT fees local').tuition.schedules[0].semesters.length, 8);
  for (const q of ['fees for computing local', 'fees for Computer Science or Cyber Security local', 'BIT fees local USD']) {
    const r = fees.tryAnswer(q); assert.equal(r.tuition.status, 'clarification'); assert.equal(r.sources.length, 0);
  }
  assert.equal(fees.tryAnswer('Computer Science fees local 2027').tuition.status, 'unavailable');
  assert.equal(fees.tryAnswer('BIT fees local semester 3').tuition.status, 'clarification');
  assert.equal(fees.tryAnswer('Computer Science fees local 2025 and 2026').tuition.status, 'clarification');
  assert.equal(fees.tryAnswer('Master of Computer Science fees local'), null);
  for (const q of ['accommodation fees','application fees','registration fees','create a ticket about BIT fees']) assert.equal(fees.tryAnswer(q), null);
  for (const q of ['pharmacy tuition local 2026','biomedical science fees','nursing fees']) assert.equal(fees.tryAnswer(q), null, 'existing clinical programme retrieval remains available');
});
test('category corrections in fee follow-ups replace prior category rather than mixing it', () => {
  const history = [];
  for (const q of ['BIT fees local 2026', 'foreign', 'semester 2']) {
    const r = fees.tryAnswer(q, history); assert.equal(r.tuition.status, 'answered');
    history.push({role:'user',content:q},{role:'assistant',content:r.answer});
    if (q !== 'BIT fees local 2026') { assert.equal(r.sources[0].currency, 'USD'); assert.doesNotMatch(r.answer, /ZMW/); }
  }
});
test('fee classification cannot retrieve classes, lecturers or weekday actions', () => {
  for (const q of ['BIT year 3 semester 2 fees', 'Computer Science fee schedule', 'BCS 3,2 tuition Wednesday', 'fees for computer science bachelors']) {
    const t = classifyQuery(q); assert.equal(t.isTimetable, false); assert.equal(t.isKnowledge, true); assert.equal(t.entities.day, null);
  }
});
