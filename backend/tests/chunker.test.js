const test = require("node:test");
const assert = require("node:assert/strict");
const { chunkBlocks } = require("../services/documentIngestion/chunker");

test("heading starts a new chunk and sets section", () => {
  const blocks = [
    { type: "heading", text: "Fees", level: 1, page: 1 },
    { type: "paragraph", text: "All fees are payable per semester.", page: 1 },
    { type: "heading", text: "Deferment", level: 1, page: 2 },
    { type: "paragraph", text: "Students may defer for one year.", page: 2 },
  ];

  const chunks = chunkBlocks(blocks);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].section, "Fees");
  assert.equal(chunks[1].section, "Deferment");
  assert.match(chunks[0].text, /payable per semester/);
  assert.match(chunks[1].text, /defer for one year/);
});

test("a small table is kept as a single self-contained chunk", () => {
  const blocks = [
    { type: "heading", text: "Fee Schedule", page: 1 },
    {
      type: "table",
      text: "Programme | Fee\nBIT | 15000\nBBA | 14000",
      page: 1,
    },
  ];

  const chunks = chunkBlocks(blocks);
  assert.equal(chunks.length, 1);
  assert.match(chunks[0].text, /BIT \| 15000/);
  assert.match(chunks[0].text, /BBA \| 14000/);
});

test("a table larger than the max is split by rows with the header repeated", () => {
  const header = "Programme | Fee | Currency | Campus | Notes";
  const rows = [header];
  for (let i = 0; i < 60; i++) {
    rows.push(`Programme${i} | ${10000 + i} | ZMW | Main Campus | Standard intake row ${i}`);
  }
  const tableText = rows.join("\n");

  const blocks = [{ type: "table", text: tableText, page: 3 }];
  const chunks = chunkBlocks(blocks, { maxChars: 400 });

  assert.ok(chunks.length > 1, "expected the oversized table to be split into multiple chunks");
  for (const chunk of chunks) {
    assert.match(chunk.text, new RegExp(header.replace(/[|]/g, "\\|")), "every split chunk must repeat the header row");
  }
});

test("a list block is never split", () => {
  const listText = "- Item one\n- Item two\n- Item three";
  const blocks = [
    { type: "heading", text: "Requirements", page: 1 },
    { type: "list", text: listText, page: 1 },
  ];

  const chunks = chunkBlocks(blocks);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].text, listText);
});

test("overlap carries the last paragraph forward only within the same section", () => {
  const blocks = [
    { type: "heading", text: "Registration", page: 1 },
    { type: "paragraph", text: "A".repeat(500), page: 1 },
    { type: "paragraph", text: "B".repeat(500), page: 1 },
    { type: "paragraph", text: "LAST_PARAGRAPH_MARKER", page: 1 },
    { type: "paragraph", text: "C".repeat(500), page: 1 },
  ];

  const chunks = chunkBlocks(blocks, { targetChars: 900 });
  assert.ok(chunks.length >= 2, "expected the size target to force at least one split");

  // Find where LAST_PARAGRAPH_MARKER ends a chunk, then confirm the
  // next chunk begins with it (the overlap).
  const markerChunkIndex = chunks.findIndex((c) => c.text.includes("LAST_PARAGRAPH_MARKER"));
  assert.notEqual(markerChunkIndex, -1);

  if (markerChunkIndex + 1 < chunks.length) {
    assert.ok(
      chunks[markerChunkIndex + 1].text.startsWith("LAST_PARAGRAPH_MARKER"),
      "expected the next chunk to open with the overlapping paragraph"
    );
  }
});

test("overlap does NOT cross a heading boundary", () => {
  const blocks = [
    { type: "heading", text: "Section A", page: 1 },
    { type: "paragraph", text: "A".repeat(850), page: 1 },
    { type: "paragraph", text: "UNIQUE_TAIL_OF_SECTION_A", page: 1 },
    { type: "heading", text: "Section B", page: 2 },
    { type: "paragraph", text: "Completely different topic.", page: 2 },
  ];

  const chunks = chunkBlocks(blocks, { targetChars: 900 });
  const sectionBChunk = chunks.find((c) => c.section === "Section B");
  assert.ok(sectionBChunk, "expected a Section B chunk");
  assert.ok(
    !sectionBChunk.text.includes("UNIQUE_TAIL_OF_SECTION_A"),
    "Section B must not inherit overlap text from Section A"
  );
});

test("page_number is the first page a chunk starts on, and page_range spans correctly", () => {
  const blocks = [
    { type: "heading", text: "Multi-page Section", page: 4 },
    { type: "paragraph", text: "Text on page four.", page: 4 },
    { type: "paragraph", text: "Text on page five.", page: 5 },
  ];

  const chunks = chunkBlocks(blocks, { targetChars: 5 }); // force everything into one chunk regardless of size since it's under max via table rules? use large target instead
  // Use a large target so both paragraphs land in one chunk to test page_range.
  const merged = chunkBlocks(blocks, { targetChars: 10000 });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].page_number, 4);
  assert.deepEqual(merged[0].page_range, [4, 5]);
});

test("chunk_index is sequential starting at 0", () => {
  const blocks = [
    { type: "heading", text: "A", page: 1 },
    { type: "paragraph", text: "one", page: 1 },
    { type: "heading", text: "B", page: 1 },
    { type: "paragraph", text: "two", page: 1 },
  ];
  const chunks = chunkBlocks(blocks);
  chunks.forEach((c, i) => assert.equal(c.chunk_index, i));
});

test("an oversized paragraph is split so no chunk exceeds maxChars", () => {
  const longParagraph = Array.from({ length: 140 }, (_, i) => `Sentence ${i} contains useful university information.`).join(" ");
  const chunks = chunkBlocks([
    { type: "heading", text: "Long Web Section", page: 1 },
    { type: "paragraph", text: longParagraph, page: 1 },
  ], { maxChars: 500, targetChars: 300 });

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.text.length <= 500));
});

test("an oversized list is split by items instead of becoming one embedding-truncated chunk", () => {
  const list = Array.from({ length: 80 }, (_, i) => `- Requirement ${i}: ${"detail ".repeat(6)}`).join("\n");
  const chunks = chunkBlocks([
    { type: "heading", text: "Requirements", page: 1 },
    { type: "list", text: list, page: 1 },
  ], { maxChars: 450, targetChars: 300 });

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.text.length <= 450));
});
