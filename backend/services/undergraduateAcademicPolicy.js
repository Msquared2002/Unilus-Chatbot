// UNILUS handbook §§9.8, 9.10–9.17; grading webpage. See correction report.
const bands = Object.freeze([[86,'A+'],[76,'A'],[66,'B+'],[61,'B'],[56,'C+'],[50,'C'],[0,'D']]);
function undergraduateGrade(mark) {
    if (!Number.isInteger(mark) || mark < 0 || mark > 100) throw new RangeError('Final mark must be an integer from 0 to 100');
    return bands.find(([minimum]) => mark >= minimum)[1];
}
const schemes = Object.freeze({
    'full-time': [['Assignment 1',10],['Midexam 1',20],['Practical',0],['Project 1',0],['Class tests',10]],
    distance: [['Assignment 1',10],['Assignment 2',10],['Practical',0],['Project 1',0],['Residential class test',20]]
});
function assessmentConfiguration(configuration = {scheme:'full-time'}) {
    const entries = configuration.components || schemes[configuration.scheme];
    if (!entries || entries.some(([name,weight]) => !name || !Number.isFinite(weight) || weight < 0) || entries.reduce((n,[,w])=>n+w,0)!==40 || new Set(entries.map(([name])=>name)).size!==entries.length) throw new Error('Assessment weights must total 40');
    if (entries.some(([n,w])=>/practical|project/i.test(n)&&w>0) && !configuration.verifiedSource) throw new Error('Practical/project weighting requires verified course evidence');
    return entries.map(([name,weight])=>({name,weight}));
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
module.exports={undergraduateGrade,assessmentConfiguration,semesterOutcome};
