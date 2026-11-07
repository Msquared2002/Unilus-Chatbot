/**
 * db.js
 * ======
 * The one place the backend opens its database.
 *
 *   DATABASE_URL set   -> PostgreSQL (hosted: Supabase, Render, Neon, ...)
 *   DATABASE_URL empty -> the local SQLite file, exactly as before
 *
 * Every method is async, so services are written once and run on both.
 * Write SQL with "?" placeholders; they are converted to $1, $2, ... for
 * PostgreSQL automatically.
 *
 *   await db.get(sql, params)      one row, or undefined
 *   await db.all(sql, params)      array of rows
 *   await db.run(sql, params)      { changes }
 *   await db.insert(sql, params)   the new row's id
 *   db.now                         SQL for "the current UTC time" (text,
 *                                  'YYYY-MM-DD HH:MM:SS' on both databases)
 *   db.schema({ sqlite: [...], postgres: [...] })
 *                                  tables to create when the server starts
 *   db.dialect                     "sqlite" | "postgres"
 *
 * Timestamps are stored as that same text format on both databases, so the
 * services read them identically.
 *
 * Optional .env settings:
 *   DATABASE_URL    postgres://user:password@host:5432/dbname
 *   DATABASE_SSL    "off" to turn SSL off (it is on by default for hosted databases)
 *   SQLITE_FILE     path of the SQLite file (default data/conversations.db)
 */

const path = require("path");

const dialect = process.env.DATABASE_URL ? "postgres" : "sqlite";

const toPg = (sql) => {
    let n = 0;
    return sql.replace(/\?/g, () => `$${++n}`);
};

let impl;

if (dialect === "postgres") {
    const { Pool } = require("pg");
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: String(process.env.DATABASE_SSL || "").toLowerCase() === "off" ? false : { rejectUnauthorized: false },
        max: Number(process.env.DATABASE_POOL_MAX) || 5,
    });
    pool.on("error", (err) => console.log("[db] idle connection error:", err.message));

    impl = {
        now: "to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')",
        async all(sql, params = []) { return (await pool.query(toPg(sql), params)).rows; },
        async run(sql, params = []) { return { changes: (await pool.query(toPg(sql), params)).rowCount }; },
        async insert(sql, params = []) {
            const result = await pool.query(`${toPg(sql)} RETURNING id`, params);
            return Number(result.rows[0].id);
        },
        async exec(sql) { await pool.query(sql); },
        async close() { await pool.end(); },
    };
} else {
    const Database = require("better-sqlite3");
    const file = process.env.SQLITE_FILE || path.join(__dirname, "../data/conversations.db");
    const sqlite = new Database(file);

    impl = {
        now: "datetime('now')",
        async all(sql, params = []) { return sqlite.prepare(sql).all(...params); },
        async run(sql, params = []) { return { changes: sqlite.prepare(sql).run(...params).changes }; },
        async insert(sql, params = []) { return Number(sqlite.prepare(sql).run(...params).lastInsertRowid); },
        async exec(sql) { sqlite.exec(sql); },
        async close() { sqlite.close(); },
    };
}

// Tables are created in the order services register them, before any query runs.
let ready = Promise.resolve();
ready.catch(() => {});

function schema(definition) {
    const statements = definition[dialect] || [];
    ready = ready.then(async () => {
        for (const statement of statements) await impl.exec(statement);
    });
    ready.catch((err) => console.log("[db] could not create tables:", err.message));
}

module.exports = {
    dialect,
    now: impl.now,
    schema,
    ready: () => ready,
    async get(sql, params) { await ready; return (await impl.all(sql, params))[0]; },
    async all(sql, params) { await ready; return impl.all(sql, params); },
    async run(sql, params) { await ready; return impl.run(sql, params); },
    async insert(sql, params) { await ready; return impl.insert(sql, params); },
    async close() { return impl.close(); },
};
