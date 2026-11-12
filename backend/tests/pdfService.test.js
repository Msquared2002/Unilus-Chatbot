const test = require("node:test");
const assert = require("node:assert/strict");
const { PDFParse } = require("pdf-parse");

const { renderAnswerPdf, parseBlocks, toPdfText } = require("../services/pdfService");

test("markdown tables, lists and headings become blocks", () => {
  const blocks = parseBlocks("## Title\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n- one\n2. two\n\nPlain text");
  assert.deepEqual(blocks.map((b) => b.type), ["h", "table", "li", "li", "p"]);
  assert.deepEqual(blocks[1].rows, [["1", "2"]]);
});

test("emoji are dropped and arrows are mapped for the built-in PDF fonts", () => {
  assert.equal(toPdfText("Hello \uD83D\uDCE2 world \u2192 ok"), "Hello  world -> ok");
});

test("a rendered PDF is a real PDF that contains the answer and its sources", async () => {
  const pdf = await renderAnswerPdf({
    title: "Fee question",
    markdown: "## Fees\n\nThe **application fee** is listed below.\n\n| Item | Amount |\n|---|---|\n| Application | ZMW 100 |",
    sources: ["UNILUS handbook (p. 4)"],
  });
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  const parser = new PDFParse({ data: pdf });
  const { text } = await parser.getText();
  await parser.destroy();
  assert.match(text, /Fee question/);
  assert.match(text, /application fee/);
  assert.match(text, /ZMW 100/);
  assert.match(text, /UNILUS handbook \(p\. 4\)/);
});

test("a long table continues on a new page with its header repeated", async () => {
  const rows = Array.from({ length: 80 }, (_, i) => `| Day ${i} | BIT${100 + i} |`).join("\n");
  const pdf = await renderAnswerPdf({ title: "Long", markdown: `| Day | Course |\n|---|---|\n${rows}` });
  const parser = new PDFParse({ data: pdf });
  const info = await parser.getInfo();
  const { text } = await parser.getText();
  await parser.destroy();
  assert.ok((info.total || info.numpages) >= 2);
  assert.ok((text.match(/Course/g) || []).length >= 2);
});

test("empty content is refused", async () => {
  await assert.rejects(renderAnswerPdf({ markdown: "  " }), /Nothing to put/);
});
