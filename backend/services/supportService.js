/**
 * supportService.js
 * ==================
 *
 * Escalation tickets, user feedback and analytics for the UNILUS chatbot.
 *
 * Runs on PostgreSQL (when DATABASE_URL is set) or the local SQLite file,
 * through services/db.js. Tables are created automatically on startup.
 * Every function that touches the database is async.
 *
 * What this covers from the requirements document:
 *   - Automatic ticket creation with a unique reference number
 *   - Ticket contents: query, conversation summary, conversation history,
 *     category, priority (Low / Medium / High / Critical), department,
 *     date/time
 *   - Ticket status tracking (Open / In Progress / Resolved / Closed)
 *   - User feedback on chatbot answers
 *   - Escalation and resolution statistics for reporting
 *
 * The summary is built deterministically (no extra LLM call), so ticket
 * creation still works when the AI service is unreachable.
 */

const crypto = require("crypto");
const db = require("./db");

const STATUSES = ["Open", "In Progress", "Resolved", "Closed"];
const DEFAULT_DEPARTMENT = "Registry";

db.schema({
    sqlite: [
        `CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_ref TEXT UNIQUE,
            session_id TEXT NOT NULL,
            question TEXT NOT NULL,
            summary TEXT NOT NULL,
            history_json TEXT NOT NULL,
            category TEXT NOT NULL,
            priority TEXT NOT NULL,
            department TEXT NOT NULL,
            contact_id TEXT,
            status TEXT NOT NULL DEFAULT 'Open',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE INDEX IF NOT EXISTS idx_tickets_session ON tickets (session_id, id)`,
        `CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status)`,
        `CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            rating TEXT NOT NULL,
            comment TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
    ],
    postgres: [
        `CREATE TABLE IF NOT EXISTS tickets (
            id SERIAL PRIMARY KEY,
            ticket_ref TEXT UNIQUE,
            session_id TEXT NOT NULL,
            question TEXT NOT NULL,
            summary TEXT NOT NULL,
            history_json TEXT NOT NULL,
            category TEXT NOT NULL,
            priority TEXT NOT NULL,
            department TEXT NOT NULL,
            contact_id TEXT,
            status TEXT NOT NULL DEFAULT 'Open',
            created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')),
            updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
        )`,
        `CREATE INDEX IF NOT EXISTS idx_tickets_session ON tickets (session_id, id)`,
        `CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status)`,
        `CREATE TABLE IF NOT EXISTS feedback (
            id SERIAL PRIMARY KEY,
            session_id TEXT,
            rating TEXT NOT NULL,
            comment TEXT,
            created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
        )`,
    ],
});


// Changes: Adds the student's own email / phone to tickets.
// Affects: tickets table (existing databases are altered in place), adminView.
// Purpose: Staff can reach the student directly. CREATE TABLE IF NOT EXISTS will
//          not add columns to a table that already exists, so we ALTER and ignore
//          "already exists" errors. contact_status: pending | provided | declined.
const NEW_TICKET_COLUMNS = [
    ["student_email", "TEXT"],
    ["student_phone", "TEXT"],
    ["contact_status", "TEXT"],
    ["student_username", "TEXT"],     // set when a signed-in portal student's question was escalated
    ["resolved_notified_at", "TEXT"], // set once the "resolved" email has been sent (never sent twice)
];

const columnsReady = (async () => {
    for (const [name, type] of NEW_TICKET_COLUMNS) {
        try {
            const ifNotExists = db.dialect === "postgres" ? "IF NOT EXISTS " : "";
            await db.run(`ALTER TABLE tickets ADD COLUMN ${ifNotExists}${name} ${type}`);
        } catch (err) {
            if (!/duplicate column|already exists/i.test(err.message)) {
                console.log(`[support] could not add tickets.${name}:`, err.message);
            }
        }
    }
})();

// Changes: Feedback now keeps the question and answer it was about, a reason, who gave it
//          (signed in or visitor, never a name) and whether staff have reviewed it.
// Affects: feedback table (existing databases are altered in place).
// Purpose: Staff can see WHAT went wrong, not just a thumbs-down count, and use it to improve
//          the knowledge base later.
const NEW_FEEDBACK_COLUMNS = [
    ["question", "TEXT"],
    ["answer", "TEXT"],
    ["reason", "TEXT"],
    ["audience", "TEXT"],
    ["reviewed", "INTEGER"], // 1 once staff have looked at it
];

const feedbackColumnsReady = (async () => {
    for (const [name, type] of NEW_FEEDBACK_COLUMNS) {
        try {
            const ifNotExists = db.dialect === "postgres" ? "IF NOT EXISTS " : "";
            await db.run(`ALTER TABLE feedback ADD COLUMN ${ifNotExists}${name} ${type}`);
        } catch (err) {
            if (!/duplicate column|already exists/i.test(err.message)) {
                console.log(`[support] could not add feedback.${name}:`, err.message);
            }
        }
    }
})();

const FEEDBACK_REASONS = ["wrong", "outdated", "not_answered", "unclear", "other"];
const FEEDBACK_PER_SESSION_PER_HOUR = 40;

// How long after a ticket is opened the chatbot keeps listening for contact details.
const CONTACT_WINDOW_MINUTES = 30;


/* ------------------------------------------------------------------ */
/* Classification (simple keyword rules; transparent and easy to tune) */
/* ------------------------------------------------------------------ */

const CATEGORY_RULES = [
    ["Complaint", /complain|unfair|harass|mistreat|discriminat|bribe|corrupt/i],
    ["Fees & Finance", /\bfees?\b|tuition|payment|balance|invoice|receipt/i],
    ["Exams & Results", /\bexams?\b|results?|grades?|marks?|supplementary|retake/i],
    ["Admissions", /admission|\bapply\b|application|intake|enrol/i],
    ["Registration", /register|registration|add course|drop course/i],
    ["ICT Support", /wifi|wi-fi|portal|password|log ?in|email account|mimosa|moodle/i],
    ["Library", /library|\bbooks?\b/i],
    ["Timetable", /timetable|\bclass(es)?\b|lecture|venue|\brooms?\b/i],
];

function classifyCategory(question, contact) {
    for (const [category, pattern] of CATEGORY_RULES) {
        if (pattern.test(question)) return category;
    }
    if (contact && contact.topic) return String(contact.topic);
    return "General";
}

function classifyPriority(question, category) {
    if (/harass|threat|abuse|emergency|unsafe|assault/i.test(question)) return "Critical";
    if (/urgent|asap|immediately|deadline|tomorrow|today|complain|unfair|missing result|blocked|can'?t (access|log)/i.test(question)) return "High";
    if (["Library", "Timetable", "General"].includes(category)) return "Low";
    return "Medium";
}


/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function truncate(text, max) {
    const s = String(text == null ? "" : text);
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// Times are stored as "YYYY-MM-DD HH:MM:SS" in UTC; return proper ISO strings.
function toIso(stored) {
    return stored ? `${String(stored).replace(" ", "T")}Z` : null;
}

// What the person who opened the ticket may see: status only, never the
// question text or conversation.
function publicView(row) {
    if (!row) return null;
    return {
        ref: row.ticket_ref,
        status: row.status,
        department: row.department,
        category: row.category,
        priority: row.priority,
        created_at: toIso(row.created_at),
        updated_at: toIso(row.updated_at),
    };
}

// What authorised staff see: everything, including the history.
function adminView(row) {
    if (!row) return null;
    let history = [];
    try {
        history = JSON.parse(row.history_json);
    } catch (err) {
        history = [];
    }
    return {
        ...publicView(row),
        question: row.question,
        summary: row.summary,
        history,
        session_id: row.session_id,
        contact_id: row.contact_id,
        student_email: row.student_email || null,
        student_phone: row.student_phone || null,
        student_username: row.student_username || null,
        contact_status: row.contact_status || "none",
    };
}

function buildSummary(question, history, category, priority) {
    const earlier = history
        .filter((m) => m.role === "user")
        .slice(0, -1) // drop the current question (always the last user turn)
        .slice(-2)
        .map((m) => `"${truncate(m.content, 120)}"`);

    const parts = [
        `Student asked: "${truncate(question, 300)}".`,
        "The chatbot could not find reliable information in the approved UNILUS sources.",
        `Category: ${category}. Priority: ${priority}.`,
    ];
    if (earlier.length) {
        parts.push(`Earlier in this conversation the student asked: ${earlier.join("; ")}.`);
    }
    parts.push(`${history.length} recent messages are attached to this ticket.`);
    return parts.join(" ");
}

const cleanRef = (ref) => String(ref || "").trim().toUpperCase();


/* ------------------------------------------------------------------ */
/* Student contact details                                             */
/* ------------------------------------------------------------------ */

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /\+?\d[\d\s\-().]{7,17}\d/;
const DECLINE_PATTERN = /^\s*(no|nope|nah|skip|no thanks|no thank you|not now|rather not|i('d| would) rather not|don'?t want to)\b/i;

/**
 * Pulls an email address and/or phone number out of a chat message.
 * Phone numbers must contain 9 to 15 digits (Zambian numbers such as
 * 0971263550 or +260971263550 both pass). Returns nulls when nothing is found.
 */
function extractContactDetails(text) {
    const message = String(text || "");
    if (message.length > 200) return { email: null, phone: null }; // a real question, not a reply

    const emailMatch = message.match(EMAIL_PATTERN);
    const withoutEmail = emailMatch ? message.replace(emailMatch[0], " ") : message;

    let phone = null;
    const phoneMatch = withoutEmail.match(PHONE_PATTERN);
    if (phoneMatch) {
        const digits = phoneMatch[0].replace(/\D/g, "");
        if (digits.length >= 9 && digits.length <= 15) {
            phone = phoneMatch[0].trim().startsWith("+") ? `+${digits}` : digits;
        }
    }

    return { email: emailMatch ? emailMatch[0].toLowerCase() : null, phone };
}

function isContactDecline(text) {
    return DECLINE_PATTERN.test(String(text || ""));
}


/* ------------------------------------------------------------------ */
/* Tickets                                                             */
/* ------------------------------------------------------------------ */

/**
 * Opens an escalation ticket. If the same session already has an open
 * ticket for the same question, that ticket is returned instead of
 * creating a duplicate (students retry and rephrase a lot).
 *
 * @returns {Promise<{ ticket: object, created: boolean }>}
 */
async function createTicket({ sessionId, question, history = [], contact = null, studentContact = null, studentUsername = null }) {
    await columnsReady;

    const duplicate = await db.get(
        `SELECT * FROM tickets
         WHERE session_id = ? AND lower(question) = lower(?)
           AND status IN ('Open', 'In Progress')
         ORDER BY id DESC LIMIT 1`,
        [sessionId, question]
    );
    if (duplicate) {
        return { ticket: publicView(duplicate), created: false };
    }

    const cleanHistory = history.map((m) => ({
        role: m.role,
        content: truncate(m.content, 2000),
    }));

    const category = classifyCategory(question, contact);
    const priority = classifyPriority(question, category);

    // The reference is built from the row id, so it is unique and sequential.
    const id = await db.insert(
        `INSERT INTO tickets
            (ticket_ref, session_id, question, summary, history_json,
             category, priority, department, contact_id,
             student_email, student_phone, contact_status, student_username)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            `TMP-${crypto.randomUUID()}`,
            sessionId,
            truncate(question, 2000),
            buildSummary(question, cleanHistory, category, priority),
            JSON.stringify(cleanHistory),
            category,
            priority,
            (contact && contact.department) || DEFAULT_DEPARTMENT,
            contact ? contact.contact_id || null : null,
            (studentContact && studentContact.email) || null,
            (studentContact && studentContact.phone) || null,
            // portal = signed in, details come from the account, nobody is asked.
            // pending = visitor, the chatbot asks for an email next.
            studentUsername ? "portal" : (studentContact && (studentContact.email || studentContact.phone) ? "provided" : "pending"),
            studentUsername || null,
        ]
    );
    const ref = `UNI-${new Date().getFullYear()}-${String(id).padStart(4, "0")}`;
    await db.run(`UPDATE tickets SET ticket_ref = ? WHERE id = ?`, [ref, id]);

    return { ticket: publicView(await db.get(`SELECT * FROM tickets WHERE ticket_ref = ?`, [ref])), created: true };
}

/**
 * The student's own open ticket for this exact question, or null. Lets the chatbot
 * point to it instead of offering to open another one.
 */
async function findOpenDuplicate(sessionId, question) {
    const row = await db.get(
        `SELECT * FROM tickets
         WHERE session_id = ? AND lower(question) = lower(?)
           AND status IN ('Open', 'In Progress')
         ORDER BY id DESC LIMIT 1`,
        [sessionId, question]
    );
    return row ? publicView(row) : null;
}

async function getTicketByRef(ref) {
    return publicView(await db.get(`SELECT * FROM tickets WHERE ticket_ref = ?`, [cleanRef(ref)]));
}

async function getTicketForAdmin(ref) {
    return adminView(await db.get(`SELECT * FROM tickets WHERE ticket_ref = ?`, [cleanRef(ref)]));
}

async function getLatestTicketForSession(sessionId) {
    return publicView(await db.get(`SELECT * FROM tickets WHERE session_id = ? ORDER BY id DESC LIMIT 1`, [sessionId]));
}

// Pure helper: stays synchronous.
function normalizeStatus(value) {
    const wanted = String(value || "").trim().toLowerCase();
    return STATUSES.find((s) => s.toLowerCase() === wanted) || null;
}

async function listTickets({ status = null, limit = 50 } = {}) {
    const cappedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const normalized = status ? normalizeStatus(status) : null;

    const rows = normalized
        ? await db.all(`SELECT * FROM tickets WHERE status = ? ORDER BY id DESC LIMIT ?`, [normalized, cappedLimit])
        : await db.all(`SELECT * FROM tickets ORDER BY id DESC LIMIT ?`, [cappedLimit]);

    return rows.map(adminView);
}

/**
 * @returns the updated ticket (admin view), or null if the ref doesn't exist.
 * Throws if the status isn't one of STATUSES (routes validate first).
 */
async function updateTicketStatus(ref, status) {
    const normalized = normalizeStatus(status);
    if (!normalized) {
        throw new Error(`Invalid status. Use one of: ${STATUSES.join(", ")}`);
    }

    await columnsReady;
    const wanted = cleanRef(ref);
    const before = await db.get(`SELECT status FROM tickets WHERE ticket_ref = ?`, [wanted]);
    const info = await db.run(
        `UPDATE tickets SET status = ?, updated_at = ${db.now} WHERE ticket_ref = ?`,
        [normalized, wanted]
    );

    if (info.changes === 0) return null;
    const updated = adminView(await db.get(`SELECT * FROM tickets WHERE ticket_ref = ?`, [wanted]));

    // Changes: Tells the person who opened the ticket (portal notice, or email for visitors).
    // Affects: services/ticketNotifier.js. Runs for EVERY status change, whichever route
    //          made it (ticket PATCH or "teach the chatbot"), because they all end up here.
    // Purpose: Staff updating the knowledge base and answering the student become one step.
    if (!before || before.status !== updated.status) {
        require("./ticketNotifier").statusChanged(updated).catch(() => {});
    }
    return updated;
}

/**
 * Marks the "resolved" email as sent. Returns true only for the caller that
 * claims it first, so toggling Resolved -> In Progress -> Resolved never sends twice.
 */
async function claimResolutionEmail(ref) {
    await columnsReady;
    const info = await db.run(
        `UPDATE tickets SET resolved_notified_at = ${db.now}
         WHERE ticket_ref = ? AND resolved_notified_at IS NULL`,
        [cleanRef(ref)]
    );
    return info.changes === 1;
}

async function releaseResolutionEmail(ref) {
    await db.run(`UPDATE tickets SET resolved_notified_at = NULL WHERE ticket_ref = ?`, [cleanRef(ref)]);
}


/**
 * The newest ticket in this session that is still waiting for the student's
 * contact details (opened within CONTACT_WINDOW_MINUTES), or null.
 */
async function getTicketAwaitingContact(sessionId) {
    await columnsReady;
    const row = await db.get(
        `SELECT * FROM tickets
         WHERE session_id = ? AND contact_status = 'pending'
         ORDER BY id DESC LIMIT 1`,
        [sessionId]
    );
    if (!row) return null;

    const opened = Date.parse(toIso(row.created_at));
    if (Number.isFinite(opened) && Date.now() - opened > CONTACT_WINDOW_MINUTES * 60 * 1000) {
        await db.run(`UPDATE tickets SET contact_status = 'declined' WHERE id = ?`, [row.id]);
        return null;
    }
    return publicView(row);
}

/**
 * Saves the student's email and/or phone on a ticket. Only fills in what was
 * given; never wipes a detail that is already stored.
 * @returns {Promise<{email: string|null, phone: string|null}|null>} what is now stored, or null if the ticket doesn't exist
 */
async function saveTicketContact(ref, { email = null, phone = null } = {}) {
    await columnsReady;
    const wanted = cleanRef(ref);
    const existing = await db.get(`SELECT * FROM tickets WHERE ticket_ref = ?`, [wanted]);
    if (!existing) return null;

    const nextEmail = email || existing.student_email || null;
    const nextPhone = phone || existing.student_phone || null;

    await db.run(
        `UPDATE tickets
         SET student_email = ?, student_phone = ?, contact_status = ?, updated_at = ${db.now}
         WHERE ticket_ref = ?`,
        [nextEmail, nextPhone, nextEmail || nextPhone ? "provided" : "pending", wanted]
    );
    return { email: nextEmail, phone: nextPhone };
}

async function declineTicketContact(ref) {
    await columnsReady;
    await db.run(
        `UPDATE tickets SET contact_status = 'declined' WHERE ticket_ref = ? AND contact_status = 'pending'`,
        [cleanRef(ref)]
    );
}

/** Checks that a ticket belongs to the given chat session (used by the contact endpoint). */
async function ticketBelongsToSession(ref, sessionId) {
    const row = await db.get(`SELECT session_id FROM tickets WHERE ticket_ref = ?`, [cleanRef(ref)]);
    return Boolean(row && sessionId && row.session_id === sessionId);
}


/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

/**
 * Stores a thumbs up / down. Everything except the rating is optional.
 * Returns the new feedback id so the widget can add a reason / comment afterwards.
 * Throws "rating must be ..." (400) or "too many feedback..." (429).
 */
async function recordFeedback({ sessionId = null, rating, comment = null, reason = null, question = null, answer = null, audience = null }) {
    await feedbackColumnsReady;
    const normalized = String(rating || "").trim().toLowerCase();
    if (normalized !== "up" && normalized !== "down") {
        throw new Error('rating must be "up" or "down"');
    }

    if (sessionId) {
        const since = new Date(Date.now() - 3600 * 1000).toISOString().slice(0, 19).replace("T", " ");
        const recent = await db.get(
            `SELECT COUNT(*) AS c FROM feedback WHERE session_id = ? AND created_at >= ?`,
            [sessionId, since]
        );
        if (Number(recent.c) >= FEEDBACK_PER_SESSION_PER_HOUR) {
            throw new Error("too many feedback submissions, please try again later");
        }
    }

    const cleanReason = FEEDBACK_REASONS.includes(reason) ? reason : null;
    return db.insert(
        `INSERT INTO feedback (session_id, rating, comment, reason, question, answer, audience, reviewed)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [
            sessionId,
            normalized,
            comment ? truncate(String(comment).trim(), 1000) : null,
            cleanReason,
            question ? truncate(String(question).trim(), 500) : null,
            answer ? truncate(String(answer).trim(), 2000) : null,
            audience === "student" || audience === "visitor" ? audience : null,
        ]
    );
}

/**
 * Adds a reason / comment (or changes the rating) on feedback the same chat session gave.
 * Returns false when the id doesn't exist or belongs to another session.
 */
async function updateFeedback(id, sessionId, { rating = null, reason = null, comment = null } = {}) {
    await feedbackColumnsReady;
    const row = await db.get(`SELECT * FROM feedback WHERE id = ?`, [Number(id) || 0]);
    if (!row || !sessionId || row.session_id !== sessionId) return false;

    const normalized = rating ? String(rating).trim().toLowerCase() : row.rating;
    if (normalized !== "up" && normalized !== "down") throw new Error('rating must be "up" or "down"');

    await db.run(
        `UPDATE feedback SET rating = ?, reason = ?, comment = ?, reviewed = 0 WHERE id = ?`,
        [
            normalized,
            FEEDBACK_REASONS.includes(reason) ? reason : row.reason,
            comment ? truncate(String(comment).trim(), 1000) : row.comment,
            row.id,
        ]
    );
    return true;
}

/** Staff view of feedback, newest first. */
async function listFeedback({ rating = null, reviewed = null, limit = 200 } = {}) {
    await feedbackColumnsReady;
    const where = [];
    const params = [];
    if (rating === "up" || rating === "down") { where.push("rating = ?"); params.push(rating); }
    if (reviewed === true) where.push("reviewed = 1");
    if (reviewed === false) where.push("(reviewed IS NULL OR reviewed = 0)");

    const rows = await db.all(
        `SELECT * FROM feedback ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY id DESC LIMIT ?`,
        [...params, Math.min(Math.max(parseInt(limit, 10) || 200, 1), 1000)]
    );
    return rows.map((row) => ({
        id: Number(row.id),
        rating: row.rating,
        reason: row.reason || null,
        comment: row.comment || null,
        question: row.question || null,
        answer: row.answer || null,
        audience: row.audience || null,
        reviewed: Boolean(row.reviewed),
        created_at: toIso(row.created_at),
    }));
}

async function markFeedbackReviewed(id, reviewed = true) {
    await feedbackColumnsReady;
    const info = await db.run(`UPDATE feedback SET reviewed = ? WHERE id = ?`, [reviewed ? 1 : 0, Number(id) || 0]);
    return info.changes > 0;
}


/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

async function groupCounts(sql) {
    const out = {};
    for (const row of await db.all(sql)) {
        out[row.k] = Number(row.n);
    }
    return out;
}

async function getStats() {
    await feedbackColumnsReady;
    let totalQuestions = 0;
    try {
        totalQuestions = Number((await db.get(`SELECT COUNT(*) AS c FROM conversations WHERE role = 'user'`)).c);
    } catch (err) {
        totalQuestions = 0; // conversations table not created yet
    }

    const totalTickets = Number((await db.get(`SELECT COUNT(*) AS c FROM tickets`)).c);
    const feedback = await groupCounts(`SELECT rating AS k, COUNT(*) AS n FROM feedback GROUP BY rating`);

    return {
        // Includes greetings and every other user message, so treat the
        // "answered directly" figure as an approximation.
        totalQuestions,
        escalatedTickets: totalTickets,
        answeredDirectly: Math.max(totalQuestions - totalTickets, 0),
        escalationRate: totalQuestions > 0
            ? Math.round((totalTickets / totalQuestions) * 1000) / 1000
            : 0,
        ticketsByStatus: await groupCounts(`SELECT status AS k, COUNT(*) AS n FROM tickets GROUP BY status`),
        ticketsByDepartment: await groupCounts(`SELECT department AS k, COUNT(*) AS n FROM tickets GROUP BY department`),
        ticketsByPriority: await groupCounts(`SELECT priority AS k, COUNT(*) AS n FROM tickets GROUP BY priority`),
        ticketsByCategory: await groupCounts(`SELECT category AS k, COUNT(*) AS n FROM tickets GROUP BY category`),
        feedback: {
            up: feedback.up || 0,
            down: feedback.down || 0,
            toReview: Number((await db.get(`SELECT COUNT(*) AS c FROM feedback WHERE rating = 'down' AND (reviewed IS NULL OR reviewed = 0)`)).c),
            byReason: await groupCounts(`SELECT reason AS k, COUNT(*) AS n FROM feedback WHERE rating = 'down' AND reason IS NOT NULL GROUP BY reason`),
        },
    };
}


module.exports = {
    STATUSES,
    createTicket,
    findOpenDuplicate,
    getTicketByRef,
    getTicketForAdmin,
    getLatestTicketForSession,
    listTickets,
    updateTicketStatus,
    normalizeStatus,
    extractContactDetails,
    isContactDecline,
    getTicketAwaitingContact,
    saveTicketContact,
    declineTicketContact,
    ticketBelongsToSession,
    claimResolutionEmail,
    releaseResolutionEmail,
    recordFeedback,
    updateFeedback,
    listFeedback,
    markFeedbackReviewed,
    getStats,
};
