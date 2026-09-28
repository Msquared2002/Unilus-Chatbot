/**
 * readers/textReader.js
 * =======================
 *
 * Converts a .txt file into the shared block format every other
 * reader also produces (see chunker.js for the block shape). Plain
 * text has no headings/tables in a machine-detectable sense, so this
 * reader uses a light heuristic: a short line (< 80 chars) with no
 * terminal punctuation, followed by a blank line, is treated as a
 * heading. Everything else is a paragraph. Blank-line-separated runs
 * of "- " or "* " or numbered lines become a single list block.
 */

const { looksLikeListLine } = require("./_lineHeuristics");

function looksLikeHeading(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 80) return false;
  if (/[.!?,:;]$/.test(trimmed)) return false;
  return true;
}

function readText(rawText, { filename = "document.txt" } = {}) {
  const lines = rawText.split(/\r?\n/);
  const blocks = [];

  let paragraphBuffer = [];
  let listBuffer = [];

  function flushParagraph() {
    if (paragraphBuffer.length) {
      blocks.push({ type: "paragraph", text: paragraphBuffer.join(" ").trim(), page: 1 });
      paragraphBuffer = [];
    }
  }

  function flushList() {
    if (listBuffer.length) {
      blocks.push({ type: "list", text: listBuffer.join("\n"), page: 1 });
      listBuffer = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (looksLikeListLine(line)) {
      flushParagraph();
      listBuffer.push(trimmed);
      continue;
    }

    flushList();

    const nextLine = lines[i + 1] || "";
    if (looksLikeHeading(line) && (nextLine.trim() === "" || i === 0)) {
      flushParagraph();
      blocks.push({ type: "heading", text: trimmed, level: 1, page: 1 });
      continue;
    }

    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  flushList();

  return { blocks, pageCount: 1, firstHeading: (blocks.find((b) => b.type === "heading") || {}).text || null };
}

module.exports = { readText };
