function mean(values) { return values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10 : null; }
const cell = value => String(value).replace(/\|/g,'\\|').replace(/[\r\n]/g,' ');
const table = (heading,rows,codeOnly=false) => `| Course | ${heading} |\n| --- | --- |\n`+rows.map(([course,value])=>`| ${cell(course.code)}${codeOnly?'':' — '+cell(course.name)} | ${cell(value)} |`).join('\n');
const pending = course => course.assessments.filter(a=>a.status==='pending'||a.status==='locked');
function tryAnswer(question, profile) {
    if (!profile || /\b(?:ticket|support)\b/i.test(question)) return null;
    const q=question.toLowerCase();
    const identity=/\b(?:what|which) programme.*(?:year|am i)|what year am i/i.test(q);
    const academic=/(?:\b(?:my|i|which courses|which assessments|which subjects)\b.*\b(?:ca|marks?|results?|perform\w*|grades?|assessment\w*|best|lowest|highest|pending|attention|clear\w*)\b)|(?:compare.*results)/i.test(q);
    if (!identity && !academic) return null;
    let answer,period=profile.periods.find(p=>p.key===profile.activePeriod),records=[];
    const earlier=profile.semester===2?`${profile.year}-1`:`${profile.year-1}-2`;
    if (/last|previous/i.test(q)) period=profile.periods.find(p=>p.key===earlier);
    const stage=q.match(/year\s+([1-4])\s+(?:semester|sem)\s+([12])/);
    if (stage) period=profile.periods.find(p=>p.key===`${stage[1]}-${stage[2]}`);
    if (identity) answer=`You're studying ${profile.programmeName}, Year ${profile.year}, Semester ${profile.semester}. Student ID: ${profile.studentNumber}.`;
    else if (/compare/.test(q)) {
        const years=[...new Set([...q.matchAll(/(?:year|and)\s+([1-4])\b/g)].map(m=>+m[1]))];
        const completed=profile.periods.filter(p=>p.completed&&(!years.length||years.includes(p.year)));
        answer=completed.length?'Here are your available completed results:\n\n| Period | Courses passed |\n| --- | --- |\n'+completed.map(p=>`| Year ${p.year}, Semester ${p.semester} | ${p.courses.filter(c=>c.finalGrade&&c.finalGrade!=='D').length} of ${p.courses.length} |`).join('\n')+'\n\nOnly periods with available results are included.':'There are no completed results available to compare.';
        if(years.some(year=>!completed.some(p=>p.year===year)))answer+='\n\nSome requested years have no completed results available.';
    } else if (!period) answer='Results are unavailable for that period. Choose another available semester.';
    else {
        records=period.courses;const label=`**Year ${period.year}, Semester ${period.semester}**`;
        if (/clear|attention/.test(q)) {
            if(!period.completed)answer=label+'\n\nFinal results are not out yet. '+records.filter(c=>pending(c).length).length+' courses have pending assessments.';
            else {const failed=records.filter(c=>c.finalGrade==='D');answer=label+'\n\n'+period.outcome.label+'.';if(failed.length)answer+='\n\n'+table('Grade',failed.map(c=>[c,c.finalGrade]));if(period.outcome.code==='limited')answer+=' Full semester clearance cannot be confirmed from the available course list.';}
        } else if (/final|best course|last semester|previous semester/.test(q)) {
            if(!period.completed)answer=label+'\n\nFinal results are not published yet.';
            else {const selected=/best/.test(q)?[...records].sort((a,b)=>b.finalMark-a.finalMark).slice(0,1):records;answer=label+'\n\n'+table('Grade',selected.map(c=>[c,c.finalGrade]))+'\n\n'+period.outcome.label+'.';}
        } else if (/pending|not.*available/.test(q)) {
            const selected=records.filter(c=>pending(c).length);answer=label+'\n\n'+(selected.length?table('Pending assessment',selected.map(c=>[c,pending(c).map(a=>a.name+(a.status==='locked'?' (locked)':'')).join(', ')])):'All applicable assessments are available.');
        } else {
            let selected=records;const ranking=/lowest|highest/.test(q);
            if(ranking)selected=records.filter(c=>c.ready).sort((a,b)=>/highest/.test(q)?b.totalCA-a.totalCA:a.totalCA-b.totalCA).slice(0,1);
            answer=(ranking?label:`Here are your CA marks for Year ${period.year}, Semester ${period.semester}:`)+'\n\n'+(selected.length?table('CA',selected.map(c=>[c,c.ready?String(c.totalCA):'—']),true):'No complete CA results are available to rank yet.');
            if(ranking&&records.some(c=>!c.ready))answer+='\n\nOnly complete CA totals are ranked.';
            else if(records.some(c=>!c.ready))answer+='\n\nSome marks are awaiting upload. Would you like to see which assessments are pending?';
            else answer+='\n\nAll coursework marks are available.';
        }
    }
    return {answer,queryType:{isSimulatedAcademic:true},academic:{profileId:profile.id,periodKey:period?.key||null,courses:records},sources:[],resources:[],recommendedResources:[],suggestedActions:[],timetableMatches:0,usedFallback:false};
}
module.exports={tryAnswer,mean};
