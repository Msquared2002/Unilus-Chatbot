const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { storageHeaders } = require('./storageCredentials');
const timetable = require('./timetableService');
const { toDisplayTimetableEntry } = require('./timetablePresentationService');
const catalogue = require('../../dummy-environment/js/demo-programmes').programmes;
const ids = { BIT: 'bachelor-of-science-in-information-systems-and-technology', BCS: 'bachelor-of-science-in-computer-science', BSPH: 'bachelor-of-science-in-public-health', LLB: 'bachelor-of-laws' };
const locks = new Map();
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
            period.courses.push({ code: row.course_code, name: display.display_course_name || row.course_name });
        }
    }
    return result;
}
function integer(seed, label, min, max) { return min + crypto.createHash('sha256').update(seed + ':' + label).digest().readUInt32BE() % (max - min + 1); }
function generate(user, previous = null, options = {}) {
    const available = mappings(), codes = Object.keys(available), seed = crypto.randomBytes(32).toString('hex');
    if (!['keep', 'random', 'specific'].includes(options.mode || 'keep')) throw fail('Unsupported programme setting', 400);
    const code = options.mode === 'random' ? codes[integer(seed, 'programme', 0, codes.length - 1)] : options.mode === 'specific' ? options.programme : previous?.programme || (available[user.programme] ? user.programme : 'BIT');
    if (!available[code]) throw fail('Reliable course mapping is unavailable for that programme. Choose a supported programme.', 422);
    const programme = available[code], choices = Object.values(programme.periods).sort((a,b) => a.year-b.year || a.semester-b.semester);
    const initial = !previous && choices.find(p => p.year === +user.year && p.semester === +user.semester);
    const active = initial || choices[integer(seed, 'period', 0, choices.length - 1)];
    const id = crypto.randomUUID();
    const profile = { id, seed, name: ['Lina','Tendo','Miro','Sena'][integer(seed,'name',0,3)] + ' Demo-' + ['River','Lake','Hill','Grove'][integer(seed,'surname',0,3)], studentNumber: 'DEMO-' + id.slice(0,8).toUpperCase(), programme: code, programmeId: programme.programmeId, programmeName: programme.name, year: active.year, semester: active.semester, activePeriod: active.key, periods: [], simulated: true, policy: 'Fictional demonstration: four assessments contribute up to 10 points each (CA /40), exam /60. Grade bands A 75+, B 65+, C 55+, D 45+, E below 45 are simulation rules only. No official GPA, pass or progression decision.', mappingNotice: 'Observed courses from the indexed timetable, not a complete official curriculum. Unmapped periods and ambiguous programme mappings are unavailable.' };
    for (const period of choices.filter(p => p.year*2+p.semester <= active.year*2+active.semester)) {
        const completed = period.key !== active.key;
        const courses = period.courses.map((course, i) => {
            const assessments = ['Assignment 1','Midexam 1','Practical','Project 1'].map((name,j) => {
                const scenario=(i+1)%3;
                const status = completed || scenario === 0 || j < 2 ? 'available' : scenario === 1 ? 'pending' : 'locked';
                const score = status === 'available' ? integer(seed,period.key+course.code+name,42,96) : null;
                return { name, weight: 10, status, score, contribution: score === null ? null : Math.round(score)/10 };
            });
            const visible = assessments.filter(a => a.status === 'available'), ca = Math.round(visible.reduce((n,a) => n+a.contribution,0)*10)/10;
            const examScore=completed?integer(seed,period.key+course.code+'exam',40,96):null;
            const finalExam=completed?{score:examScore,weight:60,contribution:Math.round(examScore*6)/10}:null;
            const finalMark = completed ? Math.round(ca + finalExam.contribution) : null;
            return { ...course, assessments, visibleCA: ca, totalCA: visible.length === 4 ? ca : null, ready: visible.length === 4, finalExam, finalMark, finalGrade: finalMark === null ? null : finalMark>=75?'A':finalMark>=65?'B':finalMark>=55?'C':finalMark>=45?'D':'E' };
        });
        profile.periods.push({ key: period.key, year: period.year, semester: period.semester, academicYear: 2026 - (active.year-period.year), completed, courses });
    }
    return profile;
}
async function object(user, value) {
    const key = crypto.createHash('sha256').update(user.username).digest('hex');
    if (process.env.DEMO_ACADEMIC_STORE_DIR) {
        if (process.env.NODE_ENV === 'production') throw fail('Production profiles require private durable Storage', 503);
        const file = path.join(process.env.DEMO_ACADEMIC_STORE_DIR, key + '.json');
        if (value === undefined) { try { return JSON.parse(await fs.readFile(file,'utf8')); } catch(e) { if(e.code==='ENOENT') return null; throw e; } }
        await fs.mkdir(path.dirname(file), { recursive: true }); const temp = file+'.'+crypto.randomUUID()+'.tmp';
        await fs.writeFile(temp, JSON.stringify(value), { mode: 0o600 }); await fs.rename(temp,file); return;
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_DOCUMENT_BUCKET) throw fail('Private demo profile storage is not configured',503);
    const url = new URL('/storage/v1/object/'+encodeURIComponent(process.env.SUPABASE_DOCUMENT_BUCKET)+'/demo-academics/v1/'+key+'/active.txt',process.env.SUPABASE_URL);
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
    if (!profile) { profile=generate(user); profile.sessionId=await require('./sessionOwnershipService').resolveSession(null,user); await object(user,profile); }
    const sid=await require('./sessionOwnershipService').resolveSession(profile.sessionId,user);
    if(sid!==profile.sessionId){profile.sessionId=sid;await object(user,profile);}
    return profile;
}
function publicProfile(profile,user) { const { seed, ...data } = profile; return { ...data, accountUsername:user.username }; }
async function get(user) { return locked(user,async()=>publicProfile(await load(user),user)); }
async function renew(user,options) { return locked(user,async()=>{
    const previous=await load(user);
    if(options.expectedProfileId!==previous.id) throw fail('The demo profile changed. Refresh before generating another profile.');
    const next=generate(user,previous,options); next.sessionId=await require('./sessionOwnershipService').resolveSession(null,user);
    await object(user,next);
    require('./programmeAdvisorState').store.clear(previous.sessionId);
    require('./supportConversationService').reset(previous.sessionId);
    return publicProfile(next,user);
}); }
async function withChat(user, expected, requestedSession, fn) { return locked(user,async()=>{
    const profile=await load(user);
    if(expected!==profile.id || requestedSession && requestedSession!==profile.sessionId) throw fail('The demo profile changed. Refresh its academic context before retrying.');
    return fn(profile);
}); }
module.exports={allowed,mappings,generate,get,renew,withChat};
