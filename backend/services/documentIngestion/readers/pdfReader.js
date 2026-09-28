/**
 * readers/pdfReader.js
 * ======================
 *
 * Page-aware PDF text extraction. This is the single biggest
 * traceability gap in the old pipeline: extractPDFs.js called
 * pdf-parse for the WHOLE document as one string and never asked for
 * per-page text, so page_number was structurally unrecoverable by
 * the time buildPDFKnowledge.js ran.
 *
 * pdf-parse (v2.x, the version already in package.json) exposes
 * per-page extraction via `getText({ partial: [pageNumber] })`. This
 * reader calls that once per page (using `getInfo()` first to learn
 * the page count) so every resulting block carries a real page
 * number, and applies the same heading/list heuristics textReader.js
 * uses (PDF text has no tags, same as .txt) — reused directly rather
 * than reimplemented, since the heuristic is the same problem either
 * way: is this short standalone line a heading or not.
 *
 * A note on tables: pdf-parse's plain-text extraction does not
 * reconstruct table grid structure the way pdf.js's structured mode
 * can — a table on a PDF page comes out as a run of short lines. This
 * reader detects likely table rows (multiple runs of 2+ spaces, or a
 * consistent short-line-with-numbers pattern) heuristically and
 * groups them into a "table" block so chunker.js won't split them,
 * but this is a heuristic, not a guarantee — genuinely complex PDF
 * tables may still come through as several short paragraph/list
 * lines. This is documented here rather than silently assumed to work.
 *
 * ENVIRONMENT NOTE: during development, this failed to load inside a
 * throwaway review sandbox with a stale/mismatched node_modules
 * install. Confirmed working end-to-end here against a real UNILUS
 * PDF (`tests/fixtures/sample.pdf`) after a clean
 * `npm install pdf-parse`. If you see a native-module load error in
 * your environment, the fix is almost always `rm -rf node_modules
 * package-lock.json && npm install`, not a code change — pdf-parse's
 * pdf.js dependency is sensitive to a stale worker build living
 * alongside a newer pdf-parse version.
 */

const { looksLikeListLine } = require("./_lineHeuristics");

function looksLikeHeadingLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 80) return false;
  if (/[.!?,:;]$/.test(trimmed)) return false;
  return true;
}

function looksLikeTableRow(line) {
  // Two or more runs of 2+ spaces (columns), OR a short line ending in
  // a number/currency amount, are the two most common plain-text
  // table-row shapes pdf-parse produces.
  if (/(\S+\s{2,}){2,}\S+/.test(line)) return true;
  if (/^\S.{0,60}\s\d[\d,.]*\s*$/.test(line.trim())) return true;
  return false;
}

function pageTextToBlocks(pageText, pageNumber) {
  const lines = pageText.split(/\r?\n/).map((l) => l.replace(/\s+$/, ""));
  const blocks = [];

  let paragraphBuffer = [];
  let listBuffer = [];
  let tableBuffer = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length) {
      blocks.push({ type: "paragraph", text: paragraphBuffer.join(" ").trim(), page: pageNumber });
      paragraphBuffer = [];
    }
  };
  const flushList = () => {
    if (listBuffer.length) {
      blocks.push({ type: "list", text: listBuffer.join("\n"), page: pageNumber });
      listBuffer = [];
    }
  };
  const flushTable = () => {
    if (tableBuffer.length >= 2) {
      blocks.push({ type: "table", text: tableBuffer.join("\n"), page: pageNumber });
    } else if (tableBuffer.length === 1) {
      paragraphBuffer.push(tableBuffer[0]);
    }
    tableBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    if (looksLikeTableRow(trimmed)) {
      flushParagraph();
      flushList();
      tableBuffer.push(trimmed);
      continue;
    }
    flushTable();

    if (looksLikeListLine(trimmed)) {
      flushParagraph();
      listBuffer.push(trimmed);
      continue;
    }
    flushList();

    const nextLine = (lines[i + 1] || "").trim();
    if (looksLikeHeadingLine(trimmed) && (nextLine === "" || i === 0)) {
      flushParagraph();
      blocks.push({ type: "heading", text: trimmed, level: 1, page: pageNumber });
      continue;
    }

    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushTable();

  return blocks;
}

async function readPdf(buffer, { filename = "document.pdf" } = {}) {
  // Imported lazily so environments without a working pdf-parse
  // native dependency can still load and test the rest of this module.
  const { PDFParse } = require("pdf-parse");

  const parser = new PDFParse({ data: buffer });

  try {
    const info = await parser.getInfo();
    const pageCount = info.total || info.numpages || 1;

    const blocks = [];

    for (let page = 1; page <= pageCount; page++) {
      const pageResult = await parser.getText({ partial: [page] });
      const pageText = pageResult.text || "";
      blocks.push(...pageTextToBlocks(pageText, page));
      if (page < pageCount) blocks.push({ type: "page_break", text: "", page });
    }

    const firstHeading = (blocks.find((b) => b.type === "heading") || {}).text || null;

    return { blocks, pageCount, firstHeading };
  } finally {
    await parser.destroy();
  }
}

module.exports = { readPdf, pageTextToBlocks, looksLikeTableRow, looksLikeHeadingLine };
