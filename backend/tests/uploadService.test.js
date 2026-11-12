const test = require("node:test");
const assert = require("node:assert/strict");
const PDFDocument = require("pdfkit");

const upload = require("../services/uploadService");

function makePdf(lines) {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    lines.forEach((line) => doc.text(line));
    doc.end();
  });
}

test("a text PDF is read and plain-pattern facts are found", async () => {
  const buffer = await makePdf([
    "Deferment Application Letter",
    "I am a student taking BIT320 and BSPH121.",
    "Please defer my studies from 15 January 2027. The fee paid was ZMW 4,500.",
    "Contact me at pete@example.com",
  ]);
  const doc = await upload.saveDocument({ sessionId: "s1", filename: "letter.pdf", buffer });
  assert.equal(doc.ext, ".pdf");
  assert.equal(doc.pages, 1);
  assert.match(doc.text, /Deferment Application Letter/);
  assert.deepEqual(doc.facts.courseCodes.sort(), ["BIT320", "BSPH121"]);
  assert.ok(doc.facts.dates.some((d) => /15 January 2027/.test(d)));
  assert.ok(doc.facts.amounts.some((a) => /4,500/.test(a)));
  assert.deepEqual(doc.facts.emails, ["pete@example.com"]);
});

test("a file is only returned to the chat session it was attached in", async () => {
  const buffer = await makePdf(["A short but real document with enough words to be read properly."]);
  const doc = await upload.saveDocument({ sessionId: "owner", filename: "a.pdf", buffer });
  assert.ok(upload.getDocument(doc.id, "owner"));
  assert.equal(upload.getDocument(doc.id, "someone-else"), null);
  assert.equal(upload.getDocument("not-an-id", "owner"), null);
});

test("a new upload replaces the previous one in the same session", async () => {
  const one = await upload.saveDocument({ sessionId: "swap", filename: "one.txt", buffer: Buffer.from("First file with plenty of readable words inside it.") });
  const two = await upload.saveDocument({ sessionId: "swap", filename: "two.txt", buffer: Buffer.from("Second file with plenty of readable words inside it.") });
  assert.equal(upload.getDocument(one.id, "swap"), null);
  assert.ok(upload.getDocument(two.id, "swap"));
});

test("unsupported types, empty files and files with no text are refused with a clear message", async () => {
  await assert.rejects(upload.saveDocument({ sessionId: "x", filename: "pic.png", buffer: Buffer.from("abc") }), /PDF, Word/);
  await assert.rejects(upload.saveDocument({ sessionId: "x", filename: "a.txt", buffer: Buffer.alloc(0) }), /No file/);
  await assert.rejects(upload.saveDocument({ sessionId: "x", filename: "blank.txt", buffer: Buffer.from("   \n  ") }), /couldn't find any text/);
  const blankPdf = await makePdf([""]);
  await assert.rejects(upload.saveDocument({ sessionId: "x", filename: "scan.pdf", buffer: blankPdf }), /couldn't find any text/);
  await assert.rejects(upload.saveDocument({ sessionId: "x", filename: "broken.pdf", buffer: Buffer.from("not a pdf at all") }), /couldn't open/);
});

test("filenames cannot carry a path", () => {
  assert.equal(upload.sanitizeFilename("..\\..\\secret/evil.pdf"), "evil.pdf");
});

test("a long file is sent as its opening plus the passages that match the question", async () => {
  const filler = Array.from({ length: 400 }, (_, i) => `Paragraph ${i} about general campus matters and nothing special here.`);
  filler[300] = "The hostel deposit refund deadline is stated in this paragraph.";
  const doc = await upload.saveDocument({ sessionId: "long", filename: "long.txt", buffer: Buffer.from(filler.join("\n\n")) });
  const excerpt = upload.excerptFor(doc, "what is the hostel deposit refund deadline?");
  assert.equal(excerpt.partial, true);
  assert.ok(excerpt.text.length <= 9500);
  assert.match(excerpt.text, /hostel deposit refund deadline/);
  assert.match(excerpt.text, /Paragraph 0 /);
});
