/**
 * apply-profile-and-tone.js
 * ==========================
 * One-time patch. Run from the backend folder:
 *
 *     node scripts/apply-profile-and-tone.js
 *
 * It makes four changes, then prints what it did:
 *   1. A student's year and semester travel in the sign-in token (with the
 *      programme that was already there), and the demo accounts get them.
 *   2. The chat route hands that profile to the chat service.
 *   3. The chat service passes it to retrieval and uses services/toneService.js
 *      for greetings, staff answers and the "couldn't find that" reply.
 *   4. Retrieval fills in a class-timetable question with the student's own
 *      programme, year and semester ("what's my timetable?").
 *
 * Safe to run twice. Each file is only written if every change in it matched;
 * otherwise that file is left alone and the script says which change missed.
 * The original of every file it changes is saved next to it as *.bak-before-profile.
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const done = [];
const problems = [];

function patchText(file, edits) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) { problems.push(`${file} was not found`); return; }

    const raw = fs.readFileSync(full, "utf8");
    const crlf = raw.includes("\r\n");
    let text = raw.replace(/\r\n/g, "\n");
    let changed = false;

    for (const [name, oldStr, newStr, marker] of edits) {
        if (text.includes(marker)) continue; // already applied
        const count = text.split(oldStr).length - 1;
        if (count !== 1) {
            problems.push(`${file}: the "${name}" change matched ${count} times (expected 1), so this file was left unchanged`);
            return;
        }
        text = text.replace(oldStr, () => newStr);
        changed = true;
    }

    if (!changed) { done.push(`${file}: already patched`); return; }

    const backup = full + ".bak-before-profile";
    if (!fs.existsSync(backup)) fs.copyFileSync(full, backup);
    fs.writeFileSync(full, crlf ? text.replace(/\n/g, "\r\n") : text);
    done.push(`${file}: patched`);
}


/* 1. sign-in token carries year and semester */
patchText("services/authService.js", [
    ["user profile", `        role: user.role,
        programme: user.programme || null,
    };
}`, `        role: user.role,
        programme: user.programme || null,
        year: user.year || null, // profile:public
        semester: user.semester || null,
    };
}`, "// profile:public"],
    ["token payload", `        role: user.role,
        programme: user.programme || null,
        iat: now,`, `        role: user.role,
        programme: user.programme || null,
        year: user.year || null, // profile:token
        semester: user.semester || null,
        iat: now,`, "// profile:token"],
    ["token check", `            role: payload.role,
            programme: payload.programme || null,
        },`, `            role: payload.role,
            programme: payload.programme || null,
            year: payload.year || null, // profile:verify
            semester: payload.semester || null,
        },`, "// profile:verify"],
]);

// demo accounts: year 3, semester 2 (the cohort the demo timetable uses)
(function demoUsers() {
    const file = "data/demo_users.json";
    const full = path.join(root, file);
    if (!fs.existsSync(full)) { problems.push(`${file} was not found`); return; }
    const raw = fs.readFileSync(full, "utf8");
    const data = JSON.parse(raw);
    let changed = false;
    for (const user of data.users || []) {
        if (user.role === "student" && user.programme && user.year == null) {
            user.year = 3;
            user.semester = 2;
            changed = true;
        }
    }
    if (!changed) { done.push(`${file}: already has year and semester`); return; }
    const backup = full + ".bak-before-profile";
    if (!fs.existsSync(backup)) fs.copyFileSync(full, backup);
    fs.writeFileSync(full, JSON.stringify(data, null, 2) + (raw.includes("\r\n") ? "\r\n" : "\n"));
    done.push(`${file}: added year 3, semester 2 to the student accounts (edit them to suit)`);
})();


/* 2. chat route hands the profile on */
patchText("routes/chatRoutes.js", [
    ["profile", `    const audience = req.user ? "student" : "public";
`, `    const audience = req.user ? "student" : "public";

    // Who is asking, taken from the signed token: used to personalise
    // ("my timetable") and to greet them by name.
    const profile = req.user
        ? { name: req.user.name, programme: req.user.programme, year: req.user.year, semester: req.user.semester }
        : null;
`, "const profile = req.user"],
    ["call", `                sessionId,
                audience
            );`, `                sessionId,
                audience,
                profile
            );`, "audience,\n                profile"],
]);


/* 3. chat service: profile, greetings, staff answers, fallback */
patchText("services/chatService.js", [
    ["require", `const sessionService = require("./sessionService");`, `const sessionService = require("./sessionService");
const toneService = require("./toneService");`, "require(\"./toneService\")"],
    ["signature", `async function answerQuestion(question, sessionId, audience = "public") {`,
        `async function answerQuestion(question, sessionId, audience = "public", profile = null) {`, "audience = \"public\", profile = null"],
    ["greeting", `const greeting = "Hi! How can I help you today?";`,
        `const greeting = toneService.greetingFor(question, profile);`, "toneService.greetingFor"],
    ["staff answer", `        faqService.recordUse(staffAnswer.id);
        sessionService.appendMessage(sessionId, "assistant", staffAnswer.answer);
        return {
            answer: staffAnswer.answer,`, `        faqService.recordUse(staffAnswer.id);
        const staffReply = await toneService.rephrase(question, staffAnswer.answer, { kind: "staff" });
        sessionService.appendMessage(sessionId, "assistant", staffReply);
        return {
            answer: staffReply,`, "const staffReply"],
    ["retrieval call", `retrievalService.retrieveAnswer(question, priorHistory, audience);`,
        `retrievalService.retrieveAnswer(question, priorHistory, audience, profile);`, "priorHistory, audience, profile"],
    ["fallback voice", `    return {
        answer,
        queryType,
        sources: [],`, `    answer = await toneService.rephrase(question, answer, { kind: "fallback" });

    return {
        answer,
        queryType,
        sources: [],`, "kind: \"fallback\""],
]);


/* 4. retrieval: fill in the student's own programme, year and semester */
patchText("services/retrievalRouter.js", [
    ["profile defaults", `/**
 * The one retrieval entry point the rest of the backend should call.`, `// A signed-in student's profile (programme, year, semester) fills in what a
// class-timetable question leaves out, e.g. "what's my timetable?". It never
// touches exam, course, venue or lecturer questions.
function applyProfileDefaults(queryType, query, profile) {
  if (!profile || !profile.programme) return queryType;
  const entities = queryType.entities;
  if (entities.courseCode || entities.venueCode || entities.lecturer) return queryType;

  const text = String(query || "");
  const asksForClasses = /\\b(timetable|time table|classes|class|lectures?|schedule)\\b/i.test(text);
  const asksSomethingElse = /\\b(exams?|tests?|assessments?|results?|graduat\\w*|fees?)\\b/i.test(text);
  if (!asksForClasses || asksSomethingElse) return queryType;

  const family = String(profile.programme).trim().toUpperCase();
  if (!timetableService.isKnownProgrammeFamily(family)) return queryType;
  if (entities.programmeFamily && entities.programmeFamily !== family) return queryType;

  const filled = { ...entities };
  if (!filled.programmeFamily) filled.programmeFamily = family;
  const year = Number(profile.year) || null;
  const semester = Number(profile.semester) || null;
  if (filled.year == null && filled.semester == null && year && semester) {
    filled.year = year;
    filled.semester = semester;
  }
  filled.fromProfile = true;
  return { ...queryType, isTimetable: true, entities: filled };
}

/**
 * The one retrieval entry point the rest of the backend should call.`, "function applyProfileDefaults"],
    ["signature", `async function retrieveAnswer(query, history = [], audience = "public") {`,
        `async function retrieveAnswer(query, history = [], audience = "public", profile = null) {`, "audience = \"public\", profile = null"],
    ["use defaults", `  const queryType = classifyQuery(effectiveQuery);
`, `  const queryType = applyProfileDefaults(classifyQuery(effectiveQuery), effectiveQuery, isStudent ? profile : null);
`, "applyProfileDefaults(classifyQuery"],
]);


/* retrievalService must hand the extra argument through */
(function checkRetrievalService() {
    const full = path.join(root, "services/retrievalService.js");
    if (!fs.existsSync(full)) return;
    const text = fs.readFileSync(full, "utf8");
    if (!/module\.exports\s*=\s*require\(\s*["']\.\/retrievalRouter["']\s*\)/.test(text)) {
        problems.push("services/retrievalService.js is not a plain re-export of retrievalRouter, so it may drop the new profile argument. Send me that file.");
    }
})();

if (!fs.existsSync(path.join(root, "services/toneService.js"))) {
    problems.push("services/toneService.js is missing. Copy it into backend/services first.");
}

console.log("\nDone:");
for (const line of done) console.log("  - " + line);
if (problems.length) {
    console.log("\nNeeds attention:");
    for (const line of problems) console.log("  ! " + line);
    process.exitCode = 1;
} else {
    console.log("\nAll changes applied. Restart the backend (npm start).");
}
