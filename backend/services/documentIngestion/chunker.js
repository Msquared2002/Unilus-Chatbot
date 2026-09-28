/**
 * documentIngestion/chunker.js
 * =============================
 *
 * WHY NOT "SPLIT EVERY 800 CHARACTERS"
 * --------------------------------------
 * The previous pipeline (buildPDFKnowledge.js::chunkText) sliced raw
 * text into fixed 800-character windows with a 200-character overlap,
 * with zero awareness of what was actually in that window. That
 * reliably cuts sentences, table rows, and numbered list items in
 * half, and produces chunks whose boundaries carry no semantic
 * meaning at all.
 *
 * This chunker instead operates on a list of typed BLOCKS that a
 * reader (pdfReader/docxReader/htmlReader/textReader) has already
 * identified — headings, paragraphs, list items, table rows, and page
 * breaks — and makes chunking decisions based on that structure:
 *
 * BLOCK SHAPE (what every reader must produce)
 * ----------------------------------------------
 *   { type: "heading" | "paragraph" | "list" | "table" | "page_break",
 *     text: string,        // for page_break, text is "" and only `page` matters
 *     page: number|null,   // 1-indexed page this block starts on, if known
 *     level: number|null } // heading level (1 = title-ish, 2 = subheading, ...)
 *
 * CHUNKING RULES
 * ----------------
 * 1. A heading always starts a new chunk. Headings are the strongest
 *    available signal for "this is a new topic" — respecting them
 *    keeps each chunk on a single subject, which is exactly what
 *    retrieval quality depends on.
 * 2. A table or list block is NEVER split across chunk boundaries as
 *    long as it fits under MAX_CHUNK_CHARS. Splitting a table mid-row
 *    (which the old chunker did constantly, since it had no idea a
 *    table even existed) produces a chunk with dangling numbers and
 *    no header context — useless for answering "what are the fees".
 *    If a single table exceeds MAX_CHUNK_CHARS, it is split by row,
 *    and the table's own header row is repeated at the top of every
 *    resulting chunk so each piece is still self-contained.
 * 3. Ordinary paragraphs accumulate into a chunk up to TARGET_CHUNK_CHARS,
 *    then the chunk is flushed. Target size (900 chars, ~150-200
 *    words) is chosen to comfortably hold 2-4 paragraphs of policy
 *    prose — enough context for the embedding model to represent the
 *    topic accurately, without diluting it with unrelated content
 *    from three paragraphs later.
 * 4. Overlap: when a chunk is flushed purely because it hit the size
 *    target (not because a heading or a page/section boundary forced
 *    it), the LAST completed paragraph of that chunk is repeated as
 *    the first paragraph of the next chunk. This is deliberately
 *    small (usually one paragraph, not a fixed character count) and
 *    is never carried across a heading boundary — overlapping across
 *    a topic change would blend two unrelated subjects into one
 *    embedding and hurt precision, which defeats the purpose of
 *    overlap (preserving context that a mid-topic split would break).
 * 5. Page numbers are tracked per block. A chunk's `page_number` is
 *    the page its first block started on; if the chunk spans pages,
 *    the full span is preserved in `page_range` for anyone who needs
 *    it, without overcomplicating the primary citation field.
 */

const MAX_CHUNK_CHARS = 1600; // hard ceiling before a table/list is forcibly split
const TARGET_CHUNK_CHARS = 900; // where ordinary prose chunks aim to land

function splitLongText(text, maxChars) {
  const clean = String(text || "").trim();
  if (!clean || clean.length <= maxChars) return clean ? [clean] : [];

  // Prefer sentence boundaries; fall back to words for a single enormous
  // sentence/URL-heavy paragraph. No returned piece exceeds maxChars unless
  // one individual token itself is longer than maxChars.
  const units = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  const pieces = [];
  let current = "";

  function pushUnit(unit) {
    const value = unit.trim();
    if (!value) return;

    if (value.length > maxChars) {
      const words = value.split(/\s+/);
      let wordBuffer = "";
      for (const word of words) {
        if (!wordBuffer) {
          wordBuffer = word;
        } else if (wordBuffer.length + 1 + word.length <= maxChars) {
          wordBuffer += ` ${word}`;
        } else {
          pieces.push(wordBuffer);
          wordBuffer = word;
        }
      }
      if (wordBuffer) pieces.push(wordBuffer);
      return;
    }

    if (!current) current = value;
    else if (current.length + 1 + value.length <= maxChars) current += ` ${value}`;
    else {
      pieces.push(current);
      current = value;
    }
  }

  for (const unit of units) pushUnit(unit);
  if (current) pieces.push(current);
  return pieces;
}

function chunkBlocks(blocks, { targetChars = TARGET_CHUNK_CHARS, maxChars = MAX_CHUNK_CHARS } = {}) {
  const chunks = [];

  let currentSection = null;
  let currentSectionLevel = null;

  let buffer = []; // array of { text, page }
  let bufferChars = 0;
  let bufferStartPage = null;
  let lastFlushedParagraph = null; // for overlap

  function flush({ allowOverlapForward = true } = {}) {
    if (buffer.length === 0) return;

    const text = buffer.map((b) => b.text).join("\n\n").trim();
    if (text) {
      const pages = buffer.map((b) => b.page).filter((p) => p != null);
      chunks.push({
        text,
        section: currentSection,
        page_number: bufferStartPage,
        page_range: pages.length ? [Math.min(...pages), Math.max(...pages)] : null,
      });

      lastFlushedParagraph = allowOverlapForward
        ? buffer[buffer.length - 1].text
        : null;
    }

    buffer = [];
    bufferChars = 0;
    bufferStartPage = null;
  }

  function pushBlockText(text, page) {
    if (buffer.length === 0) {
      bufferStartPage = page;
      if (lastFlushedParagraph) {
        buffer.push({ text: lastFlushedParagraph, page });
        bufferChars += lastFlushedParagraph.length;
        lastFlushedParagraph = null; // consume the overlap once
      }
    }
    buffer.push({ text, page });
    bufferChars += text.length;
  }

  function splitLargeTableByRows(tableText, page) {
    const rows = tableText.split("\n").filter((r) => r.trim());
    if (rows.length === 0) return;

    const headerRow = rows[0];
    let group = [headerRow];
    let groupChars = headerRow.length;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (groupChars + row.length > maxChars && group.length > 1) {
        flush();
        pushBlockText(group.join("\n"), page);
        flush({ allowOverlapForward: false });
        group = [headerRow];
        groupChars = headerRow.length;
      }
      group.push(row);
      groupChars += row.length;
    }

    if (group.length > 1) {
      pushBlockText(group.join("\n"), page);
    }
  }

  function splitLargeListByItems(listText, page) {
    const items = listText.split("\n").map((x) => x.trim()).filter(Boolean);
    let group = [];
    let chars = 0;

    const emitGroup = () => {
      if (!group.length) return;
      pushBlockText(group.join("\n"), page);
      flush({ allowOverlapForward: false });
      group = [];
      chars = 0;
    };

    for (const item of items) {
      if (item.length > maxChars) {
        emitGroup();
        for (const piece of splitLongText(item, maxChars)) {
          pushBlockText(piece, page);
          flush({ allowOverlapForward: false });
        }
        continue;
      }

      if (group.length && chars + 1 + item.length > maxChars) emitGroup();
      group.push(item);
      chars += item.length + (group.length > 1 ? 1 : 0);
    }

    emitGroup();
  }

  for (const block of blocks) {
    if (block.type === "page_break") {
      // Page breaks don't force a chunk boundary by themselves — a
      // paragraph that happens to straddle a page break is still one
      // paragraph — but subsequent blocks' `page` values naturally
      // advance page_range for the current chunk.
      continue;
    }

    if (block.type === "heading") {
      flush({ allowOverlapForward: false }); // never overlap across a topic change
      currentSection = block.text;
      currentSectionLevel = block.level || 1;
      continue;
    }

    if (block.type === "table" || block.type === "list") {
      // Never split a table/list across the current prose chunk boundary.
      if (bufferChars > 0 && bufferChars + block.text.length > maxChars) {
        flush();
      }

      if (block.text.length > maxChars) {
        flush();
        if (block.type === "table") {
          splitLargeTableByRows(block.text, block.page);
          flush({ allowOverlapForward: false });
        } else {
          splitLargeListByItems(block.text, block.page);
        }
      } else {
        pushBlockText(block.text, block.page);
        flush({ allowOverlapForward: false }); // tables/lists are self-contained units
      }
      continue;
    }

    // Ordinary paragraph. A single extracted paragraph can itself be much
    // larger than the embedding model's useful context window (common on
    // website pages with one giant container). Split it semantically first
    // instead of allowing a 10k+ character chunk through.
    if (block.text.length > maxChars) {
      flush({ allowOverlapForward: false });
      for (const piece of splitLongText(block.text, maxChars)) {
        pushBlockText(piece, block.page);
        flush({ allowOverlapForward: false });
      }
      continue;
    }

    if (bufferChars > 0 && bufferChars + block.text.length > targetChars) {
      flush();
    }
    pushBlockText(block.text, block.page);
  }

  flush({ allowOverlapForward: false });

  return chunks.map((c, i) => ({ ...c, chunk_index: i }));
}

module.exports = { chunkBlocks, MAX_CHUNK_CHARS, TARGET_CHUNK_CHARS, splitLongText };
