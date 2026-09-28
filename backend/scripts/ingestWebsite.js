#!/usr/bin/env node
/**
 * scripts/ingestWebsite.js
 * ==========================
 *
 * Crawls every URL in services/documentIngestion/website/sourcesConfig.js,
 * extracts structured blocks with the SAME htmlReader.js used for
 * uploaded HTML documents, removes cross-page navigation/boilerplate,
 * chunks with the SAME chunker.js used everywhere else, and writes
 * the result to data/website/chunks.json.
 *
 * Deliberately writes to a DIFFERENT file than
 * data/documents/chunks.json (the PDF/DOCX/TXT pipeline's output) —
 * "do not remove the existing data folder" / "do not remove the PDF
 * pipeline" means this must never overwrite or depend on that file.
 * buildKnowledgeIndex.js reads both when building the vector index.
 *
 * Usage:
 *   node scripts/ingestWebsite.js
 *   node scripts/ingestWebsite.js --config path/to/customSources.js
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");

const { readHtml } = require("../services/documentIngestion/readers/htmlReader");
const { chunkBlocks } = require("../services/documentIngestion/chunker");
const { buildDocumentMetadata } = require("../services/documentIngestion/metadata");
const { dedupeAcrossPages } = require("../services/documentIngestion/website/dedupe");
const { WEBSITE_SOURCES, ROUTING_ONLY_MAX_CHARS } = require("../services/documentIngestion/website/sourcesConfig");

const FETCH_TIMEOUT_MS = 15000;

async function fetchPage(url) {
  const response = await axios.get(url, {
    timeout: FETCH_TIMEOUT_MS,
    headers: { "User-Agent": "UNILUS-Digital-Companion-Crawler/1.0" },
    validateStatus: (status) => status >= 200 && status < 400,
  });
  return response.data;
}

function stableChunkId(url, chunkIndex, section) {
  return crypto.createHash("sha1").update(`${url}::${section || ""}::${chunkIndex}`).digest("hex").slice(0, 16);
}

function truncateBlocksForRoutingOnlyPage(blocks, maxChars) {
  const text = blocks.map((b) => b.text).filter(Boolean).join(" ").slice(0, maxChars);
  if (!text) return [];
  return [{ type: "paragraph", text, page: 1 }];
}

async function crawlAndBuildChunks(sources, fetchFn = fetchPage) {
  const activeSources = sources.filter((s) => s.page_type !== "external_no_crawl");

  const pagesBlocks = {};
  const pageMeta = {};

  for (const source of activeSources) {
    try {
      const html = await fetchFn(source.url);
      const { blocks, firstHeading } = readHtml(html, { filename: source.url });
      pagesBlocks[source.url] = blocks;
      pageMeta[source.url] = { ...source, firstHeading };
    } catch (err) {
      pageMeta[source.url] = { ...source, error: err.message };
    }
  }

  const { cleaned, boilerplateCount } = dedupeAcrossPages(pagesBlocks);

  const allChunks = [];

  for (const url of Object.keys(cleaned)) {
    const meta = pageMeta[url];
    let blocks = cleaned[url];

    if (meta.page_type === "routing_only") {
      blocks = truncateBlocksForRoutingOnlyPage(blocks, ROUTING_ONLY_MAX_CHARS);
    }

    const chunks = chunkBlocks(blocks);
    const documentMeta = buildDocumentMetadata({
      filename: url,
      documentType: "website",
      firstHeading: meta.firstHeading,
      sourceUrl: url,
    });

    for (const chunk of chunks) {
      if (!chunk.text || chunk.text.length < 20) continue;
      allChunks.push({
        id: stableChunkId(url, chunk.chunk_index, chunk.section),
        text: chunk.text,
        metadata: {
          ...documentMeta,
          topic: meta.topic,
          page_type: meta.page_type,
          section: chunk.section,
          chunk_index: chunk.chunk_index,
          page_number: null, // web pages have no page concept
        },
      });
    }
  }

  return { chunks: allChunks, boilerplateCount, failedUrls: Object.entries(pageMeta).filter(([, m]) => m.error).map(([u]) => u) };
}

async function main() {
  const sources = WEBSITE_SOURCES;
  const externalCount = sources.filter((s) => s.page_type === "external_no_crawl").length;
  console.log(`[ingest-website] crawling ${sources.length - externalCount} page(s) (${externalCount} external link(s) skipped)`);

  const { chunks, boilerplateCount, failedUrls } = await crawlAndBuildChunks(sources);

  console.log(`[ingest-website] removed ${boilerplateCount} distinct boilerplate block(s) shared across pages`);
  if (failedUrls.length) {
    console.log(`[ingest-website] ${failedUrls.length} page(s) failed to fetch:`);
    failedUrls.forEach((u) => console.log(`  - ${u}`));
  }

  const outputPath = path.join(__dirname, "../data/website/chunks.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(chunks, null, 2));

  console.log(`[ingest-website] wrote ${chunks.length} total chunks to ${outputPath}`);
  console.log(`[ingest-website] next: node scripts/buildKnowledgeIndex.js`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { fetchPage, truncateBlocksForRoutingOnlyPage, stableChunkId, crawlAndBuildChunks };
