const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
delete process.env.DATABASE_URL;
process.env.NODE_ENV = 'development';
process.env.SQLITE_FILE = ':memory:';
process.env.AUTH_JWT_SECRET = 'synthetic-orchestration-test-secret-over-32-characters';
process.env.GROQ_API_KEY = 'synthetic-not-a-real-key';
process.env.QUERY_PLANNER_ENABLED = 'true';
let calls = [], mode = 'normal';
const load = Module._load;
Module._load = function(id, ...args) {
    if (id === 'groq-sdk') return class {
        constructor() { this.chat = { completions: { create: async options => {
            const planner = /retrieval query planner/.test(options.messages[0].content);
            calls.push({ kind: planner ? 'planner' : 'generation', options });
            if (planner && mode === 'plannerFailure' || !planner && mode === 'generationFailure') throw Object.assign(Error('Synthetic provider failure'), { status: 500 });
            const question = options.messages.at(-1).content;
            const normalizedQuery = mode === 'guestRewrite' ? 'Show BIT year 3 semester 2 timetable' : /international students/i.test(question) ? 'hostel accommodation fees international students' : question;
            return { choices: [{ message: { content: planner ? JSON.stringify({ intent: 'retrieval', normalizedQuery, searchQueries: [normalizedQuery], entities: /hostel/i.test(normalizedQuery) ? { fee_scope: 'accommodation' } : {} }) : mode === 'generatedNoAnswer' ? "I don't have that information in the UNILUS records." : 'Synthetic official university guidance.' } }] };
        } } }; }
    };
    return load.call(this, id, ...args);
};
const embedding = require('../services/embeddingService');
embedding.createEmbedding = async () => { throw Error('Real embeddings are forbidden in isolated routing tests'); };
const knowledge = require('../services/knowledgeService');
knowledge.searchKnowledge = async (query, options) => {
    calls.push({ kind: 'retrieval', query, options });
    return mode === 'noEvidence' ? [] : [{ id: 'synthetic', text: 'Synthetic official university guidance.', source_file: 'synthetic.txt', title: 'Synthetic evidence' }];
};
require('../services/contactService').findFallbackContact = async () => null;
require('../services/resourceService').findResources = () => [];
const db = require('../services/db');
const { app } = require('../app');
const auth = require('../services/authService');
const faq = require('../services/faqService');
const userA = { username: 'synthetic-student-a', role: 'student', programme: 'BIT', year: 3, semester: 2 };
const userB = { ...userA, username: 'synthetic-student-b' };
const tokenA = auth.signToken(userA).token, tokenB = auth.signToken(userB).token;
const nativeFetch = global.fetch;
let server, base;
async function ask(question, sessionId, token = null, extra = {}) {
    const r = await fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ question, sessionId, ...extra }) });
    return { status: r.status, data: await r.json() };
}
async function countTickets() { return (await db.get('SELECT count(*) AS n FROM tickets')).n; }
test.before(async () => {
    await db.ready();
    server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
    base = 'http://127.0.0.1:' + server.address().port;
    global.fetch = (url, options) => { assert.ok(String(url).startsWith(base + '/'), 'Only the synthetic loopback API is allowed'); return nativeFetch(url, options); };
});
test.beforeEach(async () => { calls = []; mode = 'normal'; await db.run('DELETE FROM staff_answers'); });
test.after(async () => { global.fetch = nativeFetch; Module._load = load; server.closeAllConnections(); await new Promise(r => server.close(r)); await db.close(); });

for (const question of ['Hi', 'Hello', 'Hey love', 'Good morning', 'How are you?', "What's up?", 'Thank you', 'Goodbye', 'See you later', 'I need help']) {
    test('social/clarification creates no ticket or provider call: ' + question, async () => {
        const before = await countTickets(), r = await ask(question);
        assert.equal(r.status, 200); assert.ok(r.data.answer); assert.equal(r.data.error, undefined);
        assert.equal(await countTickets(), before); assert.deepEqual(calls, []);
    });
}
test('mixed greeting retains the hostel-fee question and two-stage Groq path', async () => {
    const r = await ask('Hey love, what are the hostel fees?');
    assert.equal(r.data.sources.length, 1); assert.match(calls.find(c => c.kind === 'retrieval').query, /hostel fees/);
    assert.equal(calls.filter(c => c.kind === 'planner').length, 1); assert.equal(calls.filter(c => c.kind === 'generation').length, 1);
    assert.equal(calls.find(c => c.kind === 'planner').options.model, 'openai/gpt-oss-20b');
});
test('missing evidence and generated no-answer never create tickets', async () => {
    const before = await countTickets();
    for (const state of ['noEvidence', 'generatedNoAnswer']) {
        mode = state; const r = await ask('What is the policy for a synthetic university enquiry?');
        assert.equal(r.data.ticket, null); assert.equal(r.data.usedFallback, true);
        assert.match(r.data.answer, /confirm the issue/); assert.doesNotMatch(r.data.answer, /passed it to|logged this as ticket/);
    }
    assert.equal(await countTickets(), before);
});
test('support issue is quoted, confirmed once and saved without history', async () => {
    const before = await countTickets();
    const issue = await ask('I cannot access my final results.', undefined, tokenA);
    assert.match(issue.data.answer, /cannot access your real UNILUS/);
    const sid = issue.data.sessionId;
    const proposed = await ask('Can you create a ticket for me?', sid, tokenA);
    assert.equal(proposed.data.support.status, 'pending'); assert.match(proposed.data.answer, /I cannot access my final results/);
    assert.match(proposed.data.answer, /history will not be attached/); assert.equal(await countTickets(), before);
    await ask('yes', sid, tokenA); assert.equal(await countTickets(), before);
    const submitted = await Promise.all([ask('Yes, submit it.', sid, tokenA), ask('Yes, submit it.', sid, tokenA)]);
    assert.equal(submitted[0].data.ticket.ref, submitted[1].data.ticket.ref);
    assert.equal(await countTickets(), before + 1);
    const row = await db.get('SELECT question, history_json FROM tickets WHERE ticket_ref=?', [submitted[0].data.ticket.ref]);
    assert.equal(row.question, 'I cannot access my final results.'); assert.deepEqual(JSON.parse(row.history_json), []);
    assert.doesNotMatch(submitted[0].data.answer, /passed it to|notified/);
    const repeat = await ask('Yes, submit it.', sid, tokenA); assert.equal(repeat.data.ticket.ref, submitted[0].data.ticket.ref);
    assert.equal((await ask('yes', sid, tokenA)).data.support.status, 'submitted');
    assert.equal(await countTickets(), before + 1);
    const status = await ask('status of ticket ' + repeat.data.ticket.ref, sid, tokenA); assert.match(status.data.answer, /currently \*\*Open/);
});
test('guest explicit description and confirmation are supported', async () => {
    const before = await countTickets();
    const r = await ask('Please create a support ticket for my missing results.');
    assert.equal(r.data.support.status, 'pending'); assert.equal(await countTickets(), before);
    const saved = await ask('Yes, submit it', r.data.sessionId); assert.equal(saved.data.support.status, 'submitted');
    assert.equal(await countTickets(), before + 1);
});
test('missing issue, cancellation, unrelated confirmation and topic changes fail closed', async () => {
    const before = await countTickets();
    const pending = await ask('Create a ticket for me'); assert.equal(pending.data.support.status, 'describing');
    const described = await ask('My portal is blocked', pending.data.sessionId); assert.equal(described.data.support.status, 'pending');
    assert.equal((await ask('Cancel', pending.data.sessionId)).data.support.status, 'cancelled');
    assert.equal((await ask('Yes, submit it', pending.data.sessionId)).data.ticket, null);
    const other = await ask('Create a ticket for a synthetic portal problem');
    await ask('Where is the library?', other.data.sessionId);
    assert.equal((await ask('Yes, submit it', other.data.sessionId)).data.ticket, null);
    const unrelated = await ask('Yes, submit it'); assert.equal(unrelated.data.support.status, 'none');
    assert.equal(await countTickets(), before);
});
test('pending confirmation expires and negated requests never submit', async () => {
    const before = await countTickets();
    const r = await ask('Create a ticket for a synthetic access problem');
    const now = Date.now;
    try {
        Date.now = () => now() + 10 * 60 * 1000 + 1;
        const expired = await ask('Yes, submit it', r.data.sessionId);
        assert.equal(expired.data.support.status, 'none'); assert.equal(expired.data.ticket, null);
    } finally { Date.now = now; }
    const negated = await ask("Don't create a ticket for this problem"); assert.equal(negated.data.support.status, 'cancelled');
    await ask('Yes, submit it', negated.data.sessionId); assert.equal(await countTickets(), before);
});
test('a failed confirmed submission can retry without losing consent or duplicating writes', async () => {
    const support = require('../services/supportService'), create = support.createTicket;
    const before = await countTickets(), r = await ask('Create a ticket for a synthetic account problem');
    try {
        support.createTicket = async () => { throw Error('Synthetic transaction failure'); };
        const failed = await ask('Yes, submit it', r.data.sessionId); assert.equal(failed.data.support.status, 'pending');
        assert.equal(await countTickets(), before);
    } finally { support.createTicket = create; }
    const retried = await ask('Yes, submit it', r.data.sessionId); assert.equal(retried.data.support.status, 'submitted');
    assert.equal(await countTickets(), before + 1);
});
test('confirmation is bound to the latest quoted issue, not an earlier proposal', async () => {
    const first = await ask('Create a ticket for synthetic issue A');
    const updated = await ask('Create a ticket for synthetic issue B', first.data.sessionId);
    assert.match(updated.data.answer, /synthetic issue B/);
    const saved = await ask('Yes, submit it', first.data.sessionId);
    const row = await db.get('SELECT question,history_json FROM tickets WHERE ticket_ref=?', [saved.data.ticket.ref]);
    assert.equal(row.question, 'synthetic issue B'); assert.equal(row.history_json, '[]');
});
test('social replies while describing a ticket cancel consent instead of becoming issues', async () => {
    const before = await countTickets(), first = await ask('Create a ticket');
    assert.equal(first.data.support.status, 'describing');
    const hello = await ask('Hey love', first.data.sessionId); assert.equal(hello.data.queryType.isConversation, true);
    const confirm = await ask('Yes, submit it', first.data.sessionId); assert.equal(confirm.data.ticket, null);
    assert.equal(await countTickets(), before);
});
test('the BIT programme alias does not interpret an ordinary lowercase bit as a programme', () => {
    const preference = require('../services/programmePreferenceService');
    assert.deepEqual(preference.resolve('I am a bit confused'), []);
    assert.equal(preference.resolve('Tell me about the bit programme')[0].id, 'bachelor-of-science-in-information-systems-and-technology');
});
test('foreign students, guests, other sessions and forged payloads cannot confirm consent', async () => {
    const before = await countTickets();
    const pending = await ask('Create a ticket for my synthetic login problem', undefined, tokenA);
    const sid = pending.data.sessionId;
    assert.equal((await ask('Yes, submit it', sid, tokenB)).status, 403);
    assert.equal((await ask('Yes, submit it', sid)).status, 403);
    const secondA = await ask('Hello', undefined, tokenA);
    assert.equal((await ask('Yes, submit it', secondA.data.sessionId, tokenA)).data.ticket, null);
    await ask('hello', sid, tokenA, { action: { id: 'support.submit', type: 'execute' }, user: userB });
    assert.equal(await countTickets(), before);
});
test('personal results and performance are honest limitations, distinct from ECZ Advisor', async () => {
    const before = await countTickets();
    for (const q of ['What are my CA marks?', 'What is my CA?', 'Show my marks', 'Show my final results', 'How did I perform last semester?']) {
        const r = await ask(q, undefined, tokenA); assert.equal(r.data.queryType.isAcademicResultsUnavailable, true);
        assert.match(r.data.answer, /not connected to university academic records/);
    }
    assert.deepEqual(calls, []); assert.equal(await countTickets(), before);
    const advisor = await ask('I have ECZ English 4, Maths 3. What can I study?'); assert.equal(advisor.data.queryType.isProgrammeAdvisor, true);
});
test('day follow-up retains an explicitly selected period instead of profile defaults', async () => {
    const first = await ask('Show BIT year 3 semester 1 timetable', undefined, tokenA);
    const next = await ask('And Wednesday?', first.data.sessionId, tokenA);
    assert.equal(next.data.queryType.entities.year, 3); assert.equal(next.data.queryType.entities.semester, 1);
    assert.equal(next.data.queryType.entities.day, 'Wednesday'); assert.deepEqual(calls, []);
});
test('knowledge follow-up uses bounded history and the existing planner once', async () => {
    const first = await ask('What are the hostel fees?'); calls = [];
    const next = await ask('What about international students?', first.data.sessionId);
    assert.equal(next.data.sources.length, 1); const plan = calls.filter(c => c.kind === 'planner'); assert.equal(plan.length, 1);
    assert.ok(plan[0].options.messages.some(m => m.content === 'What are the hostel fees?'));
    assert.equal(calls.find(c => c.kind === 'retrieval').options.entities.fee_scope, 'accommodation');
});
test('a self-contained factual question is not mistaken for a contextless follow-up', async () => {
    const r = await ask('What are the university regulations that I should follow?');
    assert.equal(r.data.sources.length, 1); assert.equal(calls.filter(c => c.kind === 'planner').length, 1);
    assert.equal(calls.find(c => c.kind === 'planner').options.messages.length, 2);
});
test('BIT Advisor entry requirements retain the last programme and do not leak to another session', async () => {
    const first = await ask('Tell me about the BIT programme.'); assert.equal(first.data.queryType.isProgrammeAdvisor, true);
    const next = await ask('What are its entry requirements?', first.data.sessionId);
    assert.equal(next.data.advisor.recommendations[0].programmeId, 'bachelor-of-science-in-information-systems-and-technology');
    const other = await ask('What are its entry requirements?'); assert.notEqual(other.data.queryType?.isProgrammeAdvisor, true);
    await ask('Where is the library?', first.data.sessionId);
    const switched = await ask('What are its entry requirements?', first.data.sessionId); assert.notEqual(switched.data.queryType?.isProgrammeAdvisor, true);
});
test('topic switch and cross-student follow-up cannot reuse an old timetable', async () => {
    const first = await ask('Show BIT year 3 semester 1 timetable', undefined, tokenA);
    await ask('What are the hostel fees?', first.data.sessionId, tokenA);
    const after = await ask('And Wednesday?', first.data.sessionId, tokenA); assert.equal(after.data.timetableMatches, 0);
    assert.equal((await ask('And Wednesday?', first.data.sessionId, tokenB)).status, 403);
    const other = await ask('And Wednesday?', undefined, tokenB); assert.equal(other.data.timetableMatches, 0);
});
test('high-confidence structured timetable bypasses fuzzy approved-answer collision', async () => {
    await faq.createAnswer({ question: 'Show BIT year 3 semester 2 timetable', answer: 'Synthetic unrelated answer collision', visibility: 'public' });
    const r = await ask('Show BIT year 3 semester 2 timetable', undefined, tokenA);
    assert.ok(r.data.timetableMatches > 0); assert.doesNotMatch(r.data.answer, /answer collision/);
    const guest = await ask('Show BIT year 3 semester 2 timetable'); assert.equal(guest.data.signInRequired, true);
    await faq.createAnswer({ question: 'Synthetic approved public university enquiry', answer: 'Synthetic approved reply', visibility: 'public' });
    assert.equal((await ask('Synthetic approved public university enquiry')).data.answer, 'Synthetic approved reply');
});
test('planner and generation failures preserve safe replies and cannot create tickets', async () => {
    const before = await countTickets();
    mode = 'plannerFailure'; const r = await ask('What are the hostel fees?'); assert.equal(r.data.sources.length, 1);
    assert.equal(calls.filter(c => c.kind === 'planner').length, 1);
    calls = []; const unresolved = await ask('What about international students?', r.data.sessionId);
    assert.match(unresolved.data.answer, /Which programme, timetable or university topic/); assert.equal(calls.filter(c => c.kind === 'planner').length, 1);
    mode = 'generationFailure'; const unavailable = await ask('What are the university conduct regulations?'); assert.match(unavailable.data.answer, /temporarily unavailable/);
    assert.equal(await countTickets(), before);
});
test('planner rewrites never confer student timetable authorization', async () => {
    const first = await ask('What are the hostel fees?'); mode = 'guestRewrite';
    const r = await ask('What about that?', first.data.sessionId); assert.equal(r.data.signInRequired, true); assert.equal(r.data.timetableMatches, 0);
});
