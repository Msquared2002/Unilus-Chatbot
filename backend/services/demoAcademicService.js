const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { storageHeaders } = require('./storageCredentials');
const timetable = require('./timetableService');
const { toDisplayTimetableEntry } = require('./timetablePresentationService');
const catalogue = require('../../dummy-environment/js/demo-programmes').programmes;
const { ACADEMIC_MODEL_VERSION, EXAM_MAXIMUM, assessmentConfiguration, assessmentRecord, courseResults, semesterOutcome } = require('./undergraduateAcademicPolicy');
const ids = { BIT: 'bachelor-of-science-in-information-systems-and-technology', BCS: 'bachelor-of-science-in-computer-science', BSPH: 'bachelor-of-science-in-public-health', LLB: 'bachelor-of-laws' };
const locks = new Map();
const bitCurriculum=require('../data/bit-curriculum-v1.json');
const isFixed=user=>user?.role==='student'&&(user.username==='demo'||process.env.DEMO_FIXED_ACCOUNT&&user.username===process.env.DEMO_FIXED_ACCOUNT);
function curriculumMapping(){const periods={};for(const c of bitCurriculum.courses){const key=c.year+'-'+c.semester;(periods[key]||={key,year:c.year,semester:c.semester,courses:[]}).courses.push({...c});}return {code:'BIT',programmeId:bitCurriculum.programmeId,name:bitCurriculum.name,periods};}
function allowed(user) { return process.env.DEMO_ACADEMIC_ENABLED === 'yes' && user?.role === 'student' && String(process.env.DEMO_ACADEMIC_USERS || '').split(',').map(s => s.trim()).filter(Boolean).includes(user.username); }
function fail(message, status = 409) { return Object.assign(Error(message), { status }); }
function mappings() {
    const result = {};
    for (const row of timetable.getAll()) {
        const match = String(row.programme_code).match(/^(BIT|BCS|BSPH|LLB)([1-4])([12])$/);
        // Combined/ambiguous codes in the timetable are not separate verified courses.
        if (!match || !/^[A-Z]{2,6}\d{3}$/.test(String(row.course_code)) || !row.course_name) continue;
        const [, code, year, semester] = match, key = `${year}-${semester}`;
        const programme = result[code] ||= { code, programmeId: ids[code], name: catalogue.find(p => p.id === ids[code]).name, periods: {} };
        const period = programme.periods[key] ||= { key, year: +year, semester: +semester, courses: [] };
        if (!period.courses.some(c => c.code === row.course_code)) {
            const display = toDisplayTimetableEntry(row);
            const name = String(display.display_course_name || row.course_name)
                .replace(/\s+Group\s+[A-Z](?:\s*-\s*(?:LLB|ED))?\s*$/i,'')
                .replace(/^SVT[a-z]?\s+/i,'').replace(/\s+#\s*$/,'').trim();
            // A different code embedded in a title is an unresolved cross-listing.
            if (/\b[A-Z]{2,6}\s*\d{3}\b/.test(name) || /\b(?:field attachment|projects?|research|practical|seminars)\b/i.test(name)) continue;
            if (!period.courses.some(c=>c.name.toLowerCase()===name.toLowerCase())) period.courses.push({ code: row.course_code, name });
        }
    }
    for (const [code,programme] of Object.entries(result)) {
        for (const [key,period] of Object.entries(programme.periods)) if(period.courses.length<3) delete programme.periods[key];
        if(!Object.keys(programme.periods).length) delete result[code];
    }
    result.BIT=curriculumMapping();
    return result;
}
function integer(seed, label, min, max) { return min + crypto.createHash('sha256').update(seed + ':' + label).digest().readUInt32BE() % (max - min + 1); }
function generate(user, previous = null, options = {}) {
    const available = mappings(), codes = Object.keys(available), fixed=isFixed(user), seed = fixed?'luka-fictional-transcript-v1':crypto.randomBytes(32).toString('hex');
    if (!['keep', 'random', 'specific'].includes(options.mode || 'keep')) throw fail('Unsupported programme setting', 400);
    const code = fixed?'BIT':options.mode === 'random' ? codes[integer(seed, 'programme', 0, codes.length - 1)] : options.mode === 'specific' ? options.programme : previous?.programme || user.programme;
    if (!available[code]) throw fail('Reliable course mapping is unavailable for that programme. Choose a supported programme.', 422);
    const programme = available[code], choices = Object.values(programme.periods).sort((a,b) => a.year-b.year || a.semester-b.semester);
    const initial = !previous && choices.find(p => p.year === +user.year && p.semester === +user.semester);
    const active = (fixed?choices.find(p=>p.key==='3-2'):null) || initial || choices[integer(seed, 'period', 0, choices.length - 1)];
    const id = fixed?'luka-simulated-profile-v1':crypto.randomUUID();
    const profile = { id, seed, modelVersion:ACADEMIC_MODEL_VERSION, name: ['Lina','Tendo','Miro','Sena'][integer(seed,'name',0,3)] + ' Demo-' + ['River','Lake','Hill','Grove'][integer(seed,'surname',0,3)], studentNumber: 'DEMO-' + id.slice(0,8).toUpperCase(), programme: code, programmeId: programme.programmeId, programmeName: programme.name, year: active.year, semester: active.semester, activePeriod: active.key, periods: [], simulated: true,
        policy:'Fictional demonstration scheme: coursework 30 and examination 70; this differs from the published handbook.',
        mappingNotice:'Available timetable course identities only; full registration, attendance and prerequisite records are not available.' };
    for (const period of choices.filter(p => p.year*2+p.semester <= active.year*2+active.semester)) {
        const completed = period.key !== active.key;
        const courses = period.courses.map((course, i) => {
            const assessments = assessmentConfiguration(course.assessmentConfiguration).map(({name,weight},j) => {
                const scenario=(i+1)%3;
                const status = !weight || completed || scenario === 0 || j < 1 ? 'available' : scenario === 1 ? 'pending' : 'locked';
                const sample=integer(seed,period.key+course.code+name,0,100);
                const score = status === 'available' ? (weight===0||sample===0?0:integer(seed,period.key+course.code+name+'marks',Math.ceil(weight*.4),weight)) : null;
                return assessmentRecord({name,weight},score,status);
            });
            const examScore=completed?integer(seed,period.key+course.code+'exam',28,EXAM_MAXIMUM):null;
            return { ...course, assessments, ...courseResults(assessments,examScore) };
        });
        const record={ key: period.key, year: period.year, semester: period.semester, academicYear: new Date().getUTCFullYear() - (active.year-period.year), completed, completeCourseLoadVerified:false, courses };
        record.outcome=semesterOutcome(record);profile.periods.push(record);
    }
    if(fixed){Object.assign(profile,{fixed:true,transcriptVersion:'luka-fictional-v1',name:'Luka Hamududu',studentNumber:'BIT24240001',mode:'FT',curriculumVersion:bitCurriculum.version,curriculum:bitCurriculum.courses,registeredCourses:bitCurriculum.courses.filter(c=>c.year===3&&c.semester===2).map(c=>c.code),classGroup:null,mappingNotice:'Owner-provided curriculum; fictional fixed transcript, not official grades or verified class-group enrolment.'});for(const p of profile.periods)p.academicYear=2026-(3-p.year);}
    return profile;
}
async function object(user, value) {
    const key = crypto.createHash('sha256').update(user.username).digest('hex');
    if (process.env.DEMO_ACADEMIC_STORE_DIR) {
        if (process.env.NODE_ENV === 'production') throw fail('Production profiles require private durable Storage', 503);
        const file = path.join(process.env.DEMO_ACADEMIC_STORE_DIR, key + (isFixed(user)?'.fixed-luka-v1.json':'.json'));
        if (value === undefined) { try { return JSON.parse(await fs.readFile(file,'utf8')); } catch(e) { if(e.code==='ENOENT') return null; throw e; } }
        await fs.mkdir(path.dirname(file), { recursive: true }); const temp = file+'.'+crypto.randomUUID()+'.tmp';
        await fs.writeFile(temp, JSON.stringify(value), { mode: 0o600 }); await fs.rename(temp,file); return;
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_DOCUMENT_BUCKET) throw fail('Private demo profile storage is not configured',503);
    const url = new URL('/storage/v1/object/'+encodeURIComponent(process.env.SUPABASE_DOCUMENT_BUCKET)+'/demo-academics/v1/'+key+(isFixed(user)?'/fixed-luka-v1.txt':'/active.txt'),process.env.SUPABASE_URL);
    if (url.protocol !== 'https:') throw fail('Private Storage requires HTTPS',503);
    const r = await fetch(url,{method:value===undefined?'GET':'POST',headers:{...storageHeaders(),'Content-Type':'text/plain',...(value===undefined?{}:{'x-upsert':'true'})},...(value===undefined?{}:{body:JSON.stringify(value)}),signal:AbortSignal.timeout(30000)});
    if (value===undefined && r.status===404) return null;
    if(value===undefined&&r.status===400){const error=await r.json().catch(()=>({}));if(error.statusCode==='404'||error.error==='not_found')return null;throw fail('Private demo profile storage is unavailable',503);}
    if (!r.ok) throw fail('Private demo profile storage is unavailable',503);
    if (value===undefined) return r.json();
}
async function locked(user, fn) {
    if (!allowed(user)) throw fail('Fictional academic profiles are not enabled for this account',403);
    const prior = locks.get(user.username) || Promise.resolve();
    const task = prior.catch(()=>{}).then(fn); locks.set(user.username,task);
    try { return await task; } finally { if(locks.get(user.username)===task) locks.delete(user.username); }
}
async function load(user) {
    let profile = await object(user);
    if (!profile || isFixed(user)&&profile.transcriptVersion!=='luka-fictional-v1') { profile=generate(user); profile.sessionId=await require('./sessionOwnershipService').resolveSession(null,user); await object(user,profile); }
    const sid=await require('./sessionOwnershipService').resolveSession(profile.sessionId,user);
    if(sid!==profile.sessionId){profile.sessionId=sid;await object(user,profile);}
    return profile;
}
function publicProfile(profile,user) { const { seed, ...data } = profile; return { ...data, ...(profile.modelVersion!==ACADEMIC_MODEL_VERSION?{periods:[],requiresNewProfile:true}:{}), accountUsername:user.username }; }
// Non-mutating snapshot for cross-student offer validation; never nests profile locks.
async function existing(user){if(!allowed(user))return null;const p=await object(user);return p?publicProfile(p,user):null;}
async function get(user) { return locked(user,async()=>publicProfile(await load(user),user)); }
async function renew(user,options) { return locked(user,async()=>{
    const previous=await load(user);
    if(isFixed(user))throw fail('This fixed simulated profile cannot be randomized.',403);
    if(options.expectedProfileId!==previous.id) throw fail('The demo profile changed. Refresh before generating another profile.');
    const next=generate(user,previous,options); next.sessionId=await require('./sessionOwnershipService').resolveSession(null,user);
    await object(user,next);
    await require('./peerTutorService').recordChanged(user,next);
    require('./programmeAdvisorState').store.clear(previous.sessionId);
    require('./supportConversationService').reset(previous.sessionId);
    return publicProfile(next,user);
}); }
async function withChat(user, expected, requestedSession, fn) { return locked(user,async()=>{
    const profile=await load(user);
    if(profile.modelVersion!==ACADEMIC_MODEL_VERSION) throw fail('Choose New Profile to use the corrected assessment scheme.');
    if(expected!==profile.id || requestedSession && requestedSession!==profile.sessionId) throw fail('The demo profile changed. Refresh its academic context before retrying.');
    return fn(profile);
}); }
module.exports={existing,isFixed,allowed,mappings,generate,get,renew,withChat};
