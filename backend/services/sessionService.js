/**
 * sessionService.js
 * ==================
 *
 * Persists conversation turns to a real SQLite database (via
 * better-sqlite3 -- an embedded, serverless, file-based DB, no
 * Docker/Postgres setup required) so:
 *   1. Follow-up questions in the SAME session can reference what
 *      was just asked (aiService is given the recent history).
 *   2. Conversation history survives a server restart, satisfying
 *      the "Conversations" entity in the Database Layer requirement.
 *
 * Deliberately NOT a self-learning mechanism: history changes what
 * the model sees as CONTEXT for follow-ups within a conversation. It
 * never changes what the model treats as verified fact -- that still
 * only happens when a human adds/reviews a document (see
 * unansweredLogger.js).
 */

const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const db = new Database(path.join(__dirname, "../data/conversations.db"));

db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_session
        ON conversations (session_id, id);
`);

const insertMessage = db.prepare(
    `INSERT INTO conversations (session_id, role, content) VALUES (?, ?, ?)`
);

const selectRecentMessages = db.prepare(
    `SELECT role, content FROM conversations
     WHERE session_id = ?
     ORDER BY id DESC
     LIMIT ?`
);


function createSessionId() {
    return crypto.randomUUID();
}


function appendMessage(sessionId, role, content) {
    insertMessage.run(sessionId, role, content);
}


/**
 * Returns the last `limit` turns (default: last 3 exchanges = 6
 * messages) for a session, oldest first, ready to feed to the LLM as
 * conversation history. Kept short on purpose -- more history means
 * more tokens per request and more chances for an old, irrelevant
 * turn to confuse a new question.
 */
function getRecentHistory(sessionId, limit = 6) {
    const rows = selectRecentMessages.all(sessionId, limit);
    return rows.reverse(); // oldest first, as the LLM expects
}


module.exports = {
    createSessionId,
    appendMessage,
    getRecentHistory,
};