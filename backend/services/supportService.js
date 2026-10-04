/**
 * supportService.js
 * ==================
 *
 * Escalation tickets, user feedback and analytics for the UNILUS chatbot.
 *
 * Uses the SAME SQLite file as sessionService (data/conversations.db),
 * so there is nothing new to install or configure: better-sqlite3 is
 * already a dependency. Tables are created automatically on first load.
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

const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const db = new Database(path.join(__dirname, "../data/conversations.db"));

const STATUSES = ["Open", "In Progress", "Resolved", "Closed"];
const DEFAULT_DEPARTMENT = "Registry";

db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
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
    );
    CREATE INDEX IF NOT EXISTS idx_tickets_session ON tickets (session_id, id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);

    CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        rating TEXT NOT NULL,
        comment TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
`);


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

// SQLite stores "YYYY-MM-DD HH:MM:SS" in UTC; return proper ISO strings.
function toIso(sqliteTime) {
    return sqliteTime ? `${String(sqliteTime).replace(" ", "T")}Z` : null;
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


/* ------------------------------------------------------------------ */
/* Tickets                                                             */
/* ------------------------------------------------------------------ */

const insertTicket = db.prepare(`
    INSERT INTO tickets
        (ticket_ref, session_id, question, summary, history_json,
         category, priority, department, contact_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const setTicketRef = db.prepare(`UPDATE tickets SET ticket_ref = ? WHERE id = ?`);
const selectByRef = db.prepare(`SELECT * FROM tickets WHERE ticket_ref = ?`);
const selectOpenDuplicate = db.prepare(`
    SELECT * FROM tickets
    WHERE session_id = ? AND lower(question) = lower(?)
      AND status IN ('Open', 'In Progress')
    ORDER BY id DESC LIMIT 1
`);
const selectLatestForSession = db.prepare(`
    SELECT * FROM tickets WHERE session_id = ? ORDER BY id DESC LIMIT 1
`);

const createTicketTx = db.transaction((fields) => {
    const info = insertTicket.run(
        `TMP-${crypto.randomUUID()}`,
        fields.sessionId,
        fields.question,
        fields.summary,
        fields.historyJson,
        fields.category,
        fields.priority,
        fields.department,
        fields.contactId
    );
    const id = Number(info.lastInsertRowid);
    const ref = `UNI-${new Date().getFullYear()}-${String(id).padStart(4, "0")}`;
    setTicketRef.run(ref, id);
    return ref;
});

/**
 * Opens an escalation ticket. If the same session already has an open
 * ticket for the same question, that ticket is returned instead of
 * creating a duplicate (students retry and rephrase a lot).
 *
 * @returns {{ ticket: object, created: boolean }}
 */
function createTicket({ sessionId, question, history = [], contact = null }) {
    const duplicate = selectOpenDuplicate.get(sessionId, question);
    if (duplicate) {
        return { ticket: publicView(duplicate), created: false };
    }

    const cleanHistory = history.map((m) => ({
        role: m.role,
        content: truncate(m.content, 2000),
    }));

    const category = classifyCategory(question, contact);
    const priority = classifyPriority(question, category);

    const ref = createTicketTx({
        sessionId,
        question: truncate(question, 2000),
        summary: buildSummary(question, cleanHistory, category, priority),
        historyJson: JSON.stringify(cleanHistory),
        category,
        priority,
        department: (contact && contact.department) || DEFAULT_DEPARTMENT,
        contactId: contact ? contact.contact_id || null : null,
    });

    return { ticket: publicView(selectByRef.get(ref)), created: true };
}

function getTicketByRef(ref) {
    return publicView(selectByRef.get(String(ref || "").trim().toUpperCase()));
}

function getTicketForAdmin(ref) {
    return adminView(selectByRef.get(String(ref || "").trim().toUpperCase()));
}

function getLatestTicketForSession(sessionId) {
    return publicView(selectLatestForSession.get(sessionId));
}

function normalizeStatus(value) {
    const wanted = String(value || "").trim().toLowerCase();
    return STATUSES.find((s) => s.toLowerCase() === wanted) || null;
}

function listTickets({ status = null, limit = 50 } = {}) {
    const cappedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const normalized = status ? normalizeStatus(status) : null;

    const rows = normalized
        ? db.prepare(`SELECT * FROM tickets WHERE status = ? ORDER BY id DESC LIMIT ?`).all(normalized, cappedLimit)
        : db.prepare(`SELECT * FROM tickets ORDER BY id DESC LIMIT ?`).all(cappedLimit);

    return rows.map(adminView);
}

/**
 * @returns the updated ticket (admin view), or null if the ref doesn't exist.
 * Throws if the status isn't one of STATUSES (routes validate first).
 */
function updateTicketStatus(ref, status) {
    const normalized = normalizeStatus(status);
    if (!normalized) {
        throw new Error(`Invalid status. Use one of: ${STATUSES.join(", ")}`);
    }

    const cleanRef = String(ref || "").trim().toUpperCase();
    const info = db
        .prepare(`UPDATE tickets SET status = ?, updated_at = datetime('now') WHERE ticket_ref = ?`)
        .run(normalized, cleanRef);

    if (info.changes === 0) return null;
    return adminView(selectByRef.get(cleanRef));
}


/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

const insertFeedback = db.prepare(
    `INSERT INTO feedback (session_id, rating, comment) VALUES (?, ?, ?)`
);

function recordFeedback({ sessionId = null, rating, comment = null }) {
    const normalized = String(rating || "").trim().toLowerCase();
    if (normalized !== "up" && normalized !== "down") {
        throw new Error('rating must be "up" or "down"');
    }
    insertFeedback.run(
        sessionId,
        normalized,
        comment ? truncate(comment, 1000) : null
    );
}


/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

function groupCounts(sql) {
    const out = {};
    for (const row of db.prepare(sql).all()) {
        out[row.key] = row.count;
    }
    return out;
}

function getStats() {
    let totalQuestions = 0;
    try {
        totalQuestions = db
            .prepare(`SELECT COUNT(*) AS c FROM conversations WHERE role = 'user'`)
            .get().c;
    } catch (err) {
        totalQuestions = 0; // conversations table not created yet
    }

    const totalTickets = db.prepare(`SELECT COUNT(*) AS c FROM tickets`).get().c;
    const feedback = groupCounts(`SELECT rating AS key, COUNT(*) AS count FROM feedback GROUP BY rating`);

    return {
        // Includes greetings and every other user message, so treat the
        // "answered directly" figure as an approximation.
        totalQuestions,
        escalatedTickets: totalTickets,
        answeredDirectly: Math.max(totalQuestions - totalTickets, 0),
        escalationRate: totalQuestions > 0
            ? Math.round((totalTickets / totalQuestions) * 1000) / 1000
            : 0,
        ticketsByStatus: groupCounts(`SELECT status AS key, COUNT(*) AS count FROM tickets GROUP BY status`),
        ticketsByDepartment: groupCounts(`SELECT department AS key, COUNT(*) AS count FROM tickets GROUP BY department`),
        ticketsByPriority: groupCounts(`SELECT priority AS key, COUNT(*) AS count FROM tickets GROUP BY priority`),
        ticketsByCategory: groupCounts(`SELECT category AS key, COUNT(*) AS count FROM tickets GROUP BY category`),
        feedback: {
            up: feedback.up || 0,
            down: feedback.down || 0,
        },
    };
}


module.exports = {
    STATUSES,
    createTicket,
    getTicketByRef,
    getTicketForAdmin,
    getLatestTicketForSession,
    listTickets,
    updateTicketStatus,
    normalizeStatus,
    recordFeedback,
    getStats,
};
