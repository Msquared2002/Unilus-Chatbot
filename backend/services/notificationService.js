/**
 * notificationService.js
 * =======================
 *
 * Short "something changed" notices for students, shown by the chat widget.
 *
 * Changes: New notifications table and helpers.
 * Affects: knowledgeUpdater (creates notices on upload / website refresh),
 *          supportRoutes (creates a notice when staff update a ticket),
 *          routes/notificationRoutes.js (the widget reads them).
 * Purpose: Students hear about new documents and ticket progress without having
 *          to ask the chatbot.
 *
 * Who sees a notice (the "audience" column):
 *   public   everyone, including visitors who are not signed in
 *   student  signed-in users only (used for documents staff marked restricted,
 *            so the title of a restricted document is never shown to visitors)
 *   user     only the signed-in account named in user_id (ticket updates for portal students,
 *            so they see it on any device, not just the browser that opened the ticket)
 *   session  only the chat session named in session_id (ticket updates for visitors)
 *
 * "Read" state is kept by the widget (the id of the newest notice it has shown),
 * so it also works for visitors who have no account.
 *
 * Runs on PostgreSQL or SQLite through services/db.js. Creating a notice never
 * throws: a failed notice must not break an upload or a ticket update.
 */

const db = require("./db");

const KINDS = ["knowledge", "ticket", "general"];
const AUDIENCES = ["public", "student", "session", "user"];

const RECENT_DAYS = Number(process.env.NOTIFICATION_RECENT_DAYS) || 14;

db.schema({
    sqlite: [
        `CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT,
            audience TEXT NOT NULL,
            session_id TEXT,
            ref TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (id)`,
    ],
    postgres: [
        `CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT,
            audience TEXT NOT NULL,
            session_id TEXT,
            ref TEXT,
            created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
        )`,
        `CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (id)`,
    ],
});

// notifications was first created without user_id, so add it to existing databases.
const columnReady = (async () => {
    try {
        await db.run(`ALTER TABLE notifications ADD COLUMN ${db.dialect === "postgres" ? "IF NOT EXISTS " : ""}user_id TEXT`);
    } catch (err) {
        if (!/duplicate column|already exists/i.test(err.message)) console.log("[notifications] could not add user_id:", err.message);
    }
})();

const clip = (text, max) => {
    const s = String(text == null ? "" : text).trim();
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

const toIso = (stored) => (stored ? `${String(stored).replace(" ", "T")}Z` : null);

function cutoffTimestamp(days) {
    return new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace("T", " ");
}

function view(row) {
    return {
        id: Number(row.id),
        kind: row.kind,
        title: row.title,
        body: row.body || "",
        ref: row.ref || null,
        created_at: toIso(row.created_at),
    };
}

/**
 * Stores a notice. Returns its id, or null if it could not be saved.
 * @param {object} n
 * @param {"knowledge"|"ticket"|"general"} n.kind
 * @param {string} n.title
 * @param {string} [n.body]
 * @param {"public"|"student"|"session"} [n.audience]
 * @param {string} [n.sessionId]  required when audience is "session"
 * @param {string} [n.ref]        e.g. the ticket reference
 */
async function create({ kind = "general", title, body = "", audience = "public", sessionId = null, username = null, ref = null }) {
    try {
        await columnReady;
        if (!title || !String(title).trim()) return null;
        if (!AUDIENCES.includes(audience)) return null;
        if (audience === "session" && !sessionId) return null;
        if (audience === "user" && !username) return null;

        return await db.insert(
            `INSERT INTO notifications (kind, title, body, audience, session_id, user_id, ref)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                KINDS.includes(kind) ? kind : "general",
                clip(title, 160),
                clip(body, 500) || null,
                audience,
                audience === "session" ? sessionId : null,
                audience === "user" ? String(username).toLowerCase() : null,
                ref ? clip(ref, 60) : null,
            ]
        );
    } catch (err) {
        console.log("[notifications] could not save a notice:", err.message);
        return null;
    }
}

/**
 * What one visitor should see, oldest first.
 * @param {object} who
 * @param {number} [who.after]       only notices with an id above this (the widget's last-seen id)
 * @param {boolean} [who.signedIn]
 * @param {string} [who.username]    the signed-in account (from the token, never from the query string)
 * @param {string} [who.sessionId]
 * @param {number} [who.limit]       default 10, max 30
 * @returns {Promise<{ items: object[], latestId: number }>} latestId is the newest id this visitor may see
 */
async function listFor({ after = 0, signedIn = false, username = null, sessionId = null, limit = 10 } = {}) {
    await columnReady;
    const cap = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 30);

    const visible = ["audience = 'public'"];
    const visibleParams = [];
    if (signedIn) visible.push("audience = 'student'");
    if (signedIn && username) {
        visible.push("(audience = 'user' AND user_id = ?)");
        visibleParams.push(String(username).toLowerCase());
    }
    if (sessionId) {
        visible.push("(audience = 'session' AND session_id = ?)");
        visibleParams.push(String(sessionId));
    }
    const visibleSql = `(${visible.join(" OR ")})`;
    const since = cutoffTimestamp(RECENT_DAYS);

    const latestRow = await db.get(
        `SELECT MAX(id) AS id FROM notifications WHERE ${visibleSql} AND created_at >= ?`,
        [...visibleParams, since]
    );

    // Newest first in SQL so the limit keeps the most recent, then flipped to oldest first.
    const rows = await db.all(
        `SELECT * FROM notifications
         WHERE id > ? AND ${visibleSql} AND created_at >= ?
         ORDER BY id DESC LIMIT ?`,
        [Math.max(parseInt(after, 10) || 0, 0), ...visibleParams, since, cap]
    );

    return {
        items: rows.reverse().map(view),
        latestId: latestRow && latestRow.id ? Number(latestRow.id) : 0,
    };
}

/* ---------------------- ready-made notices ---------------------- */

// A staff upload. Restricted documents are announced to signed-in users only.
function documentAdded({ title, access, replaced }) {
    return create({
        kind: "knowledge",
        title: replaced ? `Updated: ${title}` : `New information: ${title}`,
        body: replaced
            ? "This document was updated. Ask me about it to get the latest details."
            : "I can now answer questions about this. Ask me anything about it.",
        audience: access === "public" ? "public" : "student",
    });
}

function websiteUpdated({ added = 0, updated = 0 }) {
    if (String(process.env.NOTIFY_WEBSITE_REFRESH || "true").toLowerCase() === "false") return Promise.resolve(null);
    if (!added && !updated) return Promise.resolve(null);
    return create({
        kind: "knowledge",
        title: "University website information updated",
        body: "I've refreshed what I know from the UNILUS website. Ask me if you want the latest details.",
        audience: "public",
    });
}

// Wording per status. `snippet` is the student's own question (they are the only reader).
const TICKET_NOTICES = {
    "In Progress": (ref) => ({ title: `Ticket ${ref} is being handled`, body: "A staff member has picked up your request." }),
    Resolved: (ref, snippet) => ({
        title: `Ticket ${ref} has been resolved`,
        body: snippet
            ? `Your question "${snippet}" has been dealt with. Ask me again to get the latest answer.`
            : "Staff have marked your request as resolved. Ask me again to get the latest answer.",
    }),
    Closed: (ref) => ({ title: `Ticket ${ref} was closed`, body: "This request has been closed." }),
};

/**
 * Notice for whoever opened a ticket: the signed-in account when there is one
 * (so it shows on the portal on any device), otherwise the chat session.
 */
function ticketStatusChanged({ ref, status, sessionId = null, username = null, question = "" }) {
    const build = TICKET_NOTICES[status];
    if (!build) return Promise.resolve(null);

    const snippet = clip(question, 90);
    const notice = build(ref, snippet);
    if (username) return create({ kind: "ticket", audience: "user", username, ref, ...notice });
    if (sessionId) return create({ kind: "ticket", audience: "session", sessionId, ref, ...notice });
    return Promise.resolve(null);
}

module.exports = { create, listFor, documentAdded, websiteUpdated, ticketStatusChanged };
