/**
 * sessionService.js
 * ==================
 *
 * Persists conversation turns so:
 *   1. Follow-up questions in the SAME session can reference what
 *      was just asked (aiService is given the recent history).
 *   2. Conversation history survives a server restart, satisfying
 *      the "Conversations" entity in the Database Layer requirement.
 *
 * Runs on PostgreSQL (when DATABASE_URL is set) or the local SQLite file,
 * through services/db.js. appendMessage and getRecentHistory are async.
 *
 * Deliberately NOT a self-learning mechanism: history changes what
 * the model sees as CONTEXT for follow-ups within a conversation. It
 * never changes what the model treats as verified fact -- that still
 * only happens when a human adds/reviews a document (see
 * unansweredLogger.js).
 */

const crypto = require("crypto");
const db = require("./db");

db.schema({
    sqlite: [
        `CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations (session_id, id)`,
    ],
    postgres: [
        `CREATE TABLE IF NOT EXISTS conversations (
            id SERIAL PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
        )`,
        `CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations (session_id, id)`,
    ],
});


// Pure helper: stays synchronous.
function createSessionId() {
    return crypto.randomUUID();
}


async function appendMessage(sessionId, role, content) {
    if(role==='user' && require('./applicantResultParser').extract(content).length)content=require('./applicantResultParser').withoutResults(content).trim() || '[Academic results omitted from persistent history]';
    content=require("./supportContactService").redact(content);
    await db.run(
        `INSERT INTO conversations (session_id, role, content) VALUES (?, ?, ?)`,
        [sessionId, role, content]
    );
}


/**
 * Returns the last `limit` turns (default: last 3 exchanges = 6
 * messages) for a session, oldest first, ready to feed to the LLM as
 * conversation history. Kept short on purpose -- more history means
 * more tokens per request and more chances for an old, irrelevant
 * turn to confuse a new question.
 */
async function getRecentHistory(sessionId, limit = 6) {
    const rows = await db.all(
        `SELECT role, content FROM conversations
         WHERE session_id = ?
         ORDER BY id DESC
         LIMIT ?`,
        [sessionId, limit]
    );
    return rows.reverse().map(row=>({...row,content:require('./supportContactService').redact(row.content)})).map(row=>row.role==='assistant'&&(/\|\s*(?:Course|Period)\s*\|[^\n]*(?:CA|Grade|Final mark)|Student ID:|Simulated demonstration records/i.test(row.content))?{...row,content:'[Private academic response omitted from model history]'}:row); // Never send older stored academic tables/identity to the general LLM.
}


module.exports = {
    createSessionId,
    appendMessage,
    getRecentHistory,
};
