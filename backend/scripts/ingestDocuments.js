#!/usr/bin/env node
/**
 * scripts/ingestDocuments.js
 * ============================
 *
 * Steps 1-6 of the ingestion pipeline: read documents from
 * data/documents/, extract structured blocks, chunk them, and attach
 * metadata. Deliberately does NOT generate embeddings — that's
 * buildKnowledgeIndex.js's job, so re-chunking (fast, no model
 * needed) and re-embedding (slow, needs the model) can be run and
 * iterated on independently.
 *
 * Usage:
 *   node scripts/ingestDocuments.js
 *   node scripts/ingestDocuments.js --documents-dir path/to/dir
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { chunkBlocks } = require("../services/documentIngestion/chunker");
const { buildDocumentMetadata } = require("../services/documentIngestion/metadata");
const { readText } = require("../services/documentIngestion/readers/textReader");
const { readHtml } = require("../services/documentIngestion/readers/htmlReader");
const { readDocx } = require("../services/documentIngestion/readers/docxReader");
const { readPdf } = require("../services/documentIngestion/readers/pdfReader");

const READERS = {
  ".txt": async (buffer, opts) => readText(buffer.toString("utf8"), opts),
  ".html": async (buffer, opts) => readHtml(buffer.toString("utf8"), opts),
  ".htm": async (buffer, opts) => readHtml(buffer.toString("utf8"), opts),
  ".docx": async (buffer, opts) => readDocx(buffer, opts),
  ".pdf": async (buffer, opts) => readPdf(buffer, opts),
};

function cleanBlockText(text) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/-- \d+ of \d+ --/gi, "") // known page-footer noise pattern
    .trim();
}

function stableChunkId(sourceFile, chunkIndex, section) {
  const hash = crypto
    .createHash("sha1")
    .update(`${sourceFile}::${section || ""}::${chunkIndex}`)
    .digest("hex");
  return hash.slice(0, 16);
}

function findDocuments(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findDocuments(fullPath));
    } else if (READERS[path.extname(entry.name).toLowerCase()]) {
      files.push(fullPath);
    }
  }
  return files;
}

async function ingestFile(filePath) {
  const filename = path.basename(filePath);
  const ext = path.extname(filename).toLowerCase();
  const reader = READERS[ext];

  const buffer = fs.readFileSync(filePath);
  const { blocks, firstHeading } = await reader(buffer, { filename });

  const cleanedBlocks = blocks.map((b) => ({ ...b, text: cleanBlockText(b.text || "") }));

  const chunks = chunkBlocks(cleanedBlocks);
  const documentPreview = cleanedBlocks
    .map((b) => b.text)
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000);
  const documentMeta = buildDocumentMetadata({
    filename,
    firstHeading,
    firstFewLines: documentPreview,
  });
  const sidecarPath = `${filePath}.meta.json`;
  const sourceMeta = fs.existsSync(sidecarPath)
    ? JSON.parse(fs.readFileSync(sidecarPath, "utf8"))
    : {};

  return chunks
    .filter((c) => c.text && c.text.length > 20) // drop near-empty noise chunks
    .map((chunk) => ({
      id: stableChunkId(filename, chunk.chunk_index, chunk.section),
      text: chunk.text,
      metadata: {
        ...documentMeta,
        ...sourceMeta,
        section: chunk.section,
        chunk_index: chunk.chunk_index,
        page_number: chunk.page_number,
        page_range: chunk.page_range,
      },
    }));
}

async function main() {
  const args = process.argv.slice(2);
  const dirFlagIndex = args.indexOf("--documents-dir");
  const documentsDir =
    dirFlagIndex !== -1 && args[dirFlagIndex + 1]
      ? args[dirFlagIndex + 1]
      : path.join(__dirname, "../data/documents");

  const outputPath = path.join(__dirname, "../data/documents/chunks.json");

  const files = findDocuments(documentsDir);
  console.log(`[ingest] found ${files.length} document(s) in ${documentsDir}`);

  const allChunks = [];
  for (const filePath of files) {
    process.stdout.write(`[ingest] ${path.basename(filePath)} ... `);
    try {
      const chunks = await ingestFile(filePath);
      allChunks.push(...chunks);
      console.log(`${chunks.length} chunk(s)`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(allChunks, null, 2));

  console.log(`[ingest] wrote ${allChunks.length} total chunks to ${outputPath}`);
  console.log(`[ingest] next: node scripts/buildKnowledgeIndex.js`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { ingestFile, findDocuments, stableChunkId, cleanBlockText };
