const Groq = require("groq-sdk");

// Lazily instantiated so non-LLM code paths/tests do not require a key.
let groq = null;
function getClient() {
    if (!groq) groq = new Groq();
    return groq;
}

const MODELS = [
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b"
];

function normalizeUrl(value = "") {
    let raw = String(value).trim().replace(/[),.;]+$/g, "");
    if (!raw) return "";
    if (/^www\./i.test(raw)) raw = `https://${raw}`;
    try {
        const url = new URL(raw);
        const pathname = url.pathname.replace(/\/+$/g, "") || "/";
        return `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}${pathname}${url.search}`;
    } catch {
        return "";
    }
}

function extractUrls(text = "") {
    const matches = String(text).match(/(?:https?:\/\/|www\.)[^\s<>\])}]+/gi) || [];
    return matches.map(normalizeUrl).filter(Boolean);
}

/**
 * Removes links the model could not have obtained from supplied evidence.
 * Link labels are preserved so a good prose answer is not destroyed merely
 * because the model guessed a URL destination.
 */
function sanitizeAnswerLinks(answer = "", allowedUrls = []) {
    const allowed = new Set([
        ...allowedUrls.map(normalizeUrl).filter(Boolean),
        ...extractUrls(allowedUrls.join(" ")),
    ]);

    let output = String(answer);

    // Markdown links: preserve the label, but only preserve the clickable URL
    // if that exact destination was supplied in the UNILUS evidence.
    output = output.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, (full, label, url) => {
        return allowed.has(normalizeUrl(url)) ? full : label;
    });

    // Also guard plain protocol URLs. Exact supplied URLs remain untouched;
    // unsupported ones are removed rather than allowed to masquerade as an
    // official UNILUS destination.
    output = output.replace(/https?:\/\/[^\s<>\])}]+/gi, (url) => {
        return allowed.has(normalizeUrl(url)) ? url : "";
    });

    // Clean whitespace left by a removed unsupported URL.
    output = output.replace(/[ \t]+\n/g, "\n").replace(/ {2,}/g, " ");
    return output.trim();
}

function buildQuestionFocusHints(question = "") {
    const q = String(question).toLowerCase();
    const hints = [];

    if (!/\b(pay|payment|bank|account|deposit|where\s+to\s+pay|how\s+to\s+pay)\b/i.test(q)) {
        hints.push("Do not include bank or payment-method details unless they are necessary to answer the exact question.");
    }

    if (!/\b(withdraw|withdrawal|readmission|re-admission|re admission)\b/i.test(q)) {
        hints.push("Do not add withdrawal or re-admission sections as adjacent information unless the question explicitly asks about them.");
    }

    if (/\b(papers?|documents?)\b/i.test(q) && /\b(apply|applying|application)\b/i.test(q)) {
        hints.push("For an application-documents question, focus on required documents and required verification; do not add unrelated fee/payment material.");
    }

    return hints;
}

function normalizeNumericToken(value = "") {
    let token = String(value).trim().toUpperCase();
    token = token.replace(/^(?:ZMW|K|USD|US\$|\$)\s*/i, "");
    token = token.replace(/,/g, "").replace(/\s+/g, "");
    if (!token) return "";

    const isPercent = token.endsWith("%");
    const core = isPercent ? token.slice(0, -1) : token;

    // Keep long digit strings (account numbers, IDs) verbatim so leading
    // zeroes are not destroyed by numeric conversion.
    if (/^\d{10,}$/.test(core)) return `${core}${isPercent ? "%" : ""}`;

    if (/^\d+(?:\.\d+)?$/.test(core)) {
        const [whole, decimal] = core.split(".");
        const normalizedDecimal = decimal ? decimal.replace(/0+$/g, "") : "";
        return `${String(Number(whole))}${normalizedDecimal ? `.${normalizedDecimal}` : ""}${isPercent ? "%" : ""}`;
    }

    return `${core}${isPercent ? "%" : ""}`;
}

/**
 * Extract high-risk numeric tokens from prose. Single-digit values are ignored
 * because they are often harmless list/occupancy formatting; fees, years,
 * percentages, dates, account numbers, etc. are retained.
 */
function extractNumericTokens(text = "") {
    let input = String(text)
        .replace(/https?:\/\/[^\s<>\])}]+/gi, " ")
        .replace(/www\.[^\s<>\])}]+/gi, " ")
        .replace(/^\s*\d+[.)]\s+/gm, " ");

    const matches = input.match(/(?:\b(?:ZMW|USD|K)\s*|\$\s*)?\d[\d,]*(?:\.\d+)?%?/gi) || [];
    return [...new Set(matches
        .map(normalizeNumericToken)
        .filter((token) => {
            if (!token) return false;
            const digits = token.replace(/\D/g, "");
            return token.includes("%") || token.includes(".") || digits.length >= 2;
        }))];
}

function findUnsupportedNumericTokens(answer = "", groundingText = "") {
    const allowed = new Set(extractNumericTokens(groundingText));
    return extractNumericTokens(answer).filter((token) => !allowed.has(token));
}

function removeLinesWithUnsupportedNumerics(answer = "", unsupportedTokens = []) {
    const unsupported = new Set(unsupportedTokens);
    if (!unsupported.size) return String(answer).trim();

    const kept = String(answer).split(/\r?\n/).filter((line) => {
        const lineTokens = extractNumericTokens(line);
        return !lineTokens.some((token) => unsupported.has(token));
    });

    let output = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    const note = "One numeric detail was omitted because it was not consistently supported by the supplied UNILUS records.";
    output = output ? `${output}\n\n${note}` : note;
    return output;
}

function buildSystemPrompt() {
    return `
You are the UNILUS Student Digital Companion.

Your role is to answer student and prospective-student questions using ONLY the supplied UNILUS Information.

========================
GROUNDING RULES
========================

1. The supplied UNILUS Information is the only source of truth.
2. Never add, assume, infer, repair, or invent facts that are not supported by the supplied information.
3. Do not use general university knowledge or facts remembered from outside the supplied information.
4. Preserve exact factual tokens from the evidence whenever they matter: amounts, dates, course codes, bank names, account names, account numbers, URLs, office names, and institutional names. Do not "correct" or creatively paraphrase an unfamiliar proper noun.
5. If a key detail needed for one exact answer is missing (for example the student's study year, semester, programme, or local/foreign status), do not guess it. State what the records show and ask one concise follow-up when necessary.
6. If supplied sources conflict, do not silently merge them. Briefly identify the conflict. Prefer a source as newer/revised only when the supplied information itself clearly identifies it as newer/revised.
7. When the context marks evidence as PRIMARY, PRIMARY evidence controls overlapping factual values. SUPPORTING evidence may add procedures or official links, but it must never override a conflicting amount/date/rule from PRIMARY evidence.
8. Copy numeric values exactly from the controlling evidence. Never mentally recalculate, round, "fix", or substitute a different figure.
9. A source filename/title helps identify evidence, but do not manufacture facts solely from a suggestive filename when the supplied content does not support them.
10. If the information is genuinely unavailable after using the supplied evidence, respond: "I don't have that information in the UNILUS records."
11. Earlier turns in this conversation may be supplied as prior messages. Use them only to understand what the student is referring to (e.g. "what about Wednesday?" after a timetable question). Never treat something said earlier in the conversation as UNILUS evidence -- only the UNILUS Information supplied in the current turn is a source of fact.

========================
ANSWER DISCIPLINE
========================

1. Answer the exact question first. Do not dump every related fact merely because it appears in retrieved evidence.
2. Include adjacent procedures, penalties, withdrawal rules, payment details, or background only when they directly help answer the student's request.
3. Do not add a separate withdrawal, re-admission, payment/bank-details, or "additional information" section unless the student's question actually requires it.
4. If the student explicitly rules out an option (for example "I don't want to withdraw"), do not explain that ruled-out option unless a one-sentence distinction is essential.
5. Prefer a short direct answer plus the minimum useful supporting detail. Expand only when the question asks for detail or the decision genuinely depends on several cases.
6. When rules differ by category (for example undergraduate vs postgraduate, 4-course vs 5-course semester, local vs foreign), keep those cases separate. Do not blend them into one rule.
7. Do not turn a conditional rule into a universal statement. Use wording such as "if", "for students with...", or "the records state..." when appropriate.
8. Do not claim "latest", "current", "most up-to-date", or similar unless the supplied information explicitly supports that comparison.
9. If the student asks "how much" but the supplied schedule varies by study year/semester, explain that it varies and give the available schedule or ask which year/semester they mean rather than pretending there is one amount.

========================
TIMETABLE RULES
========================

1. Timetable information is the source of truth for class/venue/lecturer questions.
2. Never modify timetable details.
3. Apply requested filters such as year, lecturer, course, day, and venue when provided.
4. Display only useful available details: course code/name, day, time, venue, lecturer, and programme where relevant.

========================
RESOURCE & LINK RULES
========================

1. Only output a clickable URL that appears verbatim in the supplied UNILUS Information.
2. Never guess, shorten, expand, or substitute a URL.
3. A hyperlink label must accurately describe that exact destination. Do not label a general UNILUS homepage as "Student Portal", "Apply Now", or another specific service unless the supplied evidence identifies it that way.
4. If an exact official resource/page URL is supplied for the student's task, prefer it over a generic university homepage.
5. If the supplied UNILUS Information contains an "Official resources" section, weave the relevant link naturally into the answer.
6. Do not add an unrelated resource merely because it is available.

========================
RESPONSE STYLE
========================

- Start with the direct answer, not a long preamble.
- Use headings only when they improve readability.
- Use numbered lists for procedures and bullets for requirements.
- Use tables only when several comparable values genuinely benefit from a table.
- Keep paragraphs short.
- Avoid repeating the student's question.
- Avoid unnecessary "Additional Information" sections.
- Prefer concise Markdown.

========================
RESTRICTIONS
========================

Never mention retrieval, vectors, embeddings, databases, context windows, ranking, or internal systems.
`;
}

async function createCompletion(model, messages, temperature = 0.1) {
    return getClient().chat.completions.create({
        model,
        max_tokens: 2500,
        temperature,
        messages,
    });
}

async function askAI(question, context = "", { allowedUrls = [], groundingText = "", history = [] } = {}) {
    let lastError;

    // URLs present in formatted evidence are automatically allowed in addition
    // to the explicit structured list supplied by chatService.
    const effectiveAllowedUrls = [...new Set([
        ...allowedUrls,
        ...extractUrls(context),
    ])];

    const focusHints = buildQuestionFocusHints(question);

    // Prior turns in this conversation, oldest first, so the model can
    // resolve follow-ups like "what about Wednesday?" -- see grounding
    // rule 11: history gives context, never new facts.
    const historyMessages = history.map((turn) => ({
        role: turn.role === "assistant" ? "assistant" : "user",
        content: turn.content,
    }));

    const baseMessages = [
        {
            role: "system",
            content: buildSystemPrompt(),
        },
        ...historyMessages,
        {
            role: "user",
            content: `
UNILUS Information:

${context}

Question-specific focus rules:
${focusHints.length ? focusHints.map((hint) => `- ${hint}`).join("\n") : "- Use the general answer-discipline rules."}

Student Question:

${question}
`,
        },
    ];

    const controllingGroundingText = groundingText || context;

    for (const model of MODELS) {
        try {
            console.log("Trying model:", model);

            const response = await createCompletion(model, baseMessages, 0.1);
            let rawAnswer = response.choices[0].message.content;
            let unsupported = findUnsupportedNumericTokens(rawAnswer, controllingGroundingText);

            // One deterministic verification retry: the model is told exactly
            // which numeric tokens were unsupported by controlling evidence.
            if (unsupported.length) {
                console.log("Grounding retry for unsupported numeric tokens:", unsupported.join(", "));
                const retryMessages = [
                    ...baseMessages,
                    { role: "assistant", content: rawAnswer },
                    {
                        role: "user",
                        content: `Revise the draft. These numeric token(s) are not supported by the controlling UNILUS evidence: ${unsupported.join(", ")}. Copy every amount/date/account number/percentage exactly from the controlling evidence. If sources conflict, use PRIMARY evidence and do not substitute a SUPPORTING value. Keep the answer concise and do not add unrelated sections.`,
                    },
                ];
                const retry = await createCompletion(model, retryMessages, 0);
                rawAnswer = retry.choices[0].message.content;
                unsupported = findUnsupportedNumericTokens(rawAnswer, controllingGroundingText);

                // If a model still refuses to stay grounded after correction,
                // fail safely by removing the affected line(s) rather than
                // showing a confident unsupported number to the student.
                if (unsupported.length) {
                    rawAnswer = removeLinesWithUnsupportedNumerics(rawAnswer, unsupported);
                }
            }

            console.log("Successful model:", model);
            return sanitizeAnswerLinks(rawAnswer, effectiveAllowedUrls);
        } catch (error) {
            lastError = error;
            if (error.status === 429) {
                console.log("Rate limit reached:", model);
                continue;
            }
            console.log("Model failed:", model, error.message);
        }
    }

    throw lastError;
}

module.exports = {
    askAI,
    buildSystemPrompt,
    sanitizeAnswerLinks,
    extractUrls,
    normalizeUrl,
    buildQuestionFocusHints,
    extractNumericTokens,
    findUnsupportedNumericTokens,
    removeLinesWithUnsupportedNumerics,
    normalizeNumericToken,
};
