// Deterministic academic retrieval. State holds references, never a second transcript.
const contextService = require('./academicContextService');
const timetable = require('./timetableService');
const presentation = require('./timetablePresentationService');
const publications = require('./timetableNotificationService');
const { createStore } = require('./programmeAdvisorState');
const state = createStore({ max: 500, ttl: 30 * 60 * 1000 });
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const escape = s => String(s ?? 'Not listed').replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ');
const table = (columns, rows) => '| ' + columns.join(' | ') + ' |\n| ' + columns.map(() => '---').join(' | ') + ' |\n' + rows.map(r => '| ' + r.map(escape).join(' | ') + ' |').join('\n');
const mean = rows => require('./demoAcademicChatService').mean(rows.map(r=>r.finalMark));
function semesterStats(profile,keys=null){let previous=null;return profile.periods.filter(p=>p.completed&&p.courses.length&&p.courses.every(c=>Number.isInteger(c.finalMark)&&c.finalMark>=0&&c.finalMark<=100)&&(!keys||keys.includes(p.key))).sort((a,b)=>a.year-b.year||a.semester-b.semester).map(p=>{const average=p.courses.reduce((n,c)=>n+c.finalMark,0)/p.courses.length,change=previous===null?null:average-previous;previous=average;return {periodKey:p.key,year:p.year,semester:p.semester,count:p.courses.length,average,change};});}
function trendOf(stats){const changes=stats.slice(1).map(s=>s.change);return stats.length<2?'insufficient data':changes.every(n=>Math.abs(n)<1e-9)?'consistent':changes.every(n=>n>=0)?'improving':changes.every(n=>n<=0)?'declining':'fluctuating';}
const rounded=n=>Math.round(n*100)/100;

function localTime(now = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lusaka', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
    const date = Date.UTC(+parts.year, +parts.month - 1, +parts.day);
    return { date, weekday: new Date(date).getUTCDay(), minute: +parts.hour * 60 + +parts.minute + +parts.second / 60, iso: `${parts.year}-${parts.month}-${parts.day}` };
}
function language(text) {
    return text.toLowerCase().replace(/[’]/g, "'").replace(/\b(first|1st)\b/g, '1').replace(/\b(second|2nd)\b/g, '2').replace(/\b(third|3rd)\b/g, '3').replace(/\b(fourth|4th)\b/g, '4').replace(/-/g, ' ').replace(/\bsem\b/g, 'semester');
}
function selection(q, profile, previous) {
    const explicit = q.match(/\b([1-4])\s*year(?:\s*[, ]*([12])\s*semester)?/) || q.match(/\byear\s*([1-4])(?:\s*[, ]*semester\s*([12]))?/);
    const compact = q.match(/\b(?:bit|bsph|bcs|llb)?\s*([1-4])\.([12])\b/) || q.match(/\b(?:bit|bsph|bcs|llb)([1-4])([12])\b/);
    if (compact) return { year: +compact[1], semester: +compact[2] };
    if (explicit) return { year: +explicit[1], semester: explicit[2] ? +explicit[2] : null };
    const semester=q.match(/\bsemester\s*([12])\b/),years=[...new Set((previous?.periodKeys||[]).map(k=>+k[0]))];
    if(semester&&(previous?.selection?.year||years.length===1))return {year:previous?.selection?.year||years[0],semester:+semester[1]};
    if (/next year/.test(q)) return { year: profile.year + 1, semester: null };
    if (/last semester|previous semester|next semester/.test(q)) {
        const index = (profile.year - 1) * 2 + profile.semester - 1 + (/next semester/.test(q) ? 1 : -1);
        return { year: Math.floor(index / 2) + 1, semester: index % 2 + 1 };
    }
    if (/current semester|current results/.test(q)) return { year: profile.year, semester: profile.semester };
    return previous?.selection || null;
}
function cohortRows(context) {
    return timetable.getByProgrammeStage({ family: context.programme, year: context.year, semester: context.semester, mode: context.mode === 'PT' ? 'part_time' : context.mode === 'FT' ? 'full_time' : null }).filter(row => {
        const code = String(row.programme_code || '').toUpperCase().replace(/\s/g, '');
        if (context.mode === 'FT' && /-PT$/.test(code) || context.mode === 'PT' && !/-PT$/.test(code)) return false;
        return context.registeredCourses.includes(row.course_code);
    });
}
function schedule(context, { day = null, next = false, courseCode = null, now = new Date() } = {}) {
    const local = localTime(now);
    let excludedConflict = false;
    let rows = cohortRows(context).filter(row => {
        if (row.course_code === 'BIT301' && /decision support systems/i.test(row.course_name || '')) { excludedConflict = true; return false; }
        return !courseCode || row.course_code === courseCode;
    }).map(row => ({ ...presentation.toDisplayTimetableEntry(row), possibleGroup: Boolean(require('./timetableChangeService').group(row) && require('./timetableChangeService').group(row) !== context.group) }));
    // Known unrelated groups are excluded; unknown membership remains explicitly possible.
    if (context.group) rows = rows.filter(r => !r.possibleGroup);
    rows = presentation.harmonizeDisplayCourseNames(rows).filter(r => !day || r.day.toLowerCase() === day.toLowerCase());
    if (next) rows = rows.map(r => {
        const start = r.time.match(/^(\d{1,2}):(\d{2})/);
        if (!start) return { ...r, offset: Infinity };
        let offset = (days.indexOf(r.day) - local.weekday + 7) % 7;
        if (!offset && +start[1] * 60 + +start[2] < local.minute) offset = 7;
        return { ...r, offset: offset * 1440 + +start[1] * 60 + +start[2] - local.minute };
    }).filter(r => Number.isFinite(r.offset)).sort((a, b) => a.offset - b.offset || a.course_code.localeCompare(b.course_code));
    if(next&&rows.length){const earliest=rows[0].offset;rows=rows.filter(r=>r.offset===earliest).map(r=>({...r,listedDate:new Date(local.date+Math.floor((r.offset+local.minute)/1440)*86400000).toISOString().slice(0,10)}));}
    if(!next) rows.sort((a, b) => (days.indexOf(a.day) + 6) % 7 - (days.indexOf(b.day) + 6) % 7 || a.time.localeCompare(b.time) || a.course_code.localeCompare(b.course_code));
    return { rows, local, excludedConflict };
}
function courseReference(q,profile){
    const explicit=q.match(/\b[a-z]{2,6}\d{3}\b/)?.[0]?.toUpperCase();if(explicit)return {code:explicit,choices:[]};
    const courses=profile?.curriculum||profile?.periods?.flatMap(p=>p.courses)||[];
    const words=q.replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>=3&&!['what','which','have','today','tomorrow','classes','class','lecture','course','courses','next','show','year','semester'].includes(w));
    const candidates=[...new Map(courses.map(c=>[c.code,c])).values()].map(c=>{const terms=c.name.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>=3&&!['and','the','for','with'].includes(w));return {course:c,score:new Set(terms.filter(t=>words.some(w=>t===w||w.length>=3&&t.startsWith(w)))).size};}).filter(c=>c.score>=2);
    const best=Math.max(0,...candidates.map(c=>c.score)),choices=candidates.filter(c=>c.score===best).map(c=>c.course);
    return {code:choices.length===1?choices[0].code:null,choices:choices.length>1?choices:[]};
}
function otherOwner(question, profile) {
    if (!/results?|marks?|grades?|transcript|timetable|records?/.test(question)) return false;
    if (/\b(?:another|someone else's|other student|impersonate)\b|\b(?:his|her|their) (?:results|grades|marks)|\bresults for (?:student|user)\b/.test(question)) return true;
    const number = question.match(/\b[a-z]{2,6}\d{6,}\b/);
    if (number && number[0].toLowerCase() !== profile?.studentNumber?.toLowerCase()) return true;
    const possessive = question.match(/\b([a-z]+)'s\b.*\b(?:results|marks|grades|transcript)/);
    return Boolean(possessive && !['what','who','how','it','that'].includes(possessive[1]) && !profile?.name.toLowerCase().split(' ').includes(possessive[1]));
}
function reply(answer, profile, kind, data = {}) {
    return { answer: answer + (profile ? '\n\nSimulated demonstration records, not an official university transcript.' : ''), queryType: { isSimulatedAcademic: Boolean(profile), isPersonalizedAcademic: true, ...(profile?{entities:{programme:profile.programme,year:profile.year,semester:profile.semester}}:{}) }, academic: profile ? { profileId: profile.id, kind, ...data } : undefined, sources: [], resources: [], recommendedResources: [], suggestedActions: [], timetableMatches: data.sessions?.length || 0, usedFallback: false };
}

async function tryAnswer(question, { user, profile, sessionId, now = new Date() }) {
    const q = language(question), key = sessionId;
    if(!profile||user?.role!=='student'){state.clear(key);return null;}
    const stored = state.get(key);
    const previous = stored?.owner === user?.username && stored?.profileId === profile?.id && stored?.modelVersion === profile?.modelVersion ? stored : null;
    const self = /\b(?:my|i)\b|am i|me my/.test(q);
    const profileIntent=/\b(?:my (?:academic|student) profile|what programme am i studying|what year am i in)\b/.test(q);
    const academicTerms = /\b(?:results?|performance|marks?|courses?|subjects?|curriculum|degree|programme|semester|lecture|classes|class|timetable|notifications?|ticket)\b/.test(q);
    const allSemesters=/\b(?:all|every|each)\s+(?:completed\s+)?semesters?\b/.test(q);
    const trendIntent=allSemesters||/\b(?:improv\w*|regress\w*|declin\w*|consistent|trend)\b/.test(q)&&(self||/academic|semester/.test(q));
    const semesterRank=/\bsemester\b.*\b(?:strongest|weakest|best|worst|highest|lowest)\b|\b(?:strongest|weakest|best|worst|highest|lowest)\b.*\bsemester\b/.test(q)&&!/\b(?:strongest|weakest|best|worst|highest|lowest)\s+(?:course|subject|mark|grade)\b/.test(q);
    const pasted=require('./conversationService').pastedUniversityMarks(question)||['results','ca'].includes(previous?.kind)&&!/^Advisor:|grade ?12|ecz|gce|o[ -]?level|admission|school certificate/i.test(question)&&require('./applicantResultParser').extract(question).length>0;
    const follow = previous && (allSemesters||semesterRank||/individual.*(?:marks|courses)|semester\s*[12]\s*(?:marks|results)|\b(?:which semester|better|highest|lowest|worst|best|average|where is it|who teaches|who(?:'s| is)? teaching|what time|and (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|that course|its exam|exam mark|examination mark)\b/.test(q)||previous.awaitingCourse&&/^[a-z]{2,6}\d{3}[.!]?$/.test(q));
    if (otherOwner(q, profile)) return reply('I can only retrieve the signed-in student’s own academic records. I cannot inspect another student’s private records.', null, 'refusal');
    // Preserve public tuition/advisor/support/map/general knowledge routing.
    if (/\b(?:choos\w*|recommend|interests?|career|grade ?12|ecz|gce|school certificate|qualif\w*|eligib\w*|fees?|tuition|scholarships?|apply|admission|requirements|recommend|choose a programme|create a ticket|report an issue|campus map)\b/.test(q)) { state.clear(key); return null; }
    const supportIssue=/\b(?:create|submit|open|raise|report)\b.*\bticket\b|\b(?:support|portal|problem|issue|cannot|can't)\b/.test(q);
    if(supportIssue&&!/(?:reply|replied|new|unread|recent).*ticket|ticket.*(?:reply|replied)|notifications?/.test(q)){state.clear(key);return null;}
    const notificationIntent = /(?:classes|timetable).*(?:changed|updates)|(?:changed|updates).*timetable|(?:new|unread|recent) notifications?|(?:reply|replied).*my ticket|my ticket.*(?:reply|replied)/.test(q);
    const reference=courseReference(q,profile);
    const timetableIntent = (/\b(?:timetable|lectures?|classes|next class)\b/.test(q)||(reference.code||reference.choices.length)&&/today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday/.test(q)) && (self || /next lecture|my next|and (?:monday|tuesday|wednesday|thursday|friday)/.test(q)) || previous?.kind === 'timetable' && follow;
    const coursesIntent = academicTerms && /\b(?:courses?|subjects?|studying|study|take|taking|attending|curriculum)\b/.test(q) && (self || /show me|show .*year|fourth year/.test(question.toLowerCase()));
    const progressIntent = self && /how far|how many.*complet|what remains|which semester|current.*semester/.test(q);
    const legacyCA = /\bca\b|assessment|pending|clear.*semester|subjects require attention|final results/.test(q) && !/final exam/.test(q);
    const resultsIntent = trendIntent||semesterRank||pasted||!legacyCA && ((self && /results?|performance|perform|transcript|academic (?:history|records)|average mark|best course|worst|highest mark|lowest mark|final exam|exam(?:ination)? (?:mark|score)|pass.*previous|grades/.test(q)) || ['results','ca'].includes(previous?.kind) && follow);
    if(!previous&&/^which semester.*better|^which course.*(?:highest|lowest|worst|best)/.test(q))return reply('Which academic year or semesters would you like to use? Please specify the period; there is no current academic follow-up context.',user?.role==='student'?profile:null,'clarification');
    if (!profileIntent && !notificationIntent && !timetableIntent && !coursesIntent && !progressIntent && !resultsIntent) { state.clear(key); return null; }
    if (!profile || user?.role !== 'student') return { ...reply('Sign in with an enabled student account to view your own simulated academic information.', null, 'sign-in'), signInRequired: true };
    if (!await require('./sessionOwnershipService').owns(sessionId, user)) return reply('This academic conversation is unavailable. Start your own signed-in conversation.', null, 'refusal');
    const namedProgramme=q.match(/\b(bit|bsph|bcs|llb)(?:\s*[1-4][. ]?[12])?\b/)?.[1];
    if(namedProgramme&&namedProgramme.toUpperCase()!==profile.programme)return reply('Your stored academic profile is '+profile.programmeName+'. I cannot present another programme’s records as your personal results.',profile,'clarification');
    const context = contextService.fromProfile(profile, user);
    if(profileIntent)return reply(profile.name+' — '+profile.programmeName+'. Year '+profile.year+', Semester '+profile.semester+'. Student number: '+profile.studentNumber+'.',profile,'profile');
    const save = (kind, extra = {}) => state.set(key, { owner: user.username, profileId: profile.id, modelVersion: profile.modelVersion, kind, ...extra });
    if(pasted){save('results',{periodKeys:semesterStats(profile).map(p=>p.periodKey)});return reply('These appear to be university course results, not Grade 12 admissions results. Pasted marks do not change your stored simulated transcript. I can show your completed semesters, compare their means, or analyse your academic trend. Which would you like?',profile,'provided-results');}
    if(trendIntent||semesterRank){
        const stats=semesterStats(profile,semesterRank&&previous?.periodKeys?previous.periodKeys:null),keys=stats.map(s=>s.periodKey);save('results',{periodKeys:keys,selection:null});
        if(semesterRank){const low=/lowest|worst|weakest/.test(q),value=stats.length?(low?Math.min(...stats.map(s=>s.average)):Math.max(...stats.map(s=>s.average))):null,winners=stats.filter(s=>s.average===value),courses=profile.periods.filter(p=>winners.some(s=>s.periodKey===p.key)).flatMap(p=>p.courses.map(c=>({...c,periodKey:p.key})));return reply(winners.length?(low?'Lowest':'Strongest')+' completed semester mean'+(winners.length>1?' (tie)':'')+': '+winners.map(s=>'Year '+s.year+', Semester '+s.semester+' — '+rounded(s.average)).join('; ')+'.\n\n'+table(['Period','Course','Final mark'],courses.map(c=>[c.periodKey,c.code+' — '+c.name,c.finalMark]))+'\nAll listed courses contributed equally to each arithmetic mean; this is not official GPA.':'No fully graded completed semester is available.',profile,'semester-ranking',{semesters:winners,courses,periodKeys:winners.map(s=>s.periodKey)});}
        const trend=trendOf(stats),explanation={improving:'Chronological semester means never fell and at least one rose.',declining:'Chronological semester means never rose and at least one fell.',fluctuating:'Chronological semester means rose in some transitions and fell in others.',consistent:'All available semester means are equal.','insufficient data':'At least two fully graded completed semesters are needed to assess a trend.'}[trend];
        const answer='Completed simulated semester trend:\n\n'+(stats.length?table(['Period','Courses','Unweighted mean final mark','Change from previous'],stats.map(s=>['Year '+s.year+', Semester '+s.semester,s.count,rounded(s.average),s.change===null?'—':rounded(s.change)])):'No fully graded completed semesters are available.')+'\n\nClassification: '+trend+'. '+explanation+(stats.length>1?' Net change from first to last: '+rounded(stats.at(-1).average-stats[0].average)+' marks.':'')+'\nIncomplete or ungraded semesters are excluded. These are unweighted arithmetic means of stored final marks, not official GPA.';
        return reply(answer,profile,'trend',{semesters:stats,trend,periodKeys:keys});
    }
    if (notificationIntent) {
        // Read existing events only. Chat does not settle/create override lifecycle events.
        const [tickets, changes] = await Promise.all([require('./ticketNotificationService').inbox(user), publications.inbox(user, context)]);
        const onlyChanges = /classes|timetable/.test(q), items = onlyChanges ? changes.items : /ticket/.test(q) ? tickets.items : [...tickets.items, ...changes.items];
        items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||String(b.id).localeCompare(String(a.id)));
        const unread = onlyChanges?changes.unreadCount:/ticket/.test(q)?tickets.unreadCount:tickets.unreadCount+changes.unreadCount;
        save('notifications');
        return reply(`You have ${unread} unread updates. Showing ${items.length} recent eligible events.\n\n` + (items.length ? items.slice(0, 8).map(i => `- ${i.read ? 'Read' : 'Unread'}: ${i.message}`).join('\n') : 'No eligible updates are available. Unknown class-group membership can limit timetable alerts.'), profile, 'notifications', { notifications: items.slice(0, 8).map(i => ({ id: i.id, read: i.read, category: i.category, message: i.message })), unreadCount: unread });
    }
    if (timetableIntent) {
        if(profile.programme==='BCS')return reply('Personal timetable matching is unavailable because BCS has an unresolved catalogue/timetable programme-name conflict. I will not equate Cyber Security with Computer Science.',profile,'timetable',{sessions:[],calendarVerified:false});
        const requestedStage=selection(q,profile,null);
        if(requestedStage&&(requestedStage.year!==profile.year||requestedStage.semester&&requestedStage.semester!==profile.semester))return reply('Your current registered timetable context is Year '+profile.year+', Semester '+profile.semester+'. Historical or future personal timetable registration for the requested period is unavailable.',profile,'timetable',{sessions:[],calendarVerified:false});
        await publications.refreshAccepted(true);
        const publication = await publications.latest();
        context.timetablePublicationId=publication?.id||null;
        const local = localTime(now), namedDay = days.find(d => q.includes(d.toLowerCase()));
        const next = /next.*(?:lecture|class)|(?:lecture|class).*next/.test(q) || previous?.kind === 'timetable' && follow && previous.next;
        const day = /tomorrow/.test(q) ? days[(local.weekday + 1) % 7] : /today/.test(q) ? days[local.weekday] : namedDay || (follow?previous?.day:null) || null;
        if(reference.choices.length){save('timetable',{next,day,awaitingCourse:true});return reply('Which course do you mean? Please specify a code: '+reference.choices.map(c=>c.code+' — '+c.name).join('; '),profile,'clarification');}
        const courseCode=reference.code||(follow?previous?.courseCode:null);
        const result = schedule(context, { day, next, courseCode, now });
        save('timetable', { next, courseCode, day });
        let answer = next ? 'Next listed lecture candidate(s), not confirmed attendance' : `Your recurring timetable${day ? ' for ' + day : ' for this week'}`;
        answer += ` (Africa/Lusaka, local date ${local.iso}).\n\n`;
        answer += result.rows.length ? table(['Course', 'Day', 'Time', 'Venue', 'Lecturer', 'Qualification'], result.rows.slice(0, 30).map(r => [r.course_code + ' — ' + r.display_course_name, r.day+(r.listedDate?' ('+r.listedDate+')':''), r.time, r.display_venue_name, r.display_lecturer_name, [r.possibleGroup ? 'Possible group-specific session; membership unknown' : 'Profile/course matched', r.simulatedOverride ? 'Simulated temporary override' : ''].filter(Boolean).join('; ')])) : 'No matching sessions are listed in the available timetable; this does not prove that no class exists.';
        answer += '\n\nThis is a recurring weekly listing. Term dates, holidays and cancellations are not verified, so attendance on a specific date is not confirmed.';
        if(!context.mode)answer+='\nYour study mode is not recorded; standard-cohort listings are candidates, not verified full-time registration.';
        if (result.excludedConflict) answer += '\nA BIT301 source-title conflict was excluded rather than treated as the registered E-Business course.';
        if (result.rows.length > 30) answer += '\nShowing the first 30 matching sessions.';
        return reply(answer, profile, 'timetable', { sessions: result.rows.slice(0, 30), publicationId: publication?.id || null, calendarVerified: false, timeZone: 'Africa/Lusaka' });
    }
    if(previous?.kind==='ca'&&follow&&!/final|results|exam/.test(q)){
        const period=profile.periods.find(p=>p.key===previous.periodKey),courses=period?.courses.filter(c=>Number.isInteger(c.totalCA))||[];
        state.set(key,previous);
        let answer;if(!courses.length)answer='No complete CA totals are available for that period.';
        else if(/average/.test(q))answer='The unweighted arithmetic mean of '+courses.length+' complete CA totals is '+require('./demoAcademicChatService').mean(courses.map(c=>c.totalCA))+'. Missing totals are excluded.';
        else if(/highest|lowest|best|worst/.test(q)){const extreme=/lowest|worst/.test(q)?Math.min(...courses.map(c=>c.totalCA)):Math.max(...courses.map(c=>c.totalCA));answer='Year '+period.year+', Semester '+period.semester+' CA totals:\n'+table(['Course','CA'],courses.filter(c=>c.totalCA===extreme).map(c=>[c.code,c.totalCA]));}
        else answer='Please specify the other period and whether you want CA totals or final results compared.';
        return reply(answer,profile,'ca',{periodKey:period?.key});
    }
    if (progressIntent) {
        const historical = profile.periods.filter(p => p.completed).flatMap(p => p.courses), marks = historical.filter(c => Number.isInteger(c.finalMark));
        const passed = marks.filter(c => c.finalGrade !== 'D').length;
        save('progress');
        return reply(`You are in Year ${profile.year}, Semester ${profile.semester}. Your record lists ${historical.length} historical course records: ${passed} passed, ${marks.length - passed} below the existing pass threshold, and ${historical.length - marks.length} without final marks. You have ${context.registeredCourses.length} current course references${profile.curriculum ? ' and ' + profile.curriculum.filter(c => c.year * 2 + c.semester > profile.year * 2 + profile.semester).length + ' future curriculum courses' : '; complete future curriculum is unavailable'}. This does not establish graduation eligibility or official progression.`, profile, 'progress');
    }
    let chosen = selection(q, profile, follow?previous:null);
    if (coursesIntent && !resultsIntent) {
        let courses, label;
        if (chosen) {
            const future = chosen.year * 2 + (chosen.semester || 1) > profile.year * 2 + profile.semester;
            courses = future ? profile.curriculum?.filter(c => c.year === chosen.year && (!chosen.semester || c.semester === chosen.semester)) : profile.periods.filter(p => p.year === chosen.year && (!chosen.semester || p.semester === chosen.semester)).flatMap(p => p.courses.map(c => ({ ...c, year: p.year, semester: p.semester })));
            label = future ? 'Planned curriculum, not confirmed future registration' : chosen.year===profile.year&&chosen.semester===profile.semester ? 'Current simulated course references' : 'Stored simulated course records by period; current entries are not completed results';
        } else {
            courses = profile.periods.find(p => p.key === profile.activePeriod)?.courses.filter(c => context.registeredCourses.includes(c.code));
            label = profile.fixed ? 'Current simulated registrations' : 'Current simulated course references; complete registration is not verified';
        }
        save('courses', { selection: chosen });
        return reply(label + ':\n\n' + (courses?.length ? table(['Course', 'Name', 'Period'], courses.map(c => [c.code, c.name, `Year ${c.year || profile.year}, Semester ${c.semester || profile.semester}`])) : 'This information is unavailable in your stored profile/curriculum. No course list is inferred from timetable attendance.'), profile, 'courses', { courses: courses || [], selection: chosen });
    }
    if (resultsIntent) {
        if(/\b[a-z]{2,6}\d{3}\b/.test(q)&&!/year|semester|\b[1-4]\.[12]\b/.test(q))chosen=null;
        if (!chosen && !/previous courses|compare|all|best|worst|average|highest|lowest|exam|transcript|academic (?:history|records)/.test(q)) {
            const last = profile.periods.filter(p => p.completed).at(-1);
            if (last) chosen = { year: last.year, semester: last.semester };
        }
        let periods = profile.periods.filter(p => p.completed && (!chosen || p.year === chosen.year && (!chosen.semester || p.semester === chosen.semester)));
        const years = [...q.matchAll(/(?:year|and)\s*([1-4])|([1-4])\s*year/g)].map(m => +(m[1] || m[2]));
        if (/compare/.test(q) && years.length) { periods = profile.periods.filter(p => p.completed && years.includes(p.year)); chosen = null; }
        if (follow && previous?.periodKeys && !/\b[a-z]{2,6}\d{3}\b|\byear\b|\bsemester\b|\b[1-4]\.[12]\b/.test(q)) periods = profile.periods.filter(p => p.completed && previous.periodKeys.includes(p.key));
        const code = q.match(/\b[a-z]{2,6}\d{3}\b/)?.[0]?.toUpperCase() || (follow ? previous?.courseCode : null);
        const all = periods.flatMap(p => p.courses.map(c => ({ ...c, periodKey: p.key })));
        let rows = all.filter(c => Number.isInteger(c.finalMark) && (!code || c.code === code));
        let answer;
        if (!rows.length) answer = 'Final results are unavailable or unreleased for that course/period. Future curriculum contains no completed grades.';
        else if (/better|compare/.test(q)) {
            const stats = periods.map(p => ({ period: p, average: mean(p.courses.filter(c => Number.isInteger(c.finalMark))) })).filter(s => s.average !== null);
            const sorted = [...stats].sort((a, b) => b.average - a.average);
            answer = 'Available simulated semester results:\n\n' + table(['Period', 'Arithmetic mean final mark'], stats.map(s => [`Year ${s.period.year}, Semester ${s.period.semester}`, s.average]));
            answer += sorted.length > 1 && sorted[0].average !== sorted[1].average ? `\n\nYear ${sorted[0].period.year}, Semester ${sorted[0].period.semester} has the highest mean among these periods.` : '\n\nThere is no unique better semester among the available periods.';
            if(stats.length===2)answer+='\nDifference between these semester means: '+Math.round(Math.abs(stats[0].average-stats[1].average)*10)/10+' marks; '+(stats[1].average<stats[0].average?'the second is lower.':stats[1].average>stats[0].average?'the second is higher.':'the means are equal.');
            if(years.length>1){const values=[...new Set(years)].map(year=>{const records=periods.filter(p=>p.year===year).flatMap(p=>p.courses).filter(c=>Number.isInteger(c.finalMark));return {year,count:records.length,mean:mean(records)};}).filter(y=>y.mean!==null);answer+='\n\nYear summaries:\n'+table(['Year','Available courses','Arithmetic mean final mark'],values.map(v=>[v.year,v.count,v.mean]));}
            answer += '\nThis is an unweighted arithmetic mean of available final marks, not GPA or a credit-weighted official average.';
        } else if (/average/.test(q)&&!/individual|courses.*marks|marks.*courses/.test(q)) answer = `The unweighted arithmetic mean of ${rows.length} available final marks is ${mean(rows)}. No course-credit weights or GPA are assumed.`;
        else if (/final exam|exam(?:ination)? (?:mark|score)/.test(q)) answer = table(['Course', 'Final examination points', 'Maximum'], rows.map(c => [c.code, c.finalExam?.score ?? 'Unavailable', c.finalExam?.weight ?? 'Unavailable']));
        else if (/pass.*(?:all|previous)|all.*pass/.test(q)) answer = `${rows.filter(c => c.finalGrade !== 'D').length} of ${rows.length} available final results meet the existing pass threshold. ${all.length - rows.length} records are outside this calculation or lack final marks. Historical status alone does not establish a pass.`;
        else {
            if (/highest|best|lowest|worst/.test(q)) { const extreme = /lowest|worst/.test(q) ? Math.min(...rows.map(c => c.finalMark)) : Math.max(...rows.map(c => c.finalMark)); rows = rows.filter(c => c.finalMark === extreme); }
            answer = table(['Period', 'Course', 'Final mark', 'Grade'], rows.map(c => [`Year ${c.periodKey[0]}, Semester ${c.periodKey[2]}`, c.code + ' — ' + c.name, c.finalMark, c.finalGrade]));
        }
        save('results', { selection: chosen, periodKeys: periods.map(p => p.key), courseCode: code||(/highest|lowest|best|worst/.test(q)&&rows.length===1?rows[0].code:null) });
        return reply(answer, profile, 'results', { courses: rows, periodKeys: periods.map(p => p.key) });
    }
    return null;
}
function rememberLegacy(user,profile,sessionId,question,result){if(!user||!profile||!result.academic?.periodKey)return;const periodKey=result.academic.periodKey;state.set(sessionId,{owner:user.username,profileId:profile.id,modelVersion:profile.modelVersion,kind:/ca|assessment|pending/i.test(question)?'ca':'results',periodKey,periodKeys:[periodKey],selection:{year:+periodKey[0],semester:+periodKey[2]}});}
function rememberBrief(user,profile,sessionId,reference){state.set(sessionId,{owner:user.username,profileId:profile.id,modelVersion:profile.modelVersion,kind:'timetable',...reference});}
function reminderVenue(user,profile,sessionId,now=new Date()){const previous=state.get(sessionId);if(!profile||previous?.owner!==user?.username||previous.profileId!==profile.id||previous.kind!=='timetable')return null;const context=contextService.fromProfile(profile,user);if(!context)return null;const rows=schedule(context,{day:previous.day,next:!!previous.next,courseCode:previous.courseCode,now}).rows;const venues=[...new Set(rows.map(r=>r.display_venue_name||r.venue_name).filter(v=>v&&v!=='Not listed'))];return venues.length===1?venues[0]:null;}
module.exports = {rememberBrief,reminderVenue, rememberLegacy,courseReference,tryAnswer, localTime, schedule, selection, language, clear: sessionId => state.clear(sessionId) };
