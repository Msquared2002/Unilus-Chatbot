const test=require('node:test');const assert=require('node:assert/strict');
const a=require('../services/programmeAdvisorService');
test('official catalogue has 85 unique entries',()=>{const c=require('../services/programmeCatalogueService').catalogue;assert.ok(c.length>=85);assert.equal(new Set(c.map(p=>p.id)).size,c.length);});
test('extracts supplied grades without converting to credits',()=>assert.equal(a.parseInput('B in English, A in Mathematics and C in Biology').results.length,3));
test('recommendations are sourced and eligibility unsupported',()=>{const r=a.recommend(a.parseInput('computers and business'));assert.ok(r.length);for(const x of r){assert.ok(x.programme.evidence.length);assert.ok(['requirements_not_sufficiently_documented','additional_grade_information_required','conflicting_requirements'].includes(x.eligibility.status));}});
test('normal queries bypass advisor',()=>assert.equal(a.tryAnswer('Show BIT timetable'),null));
test('missing interests prompts free text',()=>assert.match(a.tryAnswer('What should I study?').answer,/Which fields/));
test('guest actions validate',()=>{for(const x of a.tryAnswer('I love computers. What should I study?').suggestedActions)assert.ok(require('../services/suggestedActionRegistry').validateAction(x));});

test('a generic programme-choice request opens the guided advisor without RAG',()=>{const r=a.tryAnswer('Help me choose a university programme','synthetic-choice-alias');assert.equal(r.queryType.isProgrammeAdvisor,true);assert.match(r.answer,/Which fields/);assert.deepEqual(r.sources,[]);});
