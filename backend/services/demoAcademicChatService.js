function mean(values) { return values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10 : null; }
function tryAnswer(question, profile) {
    if(!profile || /\b(?:ticket|support)\b/i.test(question)) return null;
    const q=question.toLowerCase();
    const identity=/\b(?:what|which) programme.*(?:year|am i)|what year am i/i.test(q);
    const academic=/\b(?:my|i|which courses)\b/i.test(q) && /\b(?:ca|marks?|results?|perform\w*|grades?|assessment|best course|lowest)\b/i.test(q);
    if(!identity&&!academic)return null;
    let answer, period=profile.periods.find(p=>p.key===profile.activePeriod), records=[];
    const earlier=profile.semester===2?`${profile.year}-1`:`${profile.year-1}-2`;
    if(/last|previous/i.test(q))period=profile.periods.find(p=>p.key===earlier);
    const stage=q.match(/year\s+([1-4])\s+(?:semester|sem)\s+([12])/);
    if(stage)period=profile.periods.find(p=>p.key===`${stage[1]}-${stage[2]}`);
    if(identity) answer=`You are ${profile.name}, ${profile.studentNumber}, studying ${profile.programmeName}, Year ${profile.year}, Semester ${profile.semester}.`;
    else if(/compare/.test(q)) {
        const years=[...new Set([...q.matchAll(/(?:year|and)\s+([1-4])\b/g)].map(m=>+m[1]))];
        answer=(years.length?years:[profile.year-1,profile.year]).map(year=>{const courses=profile.periods.filter(p=>p.year===year&&p.completed).flatMap(p=>p.courses);return courses.length?`Year ${year}: simulated mean final mark ${mean(courses.map(c=>c.finalMark))}/100 across ${courses.length} observed course records from completed supported periods.`:`Year ${year}: no completed supported period is available; no performance is inferred.`;}).join('\n');
    } else if(!period) answer='Reliable course mapping for that academic period is unavailable. No course list or marks have been invented.';
    else if(/final|best course|last semester|previous semester/.test(q)) {
        if(!period.completed)answer='Final results are not published for this unfinished demonstration semester.';
        else {records=period.courses;const selected=/best/.test(q)?[...records].sort((a,b)=>b.finalMark-a.finalMark).slice(0,1):records;answer=`Year ${period.year}, Semester ${period.semester}:\n`+selected.map(c=>`${c.code} — ${c.name}: ${c.finalMark}/100, simulated grade ${c.finalGrade}`).join('\n');}
    } else {
        records=period.courses;
        let selected=records;
        if(/lowest/.test(q))selected=records.filter(c=>c.ready).sort((a,b)=>a.totalCA-b.totalCA).slice(0,1);
        if(/pending|not.*available/.test(q))selected=records.filter(c=>!c.ready);
        answer=selected.length?`${/lowest/.test(q)?'Lowest among fully available CA records only; partial records are excluded.\n':''}Year ${period.year}, Semester ${period.semester}:\n`+selected.map(c=>`${c.code} — ${c.name}: ${c.ready?`CA ${c.totalCA}/40`:`visible contributions ${c.visibleCA}/40 (partial)`}; ${c.assessments.filter(a=>a.status!=='available').length} pending or locked assessment(s).`).join('\n'):'There are no fully available CA records to rank, or no courses matching that assessment status.';
    }
    return {answer:'Fictional academic simulation — not university records.\n\n'+answer+'\n\n'+profile.policy,queryType:{isSimulatedAcademic:true},academic:{profileId:profile.id,periodKey:period?.key||null,courses:records},sources:[],resources:[],recommendedResources:[],suggestedActions:[],timetableMatches:0,usedFallback:false};
}
module.exports={tryAnswer,mean};
