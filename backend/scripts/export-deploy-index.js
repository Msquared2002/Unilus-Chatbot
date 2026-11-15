/**
 * export-deploy-index.js
 * =======================
 * Makes the knowledge index that the HOSTED backend starts with.
 *
 *   cd backend
 *   npm run export:index        (then commit backend/seed/ with git)
 *
 * Why: data/vectors/knowledge_vectors.json is listed in backend/.gitignore, so it is never pushed. A host that
 * clones the repository would start with an empty knowledge base. This copies it to backend/seed/ (which Git
 * does track) and LEAVES OUT every document staff uploaded through the dashboard (source_type "staff_upload"),
 * so test or private uploads are not published. Run it again after you rebuild the index.
 *
 * Your own live file is only read, never changed.
 */

const fs = require("fs");
const path = require("path");

const SOURCE = path.join(__dirname, "../data/vectors/knowledge_vectors.json");
const MANIFEST = path.join(__dirname, "../data/vectors/index_manifest.json");
const OUT_DIR = path.join(__dirname, "../seed");

if (!fs.existsSync(SOURCE)) {
    console.error(`Cannot find ${SOURCE}.\nRun this on the computer where the knowledge index was built (npm run build-index).`);
    process.exit(1);
}

const records = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
if (!Array.isArray(records)) {
    console.error("knowledge_vectors.json is not in the expected format (a list of records).");
    process.exit(1);
}

const kept = records.filter((r) => !r.metadata || r.metadata.source_type !== "staff_upload");
const removed = records.length - kept.length;
const removedFiles = [...new Set(records.filter((r) => r.metadata && r.metadata.source_type === "staff_upload").map((r) => r.metadata.source_file))];

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "knowledge_vectors.json"), JSON.stringify(kept));

// Keep the manifest's counts honest for the trimmed copy.
let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); } catch { /* no manifest: write a minimal one */ }
manifest.chunk_count = kept.length;
manifest.vector_count = kept.length;
delete manifest.last_incremental_update;
fs.writeFileSync(path.join(OUT_DIR, "index_manifest.json"), JSON.stringify(manifest, null, 2));

const mb = (fs.statSync(path.join(OUT_DIR, "knowledge_vectors.json")).size / 1e6).toFixed(1);
console.log(`Wrote backend/seed/knowledge_vectors.json: ${kept.length} records, ${mb} MB.`);
console.log(`Left out ${removed} record(s) from staff uploads${removedFiles.length ? `: ${removedFiles.join(", ")}` : ""}.`);
console.log("Next: git add backend/seed && git commit && git push");
