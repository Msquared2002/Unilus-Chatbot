const test=require('node:test');
const assert=require('node:assert/strict');
const {extractProgrammeStage}=require('../services/retrievalService');
test('generated year-before-semester questions preserve explicit semester',()=>{
 for(const q of ['Show BIT year 3 semester 2 timetable','Show BIT 3,2 timetable','Show BIT third year second semester timetable','Show the BIT year 3 semester 2 timetable for Wednesday']) {
 const e=extractProgrammeStage(q); assert.equal(e.year,3); assert.equal(e.semester,2);
 }
});
