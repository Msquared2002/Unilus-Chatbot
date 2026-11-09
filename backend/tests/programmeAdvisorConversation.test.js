const test=require('node:test'),assert=require('node:assert/strict');
const {tryAnswer}=require('../services/programmeAdvisorService');
const {store}=require('../services/programmeAdvisorState');
const cs='bachelor-of-science-in-computer-science',bit='bachelor-of-science-in-information-systems-and-technology';
const questions=[
 'Hi, I need help choosing a programme to study at UNILUS.',
 "I'm interested in technology, programming, and cybersecurity. What programmes would you recommend?",
 'Why would you recommend Computer Science for me?',
 "What's the difference between Computer Science and Information Systems and Technology?",
 'Which one would suit someone who prefers software development?',
 "What if I'm more interested in business systems and managing technology than writing software?",
 'What are the entry requirements for both programmes?',
 'Do I qualify if I have five O-Level credits, including English, Mathematics and Science?',
 'What other information would you need to determine whether I qualify?',
 'Forget about my grades for now. Which programme best matches my interests?',
 'What are the career opportunities for each programme?',
 "Based on everything I've told you, which programme would you recommend and why?"
];
test('complete twelve-turn advisor exchange retains scope while changing intent',()=>{
 const id='synthetic-advisor-journey-'+Date.now(),results=questions.map(q=>tryAnswer(q,id));
 for(const [i,r]of results.entries()){assert.ok(r,`turn ${i+1} routed to Advisor`);assert.doesNotMatch(r.answer,/additional_grade_information_required|missing_or_unrecognized|requirements_not_sufficiently_documented|undefined|\[object Object\]/);}
 for(const i of [3,4,5,6,7,8,9,10,11])assert.deepEqual(results[i].advisor.comparison.map(x=>x.programmeId),[cs,bit],`turn ${i+1} retains both programme references`);
 assert.match(results[4].answer,/software development preference.*Computer Science/i);
 assert.match(results[5].answer,/business systems preference.*Information Systems and Technology/i);
 assert.match(results[6].answer,/At least 5 credits/);
 assert.match(results[7].answer,/individual subject grades/i);
 assert.match(results[8].answer,/individual subject grades/i);
 for(const i of [3,4,5,6,9,10,11])assert.doesNotMatch(results[i].answer,/Eligibility:/i);
 assert.doesNotMatch(results[11].answer,/Development Studies|Economics|social interest/);
 assert.match(results[11].answer,/I recommend Information Systems and Technology/);
 store.clear(id);
});
test('new sessions and ambiguous references do not inherit another applicant profile',()=>{
 const a='synthetic-advisor-a-'+Date.now(),b='synthetic-advisor-b-'+Date.now();
 tryAnswer('Compare Computer Science and Information Systems and Technology',a);
 const r=tryAnswer('Which one is better for programming?',b);
 assert.match(r.answer,/Which two programmes/);assert.equal(store.get(b),null);
 store.clear(a);store.clear(b);
});
test('three explicit programmes remain scoped and unsupported names ask for evidence',()=>{
 const id='synthetic-advisor-three-'+Date.now();
 const r=tryAnswer('Compare Computer Science, Information Systems and Technology, and Bachelor of Business Administration',id);
 assert.equal(r.advisor.comparison.length,3);
 assert.match(r.answer,/Computer Science/);assert.match(r.answer,/Information Systems and Technology/);assert.match(r.answer,/Business Administration/);
 const unknown=tryAnswer('Compare Computer Science and Imaginary Robotics Degree',store.newId());
 assert.match(unknown.answer,/Which two programmes/);assert.doesNotMatch(unknown.answer,/Imaginary Robotics Degree is offered/);
 store.clear(id);
});
