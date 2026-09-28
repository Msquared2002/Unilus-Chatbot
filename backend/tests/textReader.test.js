const test = require("node:test");
const assert = require("node:assert/strict");
const { readText } = require("../services/documentIngestion/readers/textReader");

test("detects a short standalone line as a heading", () => {
  const text = "Fees\n\nAll fees are payable per semester in advance.";
  const { blocks } = readText(text);
  assert.equal(blocks[0].type, "heading");
  assert.equal(blocks[0].text, "Fees");
  assert.equal(blocks[1].type, "paragraph");
});

test("groups consecutive bullet lines into one list block", () => {
  const text = "Requirements\n\n- Certified ID\n- Passport photo\n- Application fee";
  const { blocks } = readText(text);
  const list = blocks.find((b) => b.type === "list");
  assert.ok(list);
  assert.equal(list.text.split("\n").length, 3);
});

test("does not treat a normal sentence as a heading", () => {
  const text = "This is a normal sentence that ends with punctuation.";
  const { blocks } = readText(text);
  assert.equal(blocks[0].type, "paragraph");
});

test("firstHeading is exposed for title derivation", () => {
  const text = "Student Handbook\n\nWelcome to UNILUS.";
  const { firstHeading } = readText(text);
  assert.equal(firstHeading, "Student Handbook");
});
