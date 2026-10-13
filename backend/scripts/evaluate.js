#!/usr/bin/env node
/**
 * evaluate.js
 * ============
 * Runs a CSV of test questions against the chatbot's /api/chat endpoint
 * and reports accuracy and response time. No dependencies; needs Node 18+
 * (the same Node your backend already runs on).
 *
 * Usage (from the backend folder, with the server running):
 *     node scripts/evaluate.js
 *     node scripts/evaluate.js --file eval/my-questions.csv --delay 1000
 *
 * Options:
 *     --file      path to the questions CSV   (default: eval/test-questions.csv)
 *     --url       chat endpoint               (default: http://localhost:5000/api/chat)
 *     --delay     ms to wait between questions (default: 600, to stay under
 *                 the AI provider's rate limit)
 *     --user      sign-in username for "student" rows (or env EVAL_USERNAME)
 *     --password  sign-in password for "student" rows (or env EVAL_PASSWORD)
 *     --login-url sign-in endpoint (default: derived from --url)
 *
 * CSV columns:
 *     id, category, audience, session, question, expected_contains, should_escalate
 *
 *   audience           student  = signs in first and sends the token (a signed-in student)
 *                      public   = sends no token (an anonymous visitor)
 *                      spoofed  = sends no token but claims audience "student" in the
 *                                 request body; the server must treat this as public
 *
 *   expected_contains  facts that must ALL appear in the answer, separated
 *                      by | (case-insensitive; dashes and spacing are
 *                      normalised, so "09:00-12:00" matches "09:00 – 12:00")
 *   should_escalate    "yes" if the bot should NOT answer and should hand the
 *                      question to staff instead (usedFallback = true)
 *   session            rows with the same label share one conversation, for
 *                      follow-up tests; leave blank for independent questions
 *
 * Lines starting with # are ignored.
 *
 * Output: a per-question line, a summary, and a results CSV saved in the
 * same folder as the questions file (results-YYYYMMDD-HHMMSS.csv).
 *
 * NOTE: questions that get escalated create real tickets in your database
 * (their session ids start with "eval-").
 */

const fs = require("fs");
const path = require("path");

/* ------------------------------ options ------------------------------ */

function parseArgs(list) {
    const out = {};
    for (let i = 0; i < list.length; i++) {
        if (list[i].startsWith("--")) {
            out[list[i].slice(2)] = list[i + 1];
            i++;
        }
    }
    return out;
}

const args = parseArgs(process.argv.slice(2));
const CHAT_URL = args.url || "http://localhost:5000/api/chat";
const QUESTIONS_FILE = path.resolve(
    args.file || path.join(__dirname, "../eval/test-questions.csv")
);
const DELAY_MS = args.delay !== undefined ? Number(args.delay) : 600;
const TIMEOUT_MS = 60000;
const EVAL_USER = args.user || process.env.EVAL_USERNAME || "";
const EVAL_PASS = args.password || process.env.EVAL_PASSWORD || "";
const LOGIN_URL = args["login-url"] || CHAT_URL.replace(/\/api\/chat\/?$/, "/api/auth/login");
const RUN_ID = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);


/* ------------------------------- CSV -------------------------------- */

function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    text = text.replace(/^\uFEFF/, "");

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') { cell += '"'; i++; }
                else inQuotes = false;
            } else {
                cell += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ",") {
            row.push(cell);
            cell = "";
        } else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && text[i + 1] === "\n") i++;
            row.push(cell);
            cell = "";
            rows.push(row);
            row = [];
        } else {
            cell += ch;
        }
    }
    if (cell !== "" || row.length) {
        row.push(cell);
        rows.push(row);
    }

    return rows.filter(
        (r) => r.some((c) => c.trim() !== "") && !String(r[0]).trim().startsWith("#")
    );
}

function csvEscape(value) {
    const s = String(value == null ? "" : value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function loadQuestions(file) {
    if (!fs.existsSync(file)) {
        console.error(`Questions file not found: ${file}`);
        process.exit(1);
    }
    const rows = parseCsv(fs.readFileSync(file, "utf8"));
    if (rows.length < 2) {
        console.error("The questions file needs a header row and at least one question.");
        process.exit(1);
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const col = (name) => header.indexOf(name);
    for (const required of ["id", "question"]) {
        if (col(required) === -1) {
            console.error(`Missing required column: ${required}`);
            process.exit(1);
        }
    }

    return rows.slice(1).map((r) => {
        const get = (name) => (col(name) === -1 ? "" : String(r[col(name)] || "").trim());
        return {
            id: get("id"),
            category: get("category") || "general",
            audience: ["public", "spoofed"].includes(get("audience")) ? get("audience") : "student",
            session: get("session"),
            question: get("question"),
            expected: get("expected_contains")
                .split("|")
                .map((p) => p.trim())
                .filter(Boolean),
            shouldEscalate: /^(yes|y|true|1)$/i.test(get("should_escalate")),
        };
    });
}


/* ------------------------------ judging ----------------------------- */

function normalize(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[\u2010-\u2015\u2212]/g, "-")
        .replace(/[*_`|]/g, " ")
        .replace(/\s*-\s*/g, "-")
        .replace(/\s+/g, " ")
        .trim();
}

function judge(test, response) {
    if (response.networkError) {
        return { pass: false, escalated: false, missing: [], reason: `network: ${response.networkError}` };
    }
    if (response.data.error === true) {
        return { pass: false, escalated: false, missing: [], reason: "server error (is the AI service reachable?)" };
    }
    if (!response.ok) {
        return { pass: false, escalated: false, missing: [], reason: `HTTP ${response.status}` };
    }

    const answer = String(response.data.answer || "");
    const escalated = response.data.usedFallback === true;

    if (test.shouldEscalate) {
        return escalated
            ? { pass: true, escalated, missing: [], reason: "" }
            : { pass: false, escalated, missing: [], reason: "expected escalation but the bot answered" };
    }

    if (escalated) {
        return { pass: false, escalated, missing: [], reason: "unexpected fallback (bot said it had no information)" };
    }

    const normalizedAnswer = normalize(answer);
    const missing = test.expected.filter((part) => !normalizedAnswer.includes(normalize(part)));

    if (!answer.trim()) {
        return { pass: false, escalated, missing, reason: "empty answer" };
    }
    return missing.length
        ? { pass: false, escalated, missing, reason: "missing expected facts" }
        : { pass: true, escalated, missing, reason: "" };
}


/* ------------------------------ requests ---------------------------- */

async function login() {
    try {
        const res = await fetch(LOGIN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: EVAL_USER, password: EVAL_PASS }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.token) {
            console.error(`Sign-in failed (HTTP ${res.status}): ${data.error || "unknown error"}`);
            process.exit(1);
        }
        return data.token;
    } catch (err) {
        console.error(`Could not reach the sign-in endpoint ${LOGIN_URL}: ${err.message}`);
        process.exit(1);
    }
}

async function ask(test, sessionId, token) {
    const started = performance.now();
    try {
        const headers = { "Content-Type": "application/json" };
        // Only genuine "student" rows carry a token. "public" and "spoofed"
        // rows must not, otherwise they would not test anything.
        if (test.audience === "student" && token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const res = await fetch(CHAT_URL, {
            method: "POST",
            headers,
            body: JSON.stringify({
                question: test.question,
                // The server ignores this field and decides access from the
                // token. "spoofed" rows send "student" to prove that.
                audience: test.audience === "public" ? "public" : "student",
                sessionId,
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data, ms: performance.now() - started };
    } catch (err) {
        return {
            ok: false,
            status: 0,
            data: {},
            ms: performance.now() - started,
            networkError: err.message,
        };
    }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


/* ------------------------------ reporting --------------------------- */

function percentile(sorted, p) {
    if (!sorted.length) return 0;
    const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[Math.max(index, 0)];
}

function pct(part, whole) {
    return whole ? `${((part / whole) * 100).toFixed(1)}%` : "n/a";
}

function printSummary(results) {
    const total = results.length;
    const passed = results.filter((r) => r.pass).length;
    const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
    const avg = latencies.reduce((sum, v) => sum + v, 0) / (latencies.length || 1);

    console.log("\n==================== SUMMARY ====================");
    console.log(`Questions run:      ${total}`);
    console.log(`Passed:             ${passed}  (accuracy ${pct(passed, total)})`);
    console.log(`Failed:             ${total - passed}`);
    console.log(
        `Response time (ms): avg ${avg.toFixed(0)} | median ${percentile(latencies, 50).toFixed(0)} | ` +
        `p95 ${percentile(latencies, 95).toFixed(0)} | max ${(latencies[latencies.length - 1] || 0).toFixed(0)}`
    );

    const shouldEscalate = results.filter((r) => r.shouldEscalate);
    if (shouldEscalate.length) {
        const correct = shouldEscalate.filter((r) => r.pass).length;
        console.log(`Escalation tests:   ${correct}/${shouldEscalate.length} handled correctly`);
    }

    const byCategory = {};
    for (const r of results) {
        byCategory[r.category] = byCategory[r.category] || { total: 0, passed: 0 };
        byCategory[r.category].total++;
        if (r.pass) byCategory[r.category].passed++;
    }
    console.log("\nBy category:");
    for (const [category, v] of Object.entries(byCategory)) {
        console.log(`  ${category.padEnd(20)} ${v.passed}/${v.total}  (${pct(v.passed, v.total)})`);
    }

    const failures = results.filter((r) => !r.pass);
    if (failures.length) {
        console.log("\nFailures:");
        for (const f of failures) {
            const detail = f.missing.length ? ` [missing: ${f.missing.join(", ")}]` : "";
            console.log(`  ${f.id}  "${f.question}"  ->  ${f.reason}${detail}`);
        }
    }
    console.log("=================================================");
}

function writeResultsCsv(results, folder) {
    const header = [
        "id", "category", "audience", "question", "pass", "latency_ms",
        "escalated", "ticket", "reason", "missing", "answer",
    ];
    const lines = [header.join(",")];
    for (const r of results) {
        lines.push([
            r.id, r.category, r.audience, r.question,
            r.pass ? "PASS" : "FAIL",
            Math.round(r.ms),
            r.escalated ? "yes" : "no",
            r.ticket || "",
            r.reason,
            r.missing.join("; "),
            String(r.answer || "").replace(/\s+/g, " ").slice(0, 600),
        ].map(csvEscape).join(","));
    }
    const file = path.join(folder, `results-${RUN_ID}.csv`);
    fs.writeFileSync(file, lines.join("\n"), "utf8");
    return file;
}


/* -------------------------------- main ------------------------------ */

async function main() {
    const tests = loadQuestions(QUESTIONS_FILE);
    console.log(`Running ${tests.length} questions against ${CHAT_URL}`);
    console.log(`Delay between questions: ${DELAY_MS} ms\n`);

    let token = null;
    if (tests.some((t) => t.audience === "student")) {
        if (!EVAL_USER || !EVAL_PASS) {
            console.error(
                'Some questions use audience "student", which needs a signed-in account.\n' +
                'Run again with:  node scripts\\evaluate.js --user <username> --password <password>\n' +
                '(or set EVAL_USERNAME and EVAL_PASSWORD).'
            );
            process.exit(1);
        }
        token = await login();
        console.log(`Signed in as ${EVAL_USER}\n`);
    }

    const sessions = new Map();
    const results = [];

    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];

        let sessionId;
        if (test.session) {
            if (!sessions.has(test.session)) sessions.set(test.session, `eval-${RUN_ID}-${test.session}`);
            sessionId = sessions.get(test.session);
        } else {
            sessionId = `eval-${RUN_ID}-${test.id}`;
        }

        const response = await ask(test, sessionId, token);
        const verdict = judge(test, response);

        results.push({
            ...test,
            ...verdict,
            ms: response.ms,
            answer: response.data.answer || "",
            ticket: response.data.ticket ? response.data.ticket.ref : "",
        });

        console.log(
            `${verdict.pass ? "PASS" : "FAIL"}  ${String(test.id).padEnd(5)} ` +
            `${test.category.padEnd(18)} ${Math.round(response.ms)} ms` +
            (verdict.reason ? `  (${verdict.reason})` : "")
        );

        if (i < tests.length - 1 && DELAY_MS > 0) await sleep(DELAY_MS);
    }

    printSummary(results);
    const resultsFile = writeResultsCsv(results, path.dirname(QUESTIONS_FILE));
    console.log(`\nDetailed results saved to: ${resultsFile}`);
}

main().catch((err) => {
    console.error("Evaluation failed:", err);
    process.exit(1);
});
