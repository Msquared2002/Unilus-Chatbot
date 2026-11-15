/**
 * prepare-data-dir.js
 * ====================
 * Runs before the server on a HOSTED machine (npm run start:host). Never needed on your own computer.
 *
 * The backend keeps everything that changes while it runs under backend/data: the database, documents staff upload,
 * the search index (which grows when a document is uploaded), the update logs. A host throws that folder away on
 * every deploy unless it sits on a persistent disk. This script makes that work:
 *
 *   DATA_PERSIST_DIR=/var/data   (the path where the host mounted its persistent disk)
 *     1. copies anything the disk does not have yet from the repository's backend/data (never overwrites)
 *     2. makes sure the disk has the knowledge index (from backend/seed, see scripts/export-deploy-index.js)
 *     3. points backend/data at the disk, so the server needs no change
 *   After that, staff uploads, tickets, feedback and the index survive restarts and new deploys.
 *
 *   DATA_PERSIST_DIR not set: only step 2, applied to backend/data (for hosts without a disk; uploads will be lost
 *   when it restarts).
 *
 * Safe to run on every start: files that already exist are never replaced.
 */

const fs = require("fs");
const path = require("path");

const BACKEND = path.join(__dirname, "..");
const DATA = path.join(BACKEND, "data");
const SEED = path.join(BACKEND, "seed");
const PERSIST = process.env.DATA_PERSIST_DIR ? path.resolve(process.env.DATA_PERSIST_DIR) : null;

const isLink = (p) => { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } };

// Copies files from `from` into `to`, skipping anything that already exists in `to`.
function copyMissing(from, to) {
    if (!fs.existsSync(from)) return 0;
    fs.mkdirSync(to, { recursive: true });
    let copied = 0;
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        const src = path.join(from, entry.name);
        const dest = path.join(to, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) copied += copyMissing(src, dest);
        else if (!fs.existsSync(dest)) { fs.copyFileSync(src, dest); copied += 1; }
    }
    return copied;
}

// Puts the starting knowledge index in place when there is none yet.
function seedIndex(dataDir) {
    const target = path.join(dataDir, "vectors", "knowledge_vectors.json");
    const seed = path.join(SEED, "knowledge_vectors.json");
    if (fs.existsSync(target)) return "already there";
    if (!fs.existsSync(seed)) {
        console.warn("WARNING: there is no knowledge index (data/vectors/knowledge_vectors.json) and no backend/seed copy.\n" +
            "         The chatbot will have no UNILUS knowledge. On your own computer run: cd backend && npm run export:index, then commit backend/seed.");
        return "missing";
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(seed, target);
    const seedManifest = path.join(SEED, "index_manifest.json");
    if (fs.existsSync(seedManifest)) fs.copyFileSync(seedManifest, path.join(dataDir, "vectors", "index_manifest.json"));
    return "seeded";
}

try {
    if (!PERSIST) {
        console.log(`[host] no DATA_PERSIST_DIR: knowledge index ${seedIndex(DATA)}. Uploads and tickets will NOT survive a restart.`);
        process.exit(0);
    }

    fs.mkdirSync(PERSIST, { recursive: true });
    fs.accessSync(PERSIST, fs.constants.W_OK);

    if (!isLink(DATA)) {
        const copied = copyMissing(DATA, PERSIST);
        console.log(`[host] copied ${copied} new file(s) from the repository into ${PERSIST}`);
        fs.rmSync(`${DATA}.repo-copy`, { recursive: true, force: true });
        fs.renameSync(DATA, `${DATA}.repo-copy`);
        fs.symlinkSync(PERSIST, DATA, "dir");
    }
    console.log(`[host] backend/data -> ${PERSIST}; knowledge index ${seedIndex(PERSIST)}.`);
} catch (error) {
    // Failing loudly is better than silently running on a disk that is wiped at the next restart.
    console.error(`[host] could not prepare the data folder: ${error.message}`);
    process.exit(1);
}
