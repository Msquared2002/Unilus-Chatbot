const test = require("node:test");
const assert = require("node:assert/strict");
const { pageTextToBlocks, looksLikeTableRow } = require("../services/documentIngestion/readers/pdfReader");

test("detects a heading followed by a paragraph on a page", () => {
  const pageText = "Fees\n\nAll fees are payable per semester in advance.";
  const blocks = pageTextToBlocks(pageText, 3);
  assert.equal(blocks[0].type, "heading");
  assert.equal(blocks[0].page, 3);
  assert.equal(blocks[1].type, "paragraph");
  assert.equal(blocks[1].page, 3);
});

test("groups list lines on a page into one list block", () => {
  const pageText = "Requirements\n\n- Certified ID\n- Passport photo\n- Application fee";
  const blocks = pageTextToBlocks(pageText, 1);
  const list = blocks.find((b) => b.type === "list");
  assert.ok(list);
  assert.equal(list.text.split("\n").length, 3);
});

test("recognizes a run of two-or-more space-separated columns as a table row", () => {
  assert.ok(looksLikeTableRow("Bachelor of IT        15,000        ZMW"));
  assert.ok(!looksLikeTableRow("This is a normal sentence with several words in it."));
});

test("recognizes a short 'label amount' line as a table row", () => {
  assert.ok(looksLikeTableRow("Registration fee 500"));
});

test("groups consecutive table-like rows into one table block, tagged with the page number", () => {
  const pageText = [
    "Fee Schedule",
    "",
    "Bachelor of IT        15,000",
    "Bachelor of Business  14,000",
    "Bachelor of Nursing   18,000",
  ].join("\n");

  const blocks = pageTextToBlocks(pageText, 7);
  const table = blocks.find((b) => b.type === "table");
  assert.ok(table, "expected a table block to be detected");
  assert.equal(table.page, 7);
  assert.equal(table.text.split("\n").length, 3);
});

test("a single table-like line with no neighbors is not promoted to a table block", () => {
  const pageText = "Some heading\n\nJust one line with two numbers 5 10 here.\n\nA following paragraph.";
  const blocks = pageTextToBlocks(pageText, 1);
  const table = blocks.find((b) => b.type === "table");
  assert.equal(table, undefined);
});
