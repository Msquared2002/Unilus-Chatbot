const source={url:'https://www.exams-council.org.zm/wp-content/uploads/2026/04/2025-School-Certificate-Performance-Review-Report.pdf',section:'Table 1',page:9};
const labels=['Upper Distinction','Lower Distinction','Upper Merit','Lower Merit','Upper Credit','Lower Credit','Upper Satisfactory','Lower Satisfactory','Fail (Unsatisfactory)'];
function validate(value){return (typeof value==='number'&&Number.isInteger(value)&&value>=1&&value<=9)||(typeof value==='string'&&/^[1-9]$/.test(value));}
function classify(value){if(!validate(value))return null;const grade=Number(value);return {grade,classification:labels[grade-1],category:grade<=2?'distinction':grade<=4?'merit':grade<=6?'credit':grade<=8?'satisfactory':'fail',source};}
function meets(value,threshold){return validate(value)&&['distinction','merit','credit','satisfactory'].includes(threshold)&&Number(value)<={distinction:2,merit:4,credit:6,satisfactory:8}[threshold];}
function countSubjects(results,threshold='credit'){return new Set(results.filter(r=>meets(r.grade,threshold)).map(r=>r.subject)).size;}
module.exports={source,validate,classify,meets,countSubjects,isCredit:g=>meets(g,'credit'),isMerit:g=>meets(g,'merit'),isDistinction:g=>meets(g,'distinction')};
