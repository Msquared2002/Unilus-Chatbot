#!/usr/bin/env node
/**
 * Upgrade existing chunk/vector metadata WITHOUT re-parsing PDFs or making
 * network calls. This is safe to run on an existing corpus and is especially
 * useful after retrieval metadata rules improve.
 *
 * It does not regenerate embeddings. After this migration, lexical/metadata
 * retrieval is improved immediately; run `npm run build-index` later to make
 * dense embeddings use the enriched search text too.
 */

const fs = require("fs");
const path = require("path");
const { deriveTitle, buildDocumentMetadata } = require("../services/documentIngestion/metadata");
const { runtimeMetadata, buildSearchText } = require("../services/searchTextService");
const embeddingService = require("../services/embeddingService");

const ROOT = path.join(__dirname, "../data");
const CHUNK_FILES = [
  path.join(ROOT, "documents/chunks.json"),
  path.join(ROOT, "website/chunks.json"),
];
const VECTOR_FILE = path.join(ROOT, "vectors/knowledge_vectors.json");
const MANIFEST_FILE = path.join(ROOT, "vectors/index_manifest.json");

function enrichChunkArray(chunks) {
  const groups = new Map();

  for (const chunk of chunks) {
    const meta = chunk.metadata || {};
    const source = meta.source_file || meta.url || "unknown";
    if (!groups.has(source)) groups.set(source, []);
    groups.get(source).push(chunk);
  }

  const documentMetadata = new Map();
  for (const [source, group] of groups.entries()) {
    const firstMeta = group[0]?.metadata || {};

    if (firstMeta.document_type === "website") {
      documentMetadata.set(source, null);
      continue;
    }

    const preview = group
      .map((chunk) => chunk.text || "")
      .join("\n")
      .slice(0, 12000);

    const improvedTitle = firstMeta.source_file
      ? deriveTitle(firstMeta.source_file, firstMeta.title)
      : firstMeta.title;

    const derived = buildDocumentMetadata({
      filename: firstMeta.source_file || source,
      firstHeading: improvedTitle,
      firstFewLines: preview,
      sourceUrl: firstMeta.url || null,
    });

    documentMetadata.set(source, {
      ...firstMeta,
      ...derived,
      created_date: firstMeta.created_date || derived.created_date,
      department: firstMeta.department ?? derived.department,
    });
  }

  const sourceCounters = new Map();
  return chunks.map((chunk) => {
    const originalMeta = chunk.metadata || {};
    const source = originalMeta.source_file || originalMeta.url || "unknown";
    const nextIndex = sourceCounters.get(source) || 0;
    sourceCounters.set(source, nextIndex + 1);

    const docMeta = documentMetadata.get(source);
    const baseMeta = docMeta
      ? {
          ...originalMeta,
          ...docMeta,
          // Chunk-level provenance must never be replaced by document-level
          // metadata derived from a sibling chunk.
          section: originalMeta.section ?? null,
          page_number: originalMeta.page_number ?? null,
          page_range: originalMeta.page_range ?? null,
          chunk_index: Number.isInteger(originalMeta.chunk_index) ? originalMeta.chunk_index : nextIndex,
        }
      : {
          ...originalMeta,
          chunk_index: Number.isInteger(originalMeta.chunk_index) ? originalMeta.chunk_index : nextIndex,
        };

    return {
      ...chunk,
      metadata: runtimeMetadata(baseMeta, chunk.text || ""),
    };
  });
}

function main() {
  const metadataById = new Map();
  let totalChunks = 0;

  for (const file of CHUNK_FILES) {
    if (!fs.existsSync(file)) continue;
    const chunks = JSON.parse(fs.readFileSync(file, "utf8"));
    const enriched = enrichChunkArray(chunks);
    fs.writeFileSync(file, JSON.stringify(enriched, null, 2));
    enriched.forEach((chunk) => metadataById.set(chunk.id, chunk.metadata));
    totalChunks += enriched.length;
    console.log(`[metadata-upgrade] updated ${enriched.length} chunk(s): ${file}`);
  }

  let vectorCount = 0;
  if (fs.existsSync(VECTOR_FILE)) {
    const vectors = JSON.parse(fs.readFileSync(VECTOR_FILE, "utf8"));
    const enrichedVectors = vectors.map((record) => {
      const metadata = metadataById.get(record.id) || runtimeMetadata(record.metadata || {}, record.text || "");
      vectorCount += 1;
      return {
        ...record,
        metadata,
        search_text: buildSearchText(record.text || "", metadata),
      };
    });
    fs.writeFileSync(VECTOR_FILE, JSON.stringify(enrichedVectors, null, 2));
    console.log(`[metadata-upgrade] updated ${vectorCount} vector record(s) with enriched metadata/search_text`);
  }

  fs.mkdirSync(path.dirname(MANIFEST_FILE), { recursive: true });
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify({
    version: 2,
    updated_at: new Date().toISOString(),
    chunk_count: totalChunks,
    vector_count: vectorCount,
    embedding_model: embeddingService.MODEL_NAME,
    embedding_dimensions: embeddingService.EMBEDDING_DIMENSIONS,
    embedding_input: "legacy/raw text until next npm run build-index",
    search_text_schema: "metadata_enriched_search_text_v1",
    needs_embedding_rebuild: true,
  }, null, 2));
  console.log(`[metadata-upgrade] wrote ${MANIFEST_FILE}`);
  console.log("[metadata-upgrade] lexical/metadata retrieval is upgraded now; run `npm run build-index` to upgrade dense embeddings too.");
}

if (require.main === module) main();

module.exports = { enrichChunkArray, main };
