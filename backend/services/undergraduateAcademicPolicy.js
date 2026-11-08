// Grade/progression rules: UNILUS handbook. Assessment split: owner-selected demo only.
const ACADEMIC_MODEL_VERSION = 4;
const CA_MAXIMUM = 30;
const EXAM_MAXIMUM = 70;
const bands = Object.freeze([[86,'A+'],[76,'A'],[66,'B+'],[61,'B'],[56,'C+'],[50,'C'],[0,'D']]);
function undergraduateGrade(mark) {
    if (!Number.isInteger(mark) || mark < 0 || mark > 100) throw new RangeError('Final mark must be an integer from 0 to 100');
    return bands.find(([minimum]) => mark >= minimum)[1];
}
const schemes = Object.freeze({
    'demo-portal': [['Assignment 1',10],['Midexam 1',20],['Practical',0],['Project 1',0]]
});
function assessmentConfiguration(configuration = {scheme:'demo-portal'}) {
    const entries = configuration.components || schemes[configuration.scheme];
    if (!entries || entries.some(([name,weight]) => !name || !Number.isInteger(weight) || weight < 0) || entries.reduce((n,[,w])=>n+w,0)!==CA_MAXIMUM || new Set(entries.map(([name])=>name)).size!==entries.length) throw new Error('Assessment weights must total 30');
    if (entries.some(([n,w])=>/practical|project/i.test(n)&&w>0) && !configuration.verifiedSource) throw new Error('Practical/project weighting requires verified course evidence');
    return entries.map(([name,weight])=>({name,weight}));
}
function assessmentRecord({name,weight}, score, status = 'available') {
    if (!Number.isInteger(weight) || weight<0 || weight>CA_MAXIMUM) throw new RangeError('Invalid assessment maximum');
    if (!['available','pending','locked'].includes(status)) throw new Error('Invalid assessment status');
    if (status==='available') {
        if (!Number.isInteger(score) || score<0 || score>weight) throw new RangeError('Assessment score exceeds its maximum');
    } else if (score!==null) throw new Error('Unavailable assessments must not contain a score');
    return {name,weight,status,score,contribution:score};
}
function courseResults(assessments, examScore = null) {
    if (assessments.reduce((n,a)=>n+a.weight,0)!==CA_MAXIMUM) throw new Error('Course CA maximum must be 30');
    assessments.forEach(a=>assessmentRecord(a,a.score,a.status));
    const visibleCA=assessments.reduce((n,a)=>n+(a.status==='available'?a.score:0),0);
    const ready=assessments.every(a=>a.status==='available');
    if (examScore!==null && (!Number.isInteger(examScore)||examScore<0||examScore>EXAM_MAXIMUM)) throw new RangeError('Examination score exceeds its maximum');
    if (examScore!==null && !ready) throw new Error('Final results require complete CA');
    const finalMark=examScore===null?null:visibleCA+examScore;
    return {visibleCA,totalCA:ready?visibleCA:null,ready,finalExam:examScore===null?null:{score:examScore,weight:EXAM_MAXIMUM,contribution:examScore},finalMark,finalGrade:finalMark===null?null:undergraduateGrade(finalMark)};
}
function semesterOutcome(period) {
    const result = (code,label,detail='')=>({code,label,detail});
    if (!period.completed) return result('unpublished','Results pending');
    const courses=period.courses;
    if (!courses.length) return result('unavailable','Results unavailable');
    if (courses.every(c=>c.examStatus==='not-examined')) return result('NE','Not Examined');
    if (courses.some(c=>!Number.isInteger(c.finalMark))) return result('incomplete','Results incomplete');
    const failed=courses.filter(c=>undergraduateGrade(c.finalMark)==='D').length;
    // An observed timetable is not a complete registration record.
    if (!period.completeCourseLoadVerified) return result('limited',failed?`${failed} course${failed===1?' requires':'s require'} attention`:'All available courses passed','Based on available results; a full semester decision requires the registered course load.');
    if (!failed) return result('CP','Clear Pass');
    // Never infer a Board/Senate decision or prerequisite clearance from marks.
    if (period.boardDecision==='exclude-school' && period.exclusionConditionsVerified) return result('exclude-school','Exclude School');
    if (period.boardDecision==='exclude-university' && period.exclusionConditionsVerified) return result('exclude-university','Exclude University');
    if (period.boardDecision==='repeat-and-proceed' && period.prerequisitesCleared===true) return result('repeat-and-proceed','Repeat and Proceed');
    if (period.boardDecision==='proceed' && period.prerequisitesCleared===true) return result('proceed','Proceed');
    if ((courses.length===4&&failed>=2)||(courses.length===5&&failed>=3)) return result('repeat-semester','Repeat Semester','Handbook §9.12; any exclusion still requires the relevant formal decision.');
    return result('repeat-course','Repeat Course','Progression remains subject to prerequisites and the Board of Studies.');
}
module.exports={ACADEMIC_MODEL_VERSION,CA_MAXIMUM,EXAM_MAXIMUM,undergraduateGrade,assessmentConfiguration,assessmentRecord,courseResults,semesterOutcome};
