const test=require('node:test');const assert=require('node:assert/strict');
const {catalogue}=require('../services/programmeCatalogueService');const {evaluateEligibility}=require('../services/programmeEligibilityService');
const b=catalogue.find(p=>p.id==='bachelor-of-business-administration');
test('current application catalogue excludes postgraduate recommendations',()=>{const r=require('../services/programmeAdvisorService').recommend({interests:['business'],results:[]});assert.ok(r.every(x=>x.programme.offeringStatus==='current_application_catalogue'&&x.programme.level==='undergraduate'));});
test('letter grades are not converted',()=>assert.equal(evaluateEligibility(b,[{subject:'english',grade:'A'}]).status,'additional_grade_information_required'));
test('explicit classifications meet only checked conditions',()=>assert.equal(evaluateEligibility(b,['english','mathematics','biology','history','geography'].map(subject=>({subject,grade:'credit'}))).status,'meets_checked_published_conditions'));
test('computer science merit condition differs from business rule',()=>{const p=catalogue.find(p=>p.id==='bachelor-of-science-in-computer-science');assert.equal(evaluateEligibility(p,[{subject:'mathematics',grade:'credit'}]).status,'does_not_meet_checked_condition');});
test('Law conflict prevents confident outcome',()=>assert.equal(evaluateEligibility(catalogue.find(p=>p.id==='bachelor-of-laws'),[]).status,'conflicting_requirements'));
