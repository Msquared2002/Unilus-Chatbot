#!/usr/bin/env node
/**
 * scripts/buildKnowledgeIndex.js
 * ================================
 *
 * Steps 7-8 of the ingestion pipeline: generate an embedding for
 * every chunk in data/documents/chunks.json and store it in the
 * vector store. Requires the local embedding model
 * (@xenova/transformers), which downloads its weights on first run —
 * no API key needed, but it does need network access once.
 *
 * Usage:
 *   node scripts/buildKnowledgeIndex.js
 */

const fs = require("fs");
const path = require("path");

const embeddingService = require("../services/embeddingService");
const { JsonVectorStore } = require("../services/vectorStore");
const { buildSearchText, runtimeMetadata } = require("../services/searchTextService");

async function main() {
  const documentsChunksPath = path.join(__dirname, "../data/documents/chunks.json");
  const websiteChunksPath = path.join(__dirname, "../data/website/chunks.json");
  const vectorsPath = path.join(__dirname, "../data/vectors/knowledge_vectors.json");

  const chunks = [];

  if (fs.existsSync(documentsChunksPath)) {
    chunks.push(...JSON.parse(fs.readFileSync(documentsChunksPath, "utf8")));
  } else {
    console.warn(`[build-index] ${documentsChunksPath} not found — skipping (run "node scripts/ingestDocuments.js" if you have PDFs/DOCX/TXT to include).`);
  }

  // Additive: website chunks are optional and live in a separate file
  // (see scripts/ingestWebsite.js) so the original PDF/DOCX/TXT
  // pipeline's own output file is never touched by this addition.
  if (fs.existsSync(websiteChunksPath)) {
    chunks.push(...JSON.parse(fs.readFileSync(websiteChunksPath, "utf8")));
  } else {
    console.warn(`[build-index] ${websiteChunksPath} not found — skipping (run "node scripts/ingestWebsite.js" if you want website content included).`);
  }

  if (chunks.length === 0) {
    console.error("[build-index] No chunks found in data/documents/chunks.json or data/website/chunks.json. Nothing to index.");
    process.exit(1);
  }

  console.log(`[build-index] embedding ${chunks.length} chunk(s)...`);

  const store = new JsonVectorStore(vectorsPath);
  await store.clear();

  const records = [];
  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const metadata = runtimeMetadata(chunk.metadata || {}, chunk.text || "");
      const searchText = buildSearchText(chunk.text, metadata);
      const embedding = await embeddingService.createEmbedding(searchText);
      records.push({
        id: chunk.id,
        text: chunk.text,
        search_text: searchText,
        embedding,
        metadata,
      });

      if ((i + 1) % 25 === 0 || i === chunks.length - 1) {
        console.log(`[build-index] ${i + 1}/${chunks.length}`);
      }
    }
  } catch (err) {
    console.error(
      "[build-index] Failed to generate embeddings.\n" +
        "This step downloads the embedding model (Xenova/all-MiniLM-L6-v2) from\n" +
        "huggingface.co the first time it runs — it needs outbound network access\n" +
        "to that host once. If you're behind a firewall/proxy or in a sandboxed\n" +
        "CI environment, allow huggingface.co, or pre-download the model on a\n" +
        "machine with access and set the HF_HOME cache directory accordingly.\n" +
        `Original error: ${err.message}`
    );
    process.exit(1);
  }

  await store.upsert(records);

  const manifestPath = path.join(__dirname, "../data/vectors/index_manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify({
    version: 2,
    generated_at: new Date().toISOString(),
    chunk_count: chunks.length,
    vector_count: records.length,
    embedding_model: embeddingService.MODEL_NAME,
    embedding_dimensions: embeddingService.EMBEDDING_DIMENSIONS,
    embedding_input: "metadata_enriched_search_text_v1",
    search_text_schema: "metadata_enriched_search_text_v1",
    needs_embedding_rebuild: false,
  }, null, 2));

  console.log(`[build-index] wrote ${records.length} vectors to ${vectorsPath}`);
  console.log(`[build-index] wrote index manifest to ${manifestPath}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
