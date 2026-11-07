/**
 * apply-visitor-prompt.js
 * ========================
 * Run from the backend folder:   node scripts/apply-visitor-prompt.js
 *
 * When someone who is NOT signed in asks for something only signed-in
 * students can see (their class timetable), the bot now tells them to sign in
 * to the portal instead of opening a support ticket. A "Visitors only" answer
 * saved by staff still wins over this built-in message, so staff can reword it.
 *
 * Changes services/chatService.js and routes/chatRoutes.js. Safe to run twice;
 * originals are saved as *.bak-before-visitor.
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function patch(file, edits) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) { console.log(`! ${file} was not found. Run this from the backend folder.`); process.exitCode = 1; return; }
    const raw = fs.readFileSync(full, "utf8");
    const crlf = raw.includes("\r\n");
    let text = raw.replace(/\r\n/g, "\n");
    let changed = false;

    for (const { name, find, replace, marker } of edits) {
        if (text.includes(marker)) continue;
        const match = text.match(find);
        if (!match) { console.log(`! ${file}: could not find the place for "${name}". The file was left unchanged.`); process.exitCode = 1; return; }
        text = text.replace(find, (whole) => replace(whole));
        changed = true;
    }

    if (!changed) { console.log(`${file}: already patched`); return; }
    const backup = full + ".bak-before-visitor";
    if (!fs.existsSync(backup)) fs.copyFileSync(full, backup);
    fs.writeFileSync(full, crlf ? text.replace(/\n/g, "\r\n") : text);
    console.log(`${file}: patched`);
}

patch("services/chatService.js", [{
    name: "visitor sign-in prompt",
    marker: "signInRequired: true",
    find: /const \{ timetable, knowledge, resources, queryType \} = await retrievalService\.retrieveAnswer\([^;]*\);\n/,
    replace: (whole) => whole + `
    // Someone who is not signed in asking for something only signed-in students can
    // see (such as "my class timetable") gets a sign-in prompt, not a support ticket.
    if (audience !== "student" && queryType?.isTimetable && knowledge.length === 0 && resources.length === 0) {
        const signInText = "Class timetables are available to signed-in students. Sign in to the student portal and ask me again, and I can show you yours.";
        const signInReply = typeof toneService !== "undefined"
            ? await toneService.rephrase(question, signInText, { kind: "staff" })
            : signInText;
        await sessionService.appendMessage(sessionId, "assistant", signInReply);
        return {
            answer: signInReply,
            queryType,
            sources: [],
            resources: [],
            recommendedResources: [],
            timetableMatches: 0,
            usedFallback: false,
            signInRequired: true,
            sessionId,
        };
    }
`,
}]);

patch("routes/chatRoutes.js", [{
    name: "signInRequired flag",
    marker: "signInRequired:",
    find: /usedFallback: Boolean\(result\.usedFallback\),\n/,
    replace: (whole) => whole + "            signInRequired: Boolean(result.signInRequired),\n",
}]);
