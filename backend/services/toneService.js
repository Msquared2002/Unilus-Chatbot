/**
 * toneService.js
 * ===============
 * Makes the chatbot sound like a person instead of a form letter, without
 * letting it change any fact.
 *
 *   rephrase(question, text, { kind })   rewrites a finished reply in a
 *       natural voice that matches how the student wrote. Used for staff
 *       answers ("staff") and the "I couldn't find that" reply ("fallback").
 *   greetingFor(question, profile)       a varied greeting, using the first
 *       name when the student is signed in. No AI call.
 *
 * Safety rules:
 *   - The rewrite may only use what is already in the text. Every number,
 *     email, link and capitalised name from the original must still be in the
 *     rewrite, otherwise the original text is sent unchanged.
 *   - If the AI service is slow, down or unconfigured, the original text is
 *     sent unchanged (it never blocks or breaks a reply).
 *   - Set TONE_REWRITE=off in .env to switch the rewriting off.
 */

const TIMEOUT_MS = 4500;
const MODELS = [process.env.GROQ_TONE_MODEL || "openai/gpt-oss-20b", "openai/gpt-oss-120b"];

let client = null;
function getClient() {
    if (client) return client;
    if (!process.env.GROQ_API_KEY) return null;
    try {
        // loaded on first use, so a problem here can never stop the server starting
        const Groq = require("groq-sdk");
        client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    } catch (err) {
        console.log("[tone] AI client unavailable, replies stay as written:", err.message);
        return null;
    }
    return client;
}

function enabled() {
    return false; // Approved and policy answers remain verbatim; semantic rewrites are not a trust boundary.

    return String(process.env.TONE_REWRITE || "on").toLowerCase() !== "off";
}


/* ----------------------------- fact guard ---------------------------- */

// Capitalised words that are just ordinary sentence starters, not facts.
const IGNORE = new Set(("the a an it this that you your i we please if for on at in to yes no hi hello hey thanks thank sorry " +
    "here there what when where who how and or but so as is are can could will would should just also not my our they them he she " +
    "his her its call email ask try check contact visit see use send go open log sign bring remember note say let").split(" "));

// Everyday words that may be reworded freely, even in a short answer.
const COMMON = new Set(("that would be been being of to in on at by with from and or but not yes it its this these those for as if then " +
    "than so do does did has have had will can may might must shall should could about into over under up down out off very just also " +
    "the are was were you your they them their there here what when where who how which").split(" "));

function mustKeep(original) {
    const keep = new Set();
    // A short answer ("madam Rebecca Mumba") is all facts: keep every meaningful word, titles included.
    const words = String(original).toLowerCase().match(/[a-z0-9'’-]+/g) || [];
    if (words.length <= 12) {
        for (const w of words) {
            const base = w.split(/['’]/)[0];
            if (base.length >= 3 && !COMMON.has(base) && !IGNORE.has(base)) keep.add(base);
        }
    }
    for (const m of original.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) || []) keep.add(m.toLowerCase());
    for (const m of original.match(/https?:\/\/[^\s)>\]]+/g) || []) keep.add(m.toLowerCase().replace(/[.,;:!?]+$/, ""));
    for (const m of original.match(/\d[\d,.:/-]*\d|\d/g) || []) keep.add(m.toLowerCase());
    for (const m of original.match(/\b[A-Z][A-Za-z'’-]+\b/g) || []) {
        const base = m.split(/['’]/)[0].toLowerCase();
        if (base && !IGNORE.has(base)) keep.add(base);
    }
    return [...keep];
}

function keepsFacts(original, rewritten) {
    const out = String(rewritten || "").toLowerCase();
    return mustKeep(original).every((token) => out.includes(token));
}


/* ------------------------------- AI call ----------------------------- */

async function complete(system, user) {
    const groq = getClient();
    if (!groq) return null;

    for (const model of MODELS) {
        try {
            const response = await Promise.race([
                groq.chat.completions.create({
                    model,
                    messages: [{ role: "system", content: system }, { role: "user", content: user }],
                    temperature: 0.6,
                    max_tokens: 900,
                    reasoning_effort: "low",
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
            ]);
            const text = response && response.choices && response.choices[0] && response.choices[0].message
                ? String(response.choices[0].message.content || "").trim()
                : "";
            if (text) return text;
        } catch (err) {
            // try the next model, then give up quietly
        }
    }
    return null;
}

const VOICE =
    "You are the UNILUS student assistant: warm, natural and to the point. Reply the way a friendly, capable person " +
    "would in a chat. Mirror how the student wrote: casual with casual, formal with formal, short with short, and " +
    "reply in the language they used. Plain sentences only: no headings, no bullet points, no emojis unless the " +
    "student used them. Do not open every reply with 'Sure' or 'Certainly'. ";

const RULES = {
    staff:
        "The text you are given is an answer approved by UNILUS staff. Use ONLY the information in it. Never add, " +
        "guess or change any name, title, number, date, price, link or instruction. If it is very short, answer in " +
        "one natural sentence.",
    fallback:
        "The text you are given says the assistant could not find an answer, and says who to contact and which ticket " +
        "was opened. Say the same things in a warmer, more human way: briefly acknowledge what they asked, say you " +
        "do not have it in the UNILUS records yet, and say it has been passed on. Keep the ticket reference, phone " +
        "number, email address and the phrase \"status of <ticket>\" exactly as written.",
};

async function rephrase(question, text, { kind = "staff" } = {}) {
    if (!enabled() || !text || String(text).length > 1500) return text;

    const label = kind === "fallback" ? "What happened" : "Approved answer";
    const out = await complete(
        VOICE + (RULES[kind] || RULES.staff),
        `Student's message: "${String(question || "").slice(0, 400)}"\n\n${label}:\n${text}\n\nWrite the reply to the student.`
    );

    if (!out || out.length > String(text).length * 3 + 240 || !keepsFacts(text, out)) return text;
    return out;
}


/* ------------------------------ greetings ---------------------------- */

function greetingFor(question, profile) {
    const q = String(question || "").toLowerCase();
    const first = profile && profile.name ? String(profile.name).trim().split(/\s+/)[0] : "";
    const who = first ? ` ${first}` : "";

    if (/good morning/.test(q)) return `Good morning${who}! What can I help you with?`;
    if (/good afternoon/.test(q)) return `Good afternoon${who}! What can I help you with?`;
    if (/good evening/.test(q)) return `Good evening${who}! What can I help you with?`;
    if (/^\W*(hey|yo|sup|hiya)\b/.test(q)) return `Hey${who}! What's up? Ask me anything about UNILUS.`;
    if (/^\W*hello\b/.test(q)) return `Hello${who}! How can I help you today?`;
    return `Hi${who}! How can I help you today?`;
}


module.exports = { rephrase, greetingFor, keepsFacts, mustKeep };
