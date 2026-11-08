const test=require('node:test'),assert=require('node:assert/strict');
const {ACADEMIC_MODEL_VERSION,CA_MAXIMUM,EXAM_MAXIMUM,undergraduateGrade:grade,assessmentConfiguration:configuration,assessmentRecord,courseResults,semesterOutcome:outcome}=require('../services/undergraduateAcademicPolicy');
for(const [mark,expected] of [[0,'D'],[49,'D'],[50,'C'],[55,'C'],[56,'C+'],[60,'C+'],[61,'B'],[65,'B'],[66,'B+'],[68,'B+'],[74,'B+'],[75,'B+'],[76,'A'],[85,'A'],[86,'A+'],[100,'A+']])test(`undergraduate boundary ${mark} is ${expected}`,()=>assert.equal(grade(mark),expected));
test('invalid marks are rejected without silent rounding or coercion',()=>{for(const mark of [-1,101,85.5,NaN,null,'74'])assert.throws(()=>grade(mark),RangeError);});
test('owner-selected demo configuration totals 30, excludes class tests and rejects old schemes',()=>{
 const regular=configuration();assert.deepEqual(regular,[{name:'Assignment 1',weight:10},{name:'Midexam 1',weight:20},{name:'Practical',weight:0},{name:'Project 1',weight:0}]);assert.equal(CA_MAXIMUM,30);assert.equal(EXAM_MAXIMUM,70);assert.equal(ACADEMIC_MODEL_VERSION,4);
 assert.throws(()=>configuration({scheme:'distance'}));assert.throws(()=>configuration({scheme:'full-time'}));
 assert.throws(()=>configuration({components:[['Assignment',10],['Midexam',20],['Class tests',10]]}));
 assert.throws(()=>configuration({components:[['Practical',20],['Project',20]]}));
 assert.throws(()=>configuration({components:[['Practical',10],['Project',20]]}));
 assert.equal(configuration({components:[['Assignment',10],['Midexam',10],['Practical',10]],verifiedSource:'synthetic verified fixture'}).reduce((n,a)=>n+a.weight,0),30);
});
test('recorded zeros are complete results and totals use actual points without rescaling',()=>{
 const recorded=scores=>configuration().map((c,i)=>assessmentRecord(c,scores[i]));
 for(const [scores,total] of [[[8,16,0,0],24],[[6,12,0,0],18],[[10,19,0,0],29],[[0,0,0,0],0]]){
  const records=recorded(scores),r=courseResults(records);assert.equal(r.totalCA,total);assert.equal(r.visibleCA,total);assert.equal(r.ready,true);assert.ok(records.every(a=>a.status==='available'&&a.contribution===a.score));
 }
 const r=courseResults(recorded([8,16,0,0]),50);assert.equal(r.finalMark,74);assert.equal(r.finalGrade,'B+');assert.deepEqual(r.finalExam,{score:50,weight:70,contribution:50});
 assert.equal(courseResults(recorded([10,20,0,0]),70).finalMark,100);assert.equal(courseResults(recorded([0,0,0,0]),0).finalMark,0);
});
test('missing marks stay separate from zero; maximums and missing-final inputs are validated',()=>{
 const records=configuration().map((c,i)=>assessmentRecord(c,i===1?null:0,i===1?'pending':'available'));const r=courseResults(records);assert.equal(r.ready,false);assert.equal(r.totalCA,null);assert.equal(r.visibleCA,0);assert.equal(records[1].contribution,null);
 assert.throws(()=>courseResults(records,50));assert.throws(()=>assessmentRecord({name:'Midexam',weight:20},0,'pending'));
 for(const [weight,score] of [[10,11],[20,21],[0,1],[10,-1],[10,1.5]])assert.throws(()=>assessmentRecord({name:'Assessment',weight},score));
 const complete=configuration().map(c=>assessmentRecord(c,0));for(const mark of [-1,71,1.5,'50'])assert.throws(()=>courseResults(complete,mark));
});
const period=(marks,extra={})=>({completed:true,completeCourseLoadVerified:true,courses:marks.map(finalMark=>({finalMark,finalGrade:grade(finalMark)})),...extra});
test('Clear Pass requires every registered completed course to pass',()=>{assert.equal(outcome(period([50,55,74,86])).code,'CP');assert.notEqual(outcome(period([49,55,74,86])).code,'CP');assert.equal(outcome(period([50,55],{completeCourseLoadVerified:false})).code,'limited');});
test('prescribed four/five course repetition thresholds do not assume arbitrary loads',()=>{assert.equal(outcome(period([49,49,60,60])).label,'Repeat Semester');assert.equal(outcome(period([49,49,60,60,60])).label,'Repeat Course');assert.equal(outcome(period([49,49,49,60,60])).label,'Repeat Semester');assert.equal(outcome(period([49,49,49,60,60,60])).label,'Repeat Course');});
test('discretionary progression and exclusion are never inferred from marks',()=>{
 const failed=period([30,30,30,30]);assert.equal(outcome(failed).code,'repeat-semester');
 assert.notEqual(outcome({...failed,boardDecision:'repeat-and-proceed'}).code,'repeat-and-proceed');
 assert.equal(outcome({...failed,boardDecision:'repeat-and-proceed',prerequisitesCleared:true}).label,'Repeat and Proceed');
 assert.equal(outcome({...failed,boardDecision:'proceed',prerequisitesCleared:true}).label,'Proceed');
 for(const decision of ['exclude-school','exclude-university']){assert.notEqual(outcome({...failed,boardDecision:decision}).code,decision);assert.equal(outcome({...failed,boardDecision:decision,exclusionConditionsVerified:true}).code,decision);}
});
test('unpublished, missing and explicitly not-examined results are distinct',()=>{assert.equal(outcome(period([50],{completed:false})).code,'unpublished');assert.equal(outcome(period([])).code,'unavailable');assert.equal(outcome({completed:true,courses:[{examStatus:'not-examined',finalMark:null}]}).code,'NE');assert.equal(outcome({completed:true,courses:[{finalMark:null}]}).code,'incomplete');});
