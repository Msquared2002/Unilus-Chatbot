const test = require("node:test");
const assert = require("node:assert/strict");
const { readDocx } = require("../services/documentIngestion/readers/docxReader");
const { buildTestDocx } = require("./fixtures/buildTestDocx");

test("readDocx extracts heading, paragraph, and table from a real docx buffer", async () => {
  const buffer = await buildTestDocx();
  const { blocks, firstHeading } = await readDocx(buffer, { filename: "deferment-policy.docx" });

  assert.equal(firstHeading, "Deferment Policy");

  const heading = blocks.find((b) => b.type === "heading");
  assert.ok(heading);
  assert.equal(heading.text, "Deferment Policy");

  const paragraph = blocks.find((b) => b.type === "paragraph");
  assert.ok(paragraph);
  assert.match(paragraph.text, /defer their studies for up to one academic year/);

  const table = blocks.find((b) => b.type === "table");
  assert.ok(table, "expected the docx table to be extracted as a table block");
  assert.match(table.text, /Programme \| Max Deferment/);
  assert.match(table.text, /BIT \| 1 year/);
});
