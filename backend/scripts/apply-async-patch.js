/**
 * apply-async-patch.js
 * =====================
 * The PostgreSQL move (phases 1 and 2). Run from the backend folder:
 *
 *     node scripts/apply-async-patch.js
 *
 * The ticket, taught-answer and conversation-history services are now async (they may talk to a
 * database over the network), so the one file that calls them from inside the
 * chat flow, services/chatService.js, must wait for them. This adds the
 * missing "await"s. Nothing else changes.
 *
 * Safe to run twice. The original is saved as chatService.js.bak-before-async.
 */

const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "../services/chatService.js");
if (!fs.existsSync(file)) {
    console.log("services/chatService.js was not found. Run this from the backend folder.");
    process.exit(1);
}

const raw = fs.readFileSync(file, "utf8");
const crlf = raw.includes("\r\n");
let text = raw.replace(/\r\n/g, "\n");
const before = text;
const notes = [];

function addAwait(call) {
    const pattern = new RegExp("(?<!await )\\b" + call.replace(".", "\\.") + "\\(", "g");
    const count = (text.match(pattern) || []).length;
    text = text.replace(pattern, `await ${call}(`);
    if (count) notes.push(`${count} x ${call}`);
}

// the status helper calls the ticket service, so it becomes async too
text = text.replace(/(?<!async )function handleTicketStatusQuestion\(/, () => { notes.push("handleTicketStatusQuestion is now async"); return "async function handleTicketStatusQuestion("; });
text = text.replace(/(?<!function )(?<!await )\bhandleTicketStatusQuestion\(question, sessionId\)/, () => { notes.push("its call site now awaits it"); return "await handleTicketStatusQuestion(question, sessionId)"; });

// getRecentHistory(...).slice(...) needs the await wrapped around the call, not the slice
text = text.replace(/(?<!await )sessionService\.getRecentHistory\(([^)]*)\)\.slice\(/g, (_, args) => {
    notes.push("sessionService.getRecentHistory(...).slice");
    return `(await sessionService.getRecentHistory(${args})).slice(`;
});

for (const call of [
    "sessionService.appendMessage",
    "sessionService.getRecentHistory",
    "supportService.getTicketByRef",
    "supportService.getLatestTicketForSession",
    "supportService.createTicket",
    "faqService.findStaffAnswer",
    "faqService.recordUse",
]) addAwait(call);

if (text === before) {
    console.log("chatService.js: nothing to change (already patched).");
    process.exit(0);
}

const backup = file + ".bak-before-async";
if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
fs.writeFileSync(file, crlf ? text.replace(/\n/g, "\r\n") : text);
console.log("chatService.js patched:");
for (const n of notes) console.log("  - " + n);
console.log("\nOriginal saved as chatService.js.bak-before-async");
