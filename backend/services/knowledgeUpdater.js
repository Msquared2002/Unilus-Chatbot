/**
 * knowledgeUpdater.js
 * ====================
 * Keeps the chatbot's knowledge base up to date without editing code,
 * running scripts by hand, or restarting the server.
 *
 *   uploadDocument()   staff adds a document (PDF, Word, text or HTML): it is
 *                      read, split into chunks, embedded and added to the live
 *                      index straight away. Uploading a file with the same
 *                      name replaces the old version.
 *   deleteDocument()   removes an uploaded document and its chunks.
 *   refreshWebsite()   re-crawls the configured UNILUS web pages and updates
 *                      only what changed (new, edited and removed content).
 *   startScheduler()   runs refreshWebsite() on a timer (KNOWLEDGE_REFRESH_HOURS).
 *   getKnowledgeStatus()  what is indexed, plus a log of recent changes.
 *
 * It reuses the existing pipeline pieces (ingestFile, crawlAndBuildChunks, the
 * embedding model and the JsonVectorStore) and writes through the SAME store
 * instance the chat uses, so changes are searchable immediately.
 *
 * Safety rules built in:
 *   - Uploads are "restricted" (signed-in users only) unless staff explicitly
 *     mark them public.
 *   - A new document is fully processed BEFORE the old version is removed, and
 *     the old file is restored if anything fails.
 *   - Identical or duplicate files are refused.
 *   - A website refresh is abandoned if the crawl returns far fewer chunks than
 *     the index already holds (for example when the site is down), and pages
 *     that failed to download keep their existing content.
 *
 * Full rebuilds still work: `npm run knowledge:rebuild` re-reads everything in
 * data/documents (including data/documents/uploads) and the website.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const embeddingService = require("./embeddingService");
const { runtimeMetadata, buildSearchText } = require("./searchTextService");
const knowledgeService = require("./knowledgeService");

const DOCUMENTS_DIR = path.join(__dirname, "../data/documents");
const UPLOADS_DIR = path.join(DOCUMENTS_DIR, "uploads");
const MANIFEST_PATH = path.join(__dirname, "../data/vectors/index_manifest.json");
const UPDATES_LOG_PATH = path.join(__dirname, "../data/knowledge_updates.json");

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".html", ".htm"];
const MAX_LOG_EVENTS = 100;
// A refresh that would shrink the website content below this share is refused.
const MIN_WEBSITE_KEEP_RATIO = 0.5;


class KnowledgeError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}


/* ------------------------- one change at a time ------------------------- */

// Uploads, deletes and refreshes all change the same index file, so they run
// one after another.
let queue = Promise.resolve();

function enqueue(task) {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
}


/* ------------------------------- helpers -------------------------------- */

function sanitizeFilename(raw) {
    let name = path.basename(String(raw || "").replace(/\\/g, "/")).trim();
    name = name
        .replace(/[^A-Za-z0-9._() \-]/g, "_")
        .replace(/\s+/g, " ")
        .replace(/^\.+/, "");

    if (name.length > 150) {
        const ext = path.extname(name);
        name = name.slice(0, 150 - ext.length) + ext;
    }

    const ext = path.extname(name).toLowerCase();
    if (!name || !ALLOWED_EXTENSIONS.includes(ext)) {
        throw new KnowledgeError(
            400,
            `Unsupported file name. Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}.`
        );
    }
    return name;
}

function sha256(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

function listDocumentFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...listDocumentFiles(fullPath));
        } else if (ALLOWED_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
            files.push(fullPath);
        }
    }
    return files;
}

function sidecarPathFor(filePath) {
    return `${filePath}.meta.json`;
}

function readJson(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
        return fallback;
    }
}

function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
}

function isInside(parent, child) {
    const relative = path.relative(parent, child);
    return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}


/* ------------------------------ change log ------------------------------ */

function readUpdatesLog() {
    return readJson(UPDATES_LOG_PATH, { website: null, events: [] });
}

function recordEvent(event, { website = null } = {}) {
    try {
        const log = readUpdatesLog();
        log.events = [{ at: new Date().toISOString(), ...event }, ...(log.events || [])].slice(0, MAX_LOG_EVENTS);
        if (website) log.website = { at: new Date().toISOString(), ...website };
        fs.mkdirSync(path.dirname(UPDATES_LOG_PATH), { recursive: true });
        fs.writeFileSync(UPDATES_LOG_PATH, JSON.stringify(log, null, 2));
    } catch (err) {
        console.log("[knowledge] could not write the update log:", err.message);
    }
}

async function updateManifest() {
    try {
        const manifest = readJson(MANIFEST_PATH, {});
        const count = await knowledgeService.getStore().count();
        manifest.chunk_count = count;
        manifest.vector_count = count;
        manifest.last_incremental_update = new Date().toISOString();
        fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    } catch (err) {
        console.log("[knowledge] could not update the index manifest:", err.message);
    }
}


/* -------------------- restricted (signed-in only) files ------------------ */

// retrievalRouter keeps a Set of source files hidden from public users. Files
// whose sidecar says  "access": "restricted"  are added to that same Set, so
// the existing access rule applies to them with no change to the router.
const dynamicRestricted = new Set();

function restrictedSet() {
    return require("./retrievalRouter").AUDIENCE_RESTRICTED_KNOWLEDGE_SOURCES;
}

function syncRestrictedSources() {
    const desired = new Set();

    for (const filePath of listSidecars(DOCUMENTS_DIR)) {
        const meta = readJson(filePath, {});
        if (meta && meta.access === "restricted") {
            desired.add(path.basename(filePath).replace(/\.meta\.json$/i, ""));
        }
    }

    const set = restrictedSet();
    for (const name of desired) {
        if (!set.has(name)) {
            set.add(name);
            dynamicRestricted.add(name);
        }
    }
    for (const name of [...dynamicRestricted]) {
        if (!desired.has(name)) {
            set.delete(name);
            dynamicRestricted.delete(name);
        }
    }
    return desired.size;
}

function listSidecars(dir) {
    if (!fs.existsSync(dir)) return [];
    const found = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) found.push(...listSidecars(fullPath));
        else if (/\.meta\.json$/i.test(entry.name)) found.push(fullPath);
    }
    return found;
}


/* ----------------------------- embedding step --------------------------- */

// Same steps as scripts/buildKnowledgeIndex.js, for just the chunks given.
async function toRecord(chunk) {
    const metadata = runtimeMetadata(chunk.metadata || {}, chunk.text || "");
    const searchText = buildSearchText(chunk.text, metadata);
    const embedding = await embeddingService.createEmbedding(searchText);
    return {
        id: chunk.id,
        text: chunk.text,
        search_text: searchText,
        embedding,
        metadata,
    };
}


/* -------------------------------- upload -------------------------------- */

function findConflict(name, buffer, hash) {
    for (const existing of listDocumentFiles(DOCUMENTS_DIR)) {
        const existingName = path.basename(existing);
        const inUploads = isInside(UPLOADS_DIR, existing);

        if (existingName === name) {
            if (!inUploads) {
                throw new KnowledgeError(
                    409,
                    `A different document called "${name}" already exists in the knowledge base. Rename your file and upload it again.`
                );
            }
            if (fs.statSync(existing).size === buffer.length && sha256(fs.readFileSync(existing)) === hash) {
                throw new KnowledgeError(409, `This exact file is already in the knowledge base as "${name}".`);
            }
            continue; // same name, different content: a revised version
        }

        if (fs.statSync(existing).size === buffer.length && sha256(fs.readFileSync(existing)) === hash) {
            throw new KnowledgeError(409, `This file has the same content as the existing document "${existingName}".`);
        }
    }
}

/**
 * @param {object} options
 * @param {string} options.filename   original file name (sanitised here)
 * @param {Buffer} options.buffer     file contents
 * @param {string} [options.access]   "public" or "restricted" (default restricted)
 * @param {string} [options.title]    optional display title for citations
 * @param {string} [options.uploadedBy]
 */
function uploadDocument({ filename, buffer, access, title, uploadedBy = "unknown" }) {
    return enqueue(async () => {
        if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
            throw new KnowledgeError(400, "No file received. Send the file contents as the request body.");
        }

        const name = sanitizeFilename(filename);
        const safeAccess = access === "public" ? "public" : "restricted";
        const hash = sha256(buffer);

        findConflict(name, buffer, hash);

        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        const target = path.join(UPLOADS_DIR, name);
        const sidecar = sidecarPathFor(target);

        const previous = fs.existsSync(target)
            ? {
                file: fs.readFileSync(target),
                sidecar: fs.existsSync(sidecar) ? fs.readFileSync(sidecar) : null,
            }
            : null;

        const meta = {
            source_type: "staff_upload",
            access: safeAccess,
            uploaded_at: new Date().toISOString(),
            uploaded_by: uploadedBy,
            content_sha256: hash,
        };
        if (typeof title === "string" && title.trim()) meta.title = title.trim().slice(0, 200);

        fs.writeFileSync(target, buffer);
        fs.writeFileSync(sidecar, JSON.stringify(meta, null, 2));

        let records;
        try {
            const { ingestFile } = require("../scripts/ingestDocuments");
            const chunks = await ingestFile(target);
            if (!chunks.length) {
                throw new KnowledgeError(422, "No readable text was found in this file (a scanned or image-only PDF needs text extraction first).");
            }
            records = [];
            for (const chunk of chunks) {
                chunk.metadata = { ...(chunk.metadata || {}), source_file: (chunk.metadata && chunk.metadata.source_file) || name };
                records.push(await toRecord(chunk));
            }
        } catch (err) {
            // Put things back exactly as they were.
            if (previous) {
                fs.writeFileSync(target, previous.file);
                if (previous.sidecar) fs.writeFileSync(sidecar, previous.sidecar);
                else if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
            } else {
                if (fs.existsSync(target)) fs.unlinkSync(target);
                if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
            }
            if (err instanceof KnowledgeError) throw err;
            throw new KnowledgeError(422, `Could not process this file: ${err.message}`);
        }

        const store = knowledgeService.getStore();
        const replaced = await store.removeWhere((r) => (r.metadata || {}).source_file === name);
        await store.upsert(records);

        syncRestrictedSources();
        await updateManifest();
        recordEvent({ type: "upload", file: name, access: safeAccess, chunks: records.length, replaced_chunks: replaced, by: uploadedBy });

        return {
            file: name,
            access: safeAccess,
            chunks: records.length,
            replaced: replaced > 0,
            replaced_chunks: replaced,
        };
    });
}

function deleteDocument({ filename, deletedBy = "unknown" }) {
    return enqueue(async () => {
        const name = sanitizeFilename(filename);
        const target = path.join(UPLOADS_DIR, name);

        if (!fs.existsSync(target)) {
            throw new KnowledgeError(404, `"${name}" is not an uploaded document. Only documents added through the upload endpoint can be deleted here.`);
        }

        fs.unlinkSync(target);
        const sidecar = sidecarPathFor(target);
        if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);

        const removed = await knowledgeService.getStore().removeWhere((r) => (r.metadata || {}).source_file === name);

        syncRestrictedSources();
        await updateManifest();
        recordEvent({ type: "delete", file: name, removed_chunks: removed, by: deletedBy });

        return { file: name, removed_chunks: removed };
    });
}


/* ---------------------------- website refresh --------------------------- */

function refreshWebsite({ trigger = "manual" } = {}) {
    return enqueue(async () => {
        const { crawlAndBuildChunks } = require("../scripts/ingestWebsite");
        const { WEBSITE_SOURCES } = require("./documentIngestion/website/sourcesConfig");
        const store = knowledgeService.getStore();

        const { chunks: fresh, failedUrls } = await crawlAndBuildChunks(WEBSITE_SOURCES);

        const existing = await store.list({ filter: (m) => m.document_type === "website" });
        const urlOf = (record) => (record.metadata || {}).source_file || (record.metadata || {}).url;
        const failed = new Set(failedUrls || []);

        const abort = (reason) => {
            const result = { aborted: true, reason, trigger, added: 0, updated: 0, removed: 0, unchanged: 0, failed_urls: [...failed] };
            recordEvent({ type: "website_refresh", ...result }, { website: result });
            return result;
        };

        if (fresh.length === 0) {
            return abort("The crawl returned no content, so the existing website knowledge was left unchanged.");
        }
        if (existing.length > 0 && fresh.length < existing.length * MIN_WEBSITE_KEEP_RATIO) {
            return abort(`The crawl returned ${fresh.length} chunks against ${existing.length} already indexed. This looks like a partial failure, so nothing was changed.`);
        }

        const existingById = new Map(existing.map((r) => [r.id, r]));
        const freshById = new Map(fresh.map((c) => [c.id, c]));

        const toEmbed = [];
        let unchanged = 0;
        let updated = 0;
        let added = 0;

        for (const chunk of fresh) {
            const old = existingById.get(chunk.id);
            if (!old) {
                toEmbed.push(chunk);
                added++;
            } else if (normalizeText(old.text) !== normalizeText(chunk.text)) {
                toEmbed.push(chunk);
                updated++;
            } else {
                unchanged++;
            }
        }

        // Content that disappeared from a page that downloaded fine. Pages that
        // failed to download keep their existing content.
        const staleIds = existing
            .filter((r) => !freshById.has(r.id) && !failed.has(urlOf(r)))
            .map((r) => r.id);
        const staleSet = new Set(staleIds);

        const records = [];
        for (const chunk of toEmbed) records.push(await toRecord(chunk));

        if (records.length) await store.upsert(records);
        const removed = staleSet.size ? await store.removeWhere((r) => staleSet.has(r.id)) : 0;

        if (records.length || removed) await updateManifest();

        const result = { aborted: false, trigger, added, updated, removed, unchanged, failed_urls: [...failed] };
        recordEvent({ type: "website_refresh", ...result }, { website: result });
        return result;
    });
}

function startScheduler() {
    const hours = Number(process.env.KNOWLEDGE_REFRESH_HOURS);
    if (!(hours > 0)) {
        console.log("[knowledge] scheduled website refresh is off (set KNOWLEDGE_REFRESH_HOURS to turn it on)");
        return null;
    }

    const everyMs = Math.max(hours, 0.01) * 3600 * 1000;
    const timer = setInterval(() => {
        refreshWebsite({ trigger: "schedule" })
            .then((r) => console.log(`[knowledge] scheduled refresh: +${r.added} ~${r.updated} -${r.removed}${r.aborted ? ` (aborted: ${r.reason})` : ""}`))
            .catch((err) => console.log("[knowledge] scheduled refresh failed:", err.message));
    }, everyMs);
    if (timer.unref) timer.unref();

    console.log(`[knowledge] website refresh scheduled every ${hours} hour(s)`);
    return timer;
}


/* -------------------------------- status -------------------------------- */

async function getKnowledgeStatus() {
    const records = await knowledgeService.getStore().list();
    const set = restrictedSet();

    const byFile = new Map();
    for (const record of records) {
        const meta = record.metadata || {};
        const file = meta.source_file || meta.url || "(unknown source)";
        if (!byFile.has(file)) {
            byFile.set(file, { source_file: file, document_type: meta.document_type || null, chunks: 0 });
        }
        byFile.get(file).chunks++;
    }

    const uploads = {};
    for (const sidecar of listSidecars(UPLOADS_DIR)) {
        const meta = readJson(sidecar, {});
        uploads[path.basename(sidecar).replace(/\.meta\.json$/i, "")] = {
            uploaded_at: meta.uploaded_at || null,
            uploaded_by: meta.uploaded_by || null,
            title: meta.title || null,
        };
    }

    const documents = [...byFile.values()]
        .map((doc) => ({
            ...doc,
            access: set.has(doc.source_file) ? "restricted" : "public",
            upload: uploads[doc.source_file] || null,
        }))
        .sort((a, b) => a.source_file.localeCompare(b.source_file));

    const log = readUpdatesLog();

    return {
        total_chunks: records.length,
        total_documents: documents.length,
        documents,
        last_website_refresh: log.website || null,
        recent_updates: (log.events || []).slice(0, 10),
        index: readJson(MANIFEST_PATH, null),
    };
}


module.exports = {
    KnowledgeError,
    uploadDocument,
    deleteDocument,
    refreshWebsite,
    startScheduler,
    syncRestrictedSources,
    getKnowledgeStatus,
    sanitizeFilename,
};
