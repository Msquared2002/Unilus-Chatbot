const test=require('node:test'),assert=require('node:assert/strict');
const {undergraduateGrade:grade,assessmentConfiguration:configuration,semesterOutcome:outcome}=require('../services/undergraduateAcademicPolicy');
for(const [mark,expected] of [[0,'D'],[49,'D'],[50,'C'],[55,'C'],[56,'C+'],[60,'C+'],[61,'B'],[65,'B'],[66,'B+'],[68,'B+'],[74,'B+'],[75,'B+'],[76,'A'],[85,'A'],[86,'A+'],[100,'A+']])test(`undergraduate boundary ${mark} is ${expected}`,()=>assert.equal(grade(mark),expected));
test('invalid marks are rejected without silent rounding or coercion',()=>{for(const mark of [-1,101,85.5,NaN,null,'74'])assert.throws(()=>grade(mark),RangeError);});
test('verified default and distance components total 40; practical/project need evidence',()=>{
 const regular=configuration();assert.deepEqual(regular.map(a=>a.weight),[10,20,0,0,10]);assert.equal(configuration({scheme:'distance'}).reduce((n,a)=>n+a.weight,0),40);
 assert.throws(()=>configuration({components:[['Assignment',10],['Midexam',20]]}));
 assert.throws(()=>configuration({components:[['Practical',20],['Project',20]]}));
 assert.equal(configuration({components:[['Assignment',10],['Midexam',10],['Practical',20]],verifiedSource:'synthetic verified fixture'}).reduce((n,a)=>n+a.weight,0),40);
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
