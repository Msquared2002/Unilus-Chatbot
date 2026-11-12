/*
Changes: Reads a file a person attaches in the chat (PDF, Word or text), keeps its text in memory for this chat session only,
         and extracts plain facts (course codes, dates, amounts, emails) with regular expressions.
Affects: routes/chatRoutes.js (upload endpoints) and services/chatService.js (answers about an attached file).
Purpose: Lets the chatbot answer questions about the student's own file next to the UNILUS records, WITHOUT adding that
         file to the knowledge base. Nothing here calls an AI model: what is "found" in a file is found by patterns, so it
         is never a guess. Files live in memory only, expire after UPLOAD_TTL_MINUTES (default 60), and are lost on restart.
*/

const crypto = require("crypto");
const path = require("path");

const { readPdf } = require("./documentIngestion/readers/pdfReader");
const { readDocx } = require("./documentIngestion/readers/docxReader");
const { readText } = require("./documentIngestion/readers/textReader");

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"];
const MAX_BYTES = Math.round((Number(process.env.UPLOAD_MAX_MB) || 6) * 1024 * 1024);
const TTL_MS = (Number(process.env.UPLOAD_TTL_MINUTES) || 60) * 60 * 1000;
const MAX_STORED_CHARS = 60000;   // text kept per file
const MAX_PROMPT_CHARS = 9000;    // text sent to the model per question
const MIN_TEXT_CHARS = 30;        // below this a PDF is almost certainly a scan

class UploadError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// documentId -> record. One active file per chat session (a new upload replaces the old one).
const documents = new Map();
const documentBySession = new Map();


// ---------- reading ----------

function blocksToText(blocks = [], { pageMarkers = true } = {}) {
    const parts = [];
    let page = null;
    for (const block of blocks) {
        if (block.type === "page_break") continue;
        const text = String(block.text || "").trim();
        if (!text) continue;
        if (pageMarkers && block.page && block.page !== page) {
            page = block.page;
            parts.push(`[Page ${page}]`);
        }
        if (block.type === "heading") parts.push(`## ${text}`);
        else parts.push(text);
    }
    return parts.join("\n");
}

async function extractText(buffer, filename, ext) {
    if (ext === ".pdf") {
        const result = await readPdf(buffer, { filename });
        return { text: blocksToText(result.blocks), pages: result.pageCount || 1, firstHeading: result.firstHeading || null };
    }
    if (ext === ".docx") {
        const result = await readDocx(buffer, { filename });
        const blocks = Array.isArray(result) ? result : (result.blocks || []);
        const heading = blocks.find((b) => b.type === "heading");
        return { text: blocksToText(blocks, { pageMarkers: false }), pages: null, firstHeading: heading ? heading.text : null };
    }
    const result = readText(buffer.toString("utf8"), { filename });
    const blocks = Array.isArray(result) ? result : (result.blocks || []);
    const heading = blocks.find((b) => b.type === "heading");
    return { text: blocksToText(blocks, { pageMarkers: false }), pages: null, firstHeading: heading ? heading.text : null };
}


// ---------- plain-pattern facts ----------

const COURSE_CODE_RE = /\b[A-Z]{2,6}\d{3}\b/g;
const AMOUNT_RE = /\b(?:ZMW|USD|K)\s?\d[\d,]*(?:\.\d+)?|\$\s?\d[\d,]*(?:\.\d+)?/g;
const MONTHS = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const DATE_RES = [
    new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTHS}\\.?,?\\s+\\d{4}\\b`, "gi"),
    new RegExp(`\\b${MONTHS}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, "gi"),
    /\b\d{1,2}[/.-]\d{1,2}[/.-](?:\d{4}|\d{2})\b/g,
];
const EMAIL_RE = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;

function unique(list, limit) {
    return [...new Set(list.map((item) => item.trim()))].slice(0, limit);
}

function extractFacts(text = "") {
    const courseCodes = unique(text.match(COURSE_CODE_RE) || [], 30);
    const dates = unique(DATE_RES.flatMap((re) => text.match(re) || []), 30);
    const amounts = unique(text.match(AMOUNT_RE) || [], 30);
    const emails = unique(text.match(EMAIL_RE) || [], 10);
    return { courseCodes, dates, amounts, emails };
}


// ---------- storage ----------

function sweep() {
    const now = Date.now();
    for (const [id, doc] of documents) {
        if (doc.expiresAt <= now) removeDocument(id);
    }
}
setInterval(sweep, 5 * 60 * 1000).unref();

function removeDocument(id) {
    const doc = documents.get(id);
    if (!doc) return false;
    documents.delete(id);
    if (documentBySession.get(doc.sessionId) === id) documentBySession.delete(doc.sessionId);
    return true;
}

function sanitizeFilename(value) {
    const base = path.basename(String(value || "document").replace(/\\/g, "/"));
    const clean = base.replace(/[^\w.\- ()]/g, "_").slice(0, 120);
    return clean || "document";
}

async function saveDocument({ sessionId, filename, buffer }) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new UploadError(400, "No file received.");
    }
    if (buffer.length > MAX_BYTES) {
        throw new UploadError(413, `That file is too large. The limit is ${Math.round(MAX_BYTES / 1024 / 1024)} MB.`);
    }

    const name = sanitizeFilename(filename);
    const ext = path.extname(name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        throw new UploadError(415, "I can read PDF, Word (.docx) and text (.txt) files.");
    }

    let extracted;
    try {
        extracted = await extractText(buffer, name, ext);
    } catch (error) {
        console.log("[upload] could not read file:", error.message);
        throw new UploadError(422, "I couldn't open that file. It may be damaged or password protected.");
    }

    const fullText = String(extracted.text || "").replace(/\u0000/g, "").trim();
    if (fullText.replace(/\[Page \d+\]|\s/g, "").length < MIN_TEXT_CHARS) {
        throw new UploadError(422, "I couldn't find any text in that file. If it's a scan or a photo, I can only read files that contain real text.");
    }

    const truncated = fullText.length > MAX_STORED_CHARS;
    const text = truncated ? fullText.slice(0, MAX_STORED_CHARS) : fullText;
    const firstLine = text.split("\n").map((l) => l.replace(/^##\s*/, "").trim()).find((l) => l && !/^\[Page \d+\]$/.test(l));
    const title = (extracted.firstHeading || (firstLine && firstLine.length <= 100 ? firstLine : null) || name).slice(0, 100);

    // A new upload in the same chat replaces the old one.
    const previous = documentBySession.get(sessionId);
    if (previous) removeDocument(previous);

    const id = crypto.randomUUID();
    const record = {
        id,
        sessionId,
        filename: name,
        ext,
        bytes: buffer.length,
        pages: extracted.pages,
        chars: fullText.length,
        truncated,
        title,
        text,
        facts: extractFacts(text),
        createdAt: Date.now(),
        expiresAt: Date.now() + TTL_MS,
    };
    documents.set(id, record);
    documentBySession.set(sessionId, id);
    return record;
}

/** Returns the file only if it belongs to this chat session and has not expired. */
function getDocument(id, sessionId) {
    if (!id) return null;
    const doc = documents.get(String(id));
    if (!doc || doc.sessionId !== sessionId) return null;
    if (doc.expiresAt <= Date.now()) {
        removeDocument(doc.id);
        return null;
    }
    return doc;
}


// ---------- what the model is shown ----------

const STOP_WORDS = new Set("a an and are as at be by can do does for from how i in is it me my of on or our that the this to was what when where which who will with you your about please tell give show summarise summarize explain document file pdf attached uploaded".split(" "));

function termsOf(text = "") {
    return [...new Set(String(text).toLowerCase().match(/[a-z0-9]{3,}/g) || [])].filter((t) => !STOP_WORDS.has(t));
}

/**
 * The part of the file shown to the model for this question. A short file is sent whole. A long one is sent as its
 * opening plus the passages that share the most words with the question, in their original order.
 */
function excerptFor(doc, question = "") {
    if (!doc) return { text: "", partial: false };
    if (doc.text.length <= MAX_PROMPT_CHARS) return { text: doc.text, partial: doc.truncated };

    const paragraphs = doc.text.split(/\n+/).filter(Boolean);
    const opening = [];
    let used = 0;
    for (const p of paragraphs) {
        if (used + p.length > 1800) break;
        opening.push(p);
        used += p.length + 1;
    }

    const terms = termsOf(question);
    const scored = paragraphs.slice(opening.length).map((p, index) => {
        const lower = p.toLowerCase();
        const score = terms.reduce((sum, t) => sum + (lower.includes(t) ? 1 : 0), 0);
        return { p, index, score };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);

    const picked = [];
    for (const item of scored) {
        if (used + item.p.length > MAX_PROMPT_CHARS) continue;
        picked.push(item);
        used += item.p.length + 1;
    }
    picked.sort((a, b) => a.index - b.index);

    const text = [...opening, ...(picked.length ? ["[...]"] : []), ...picked.map((item) => item.p)].join("\n");
    return { text, partial: true };
}

/** A short topic phrase added to the UNILUS record search so "summarise this" still finds the right records. */
function retrievalHint(doc) {
    if (!doc) return "";
    return String(doc.title || "").replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[_-]+/g, " ").slice(0, 100);
}

function publicSummary(doc) {
    return {
        documentId: doc.id,
        filename: doc.filename,
        title: doc.title,
        pages: doc.pages,
        chars: doc.chars,
        truncated: doc.truncated,
        expiresInMinutes: Math.round(TTL_MS / 60000),
    };
}

module.exports = {
    UploadError,
    ALLOWED_EXTENSIONS,
    MAX_BYTES,
    saveDocument,
    getDocument,
    removeDocument,
    excerptFor,
    retrievalHint,
    publicSummary,
    extractFacts,
    // exposed for tests
    blocksToText,
    sanitizeFilename,
};
