/**
 * faqService.js
 * ==============
 * Staff-approved answers ("teach the bot") and recurring-question tracking.
 *
 * - Staff save an answer for a question, and choose who may see it:
 *     "public"  = anyone
 *     "student" = signed-in students only
 *     "visitor" = people who are NOT signed in only (signed-in students skip it,
 *                 so they still get their real answer)
 *   Anything staff do NOT save here is never learned by the bot.
 * - findStaffAnswer() is called by chatService before it escalates.
 * - getRecurring() groups similar tickets so staff can see what is asked most.
 *
 * Matching is word overlap on the meaningful words (with light word-ending
 * clean-up), so it is predictable and easy to tune. Raise THRESHOLD for
 * stricter matching.
 *
 * Runs on PostgreSQL (when DATABASE_URL is set) or the local SQLite file,
 * through services/db.js. Everything that touches the database is async.
 */

const db = require("./db");

db.schema({
    sqlite: [
        `CREATE TABLE IF NOT EXISTS staff_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            visibility TEXT NOT NULL DEFAULT 'student',
            active INTEGER NOT NULL DEFAULT 1,
            times_used INTEGER NOT NULL DEFAULT 0,
            source_ticket TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
    ],
    postgres: [
        `CREATE TABLE IF NOT EXISTS staff_answers (
            id SERIAL PRIMARY KEY,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            visibility TEXT NOT NULL DEFAULT 'student',
            active INTEGER NOT NULL DEFAULT 1,
            times_used INTEGER NOT NULL DEFAULT 0,
            source_ticket TEXT,
            created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')),
            updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
        )`,
    ],
});

const THRESHOLD = 0.6;
const VISIBILITY = ["public", "student", "visitor"];

const STOP = new Set(
    "a an the is are was were be to of in on at for and or do does did i me my we you your it its can could would should will what when where who how which please tell about there this that with from have has any some".split(" ")
);

// Light word-ending clean-up so "graduate" and "graduation" count as the same word.
function stem(w) {
    if (w.length <= 4) return w;
    for (const suffix of ["ion", "ing", "ed", "s", "e"]) {
        if (w.endsWith(suffix) && w.length - suffix.length >= 4) w = w.slice(0, -suffix.length);
    }
    return w;
}

function tokens(text) {
    const words = String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w && !STOP.has(w))
        .map(stem);
    return [...new Set(words)];
}

function similarity(a, b) {
    if (!a.length || !b.length) return 0;
    const setB = new Set(b);
    const shared = a.filter((w) => setB.has(w)).length;
    if (a.length === 1 && b.length === 1) return shared ? 1 : 0; // "gym?" vs "where is the gym"
    if (a.length < 2 || b.length < 2) return 0;                 // too short to match safely
    const jaccard = shared / (a.length + b.length - shared);
    // a longer wording still matches if it contains the saved question's key words
    const containment = shared >= 2 ? (shared / Math.min(a.length, b.length)) * 0.75 : 0;
    return Math.max(jaccard, containment);
}

const toIso = (t) => (t ? `${String(t).replace(" ", "T")}Z` : null);


/* ---------------------- Used by the chatbot ---------------------- */

/**
 * @param {string} question
 * @param {string} audience  "student" sees everything; anything else is public.
 * @returns {Promise<{id, question, answer, score} | null>}
 */
async function findStaffAnswer(question, audience) {
    const q = tokens(question);
    let best = null;
    let bestScore = 0;

    for (const row of await db.all(`SELECT * FROM staff_answers WHERE active = 1`)) {
        // "student" answers are for signed-in students only, "visitor" answers are for
        // people who are NOT signed in only, and "public" answers are for everyone.
        if (audience === "student" ? row.visibility === "visitor" : row.visibility === "student") continue;
        const score = similarity(q, tokens(row.question));
        if (score > bestScore) {
            best = row;
            bestScore = score;
        }
    }

    if (!best || bestScore < THRESHOLD) return null;
    return { id: best.id, question: best.question, answer: best.answer, score: bestScore };
}

async function recordUse(id) {
    await db.run(`UPDATE staff_answers SET times_used = times_used + 1 WHERE id = ?`, [id]);
}


/* ------------------------- Managing answers ------------------------ */

async function getAnswer(id) {
    return db.get(`SELECT * FROM staff_answers WHERE id = ?`, [id]);
}

function shape(row) {
    if (!row) return null;
    return {
        id: row.id,
        question: row.question,
        answer: row.answer,
        visibility: row.visibility,
        active: !!row.active,
        times_used: row.times_used,
        source_ticket: row.source_ticket,
        created_at: toIso(row.created_at),
        updated_at: toIso(row.updated_at),
    };
}

async function listAnswers() {
    return (await db.all(`SELECT * FROM staff_answers ORDER BY id DESC`)).map(shape);
}

async function createAnswer({ question, answer, visibility, sourceTicket = null }) {
    if (!VISIBILITY.includes(visibility)) {
        throw new Error('visibility must be "public", "student" or "visitor"');
    }
    const q = String(question || "").trim();
    const a = String(answer || "").trim();
    if (!q || !a) throw new Error("question and answer are required");

    const id = await db.insert(
        `INSERT INTO staff_answers (question, answer, visibility, source_ticket) VALUES (?, ?, ?, ?)`,
        [q.slice(0, 500), a.slice(0, 3000), visibility, sourceTicket]
    );
    return shape(await getAnswer(id));
}

async function updateAnswer(id, fields) {
    const cur = await getAnswer(id);
    if (!cur) return null;

    const next = {
        question: fields.question != null ? String(fields.question).trim().slice(0, 500) : cur.question,
        answer: fields.answer != null ? String(fields.answer).trim().slice(0, 3000) : cur.answer,
        visibility: fields.visibility != null ? fields.visibility : cur.visibility,
        active: fields.active != null ? (fields.active ? 1 : 0) : cur.active,
    };
    if (!VISIBILITY.includes(next.visibility)) throw new Error('visibility must be "public", "student" or "visitor"');
    if (!next.question || !next.answer) throw new Error("question and answer are required");

    await db.run(
        `UPDATE staff_answers SET question = ?, answer = ?, visibility = ?, active = ?, updated_at = ${db.now} WHERE id = ?`,
        [next.question, next.answer, next.visibility, next.active, id]
    );
    return shape(await getAnswer(id));
}

async function deleteAnswer(id) {
    return (await db.run(`DELETE FROM staff_answers WHERE id = ?`, [id])).changes > 0;
}


/* ----------------------- Recurring questions ----------------------- */

async function getRecurring() {
    const rows = await db.all(`SELECT ticket_ref, question, status, created_at FROM tickets ORDER BY id DESC LIMIT 1000`);

    const clusters = [];
    for (const r of rows) {
        const t = tokens(r.question);
        let c = clusters.find((x) => similarity(t, x.tokens) >= THRESHOLD);
        if (!c) {
            // newest first, so the first row is the most recent phrasing
            c = { tokens: t, question: r.question, count: 0, openCount: 0, refs: [], lastAsked: r.created_at };
            clusters.push(c);
        }
        c.count++;
        if (r.status === "Open" || r.status === "In Progress") c.openCount++;
        c.refs.push(r.ticket_ref);
    }

    const sorted = clusters.sort((a, b) => b.count - a.count || String(b.lastAsked).localeCompare(String(a.lastAsked)));

    return Promise.all(
        sorted.map(async (c) => ({
            question: c.question,
            count: c.count,
            openCount: c.openCount,
            refs: c.refs.slice(0, 10),
            lastAsked: toIso(c.lastAsked),
            answered: !!(await findStaffAnswer(c.question, "student")),
        }))
    );
}

/** Refs of open / in-progress tickets that ask roughly this question. */
async function openTicketRefsMatching(question) {
    const q = tokens(question);
    const rows = await db.all(`SELECT ticket_ref, question FROM tickets WHERE status IN ('Open', 'In Progress')`);
    return rows
        .filter((r) => similarity(q, tokens(r.question)) >= THRESHOLD)
        .map((r) => r.ticket_ref);
}


module.exports = {
    findStaffAnswer,
    recordUse,
    listAnswers,
    createAnswer,
    updateAnswer,
    deleteAnswer,
    getRecurring,
    openTicketRefsMatching,
};
