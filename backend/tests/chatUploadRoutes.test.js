const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const PDFDocument = require("pdfkit");

// The real chat service needs the database; these tests only check the upload/PDF routes and how the
// route hands an attached file to the chat service.
const chatServicePath = require.resolve("../services/chatService");
const seen = {};
require.cache[chatServicePath] = {
  id: chatServicePath, filename: chatServicePath, loaded: true,
  exports: {
    answerQuestion: async (question, sessionId, audience, profile, options) => {
      seen.options = options;
      return { answer: `ok:${options.document ? options.document.filename : "no-file"}`, queryType: {}, sources: [], resources: [], recommendedResources: [], timetableMatches: 0,
        document: options.document ? { filename: options.document.filename } : undefined };
    },
  },
};
const chatRoutes = require("../routes/chatRoutes");

function makePdf(lines) {
  return new Promise((resolve) => {
    const doc = new PDFDocument(); const chunks = [];
    doc.on("data", (c) => chunks.push(c)); doc.on("end", () => resolve(Buffer.concat(chunks)));
    lines.forEach((l) => doc.text(l)); doc.end();
  });
}

async function withServer(fn, user = null) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = user; next(); });
  app.use("/api/chat", chatRoutes);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  try { await fn(`http://127.0.0.1:${server.address().port}/api/chat`); } finally { server.close(); }
}

test("upload -> ask with documentId -> the chat service receives the file; other sessions are refused", async () => {
  const pdf = await makePdf(["Result slip", "Course BIT320 and BSPH121 were taken. Fee ZMW 100 due 1 March 2027."]);
  await withServer(async (base) => {
    const up = await fetch(`${base}/upload?filename=slip.pdf&sessionId=sess1`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: pdf });
    assert.equal(up.status, 201);
    const report = await up.json();
    assert.equal(report.filename, "slip.pdf");
    assert.equal(report.sessionId, "sess1");
    assert.ok(report.steps.length >= 2);
    assert.ok(report.suggestions.includes("Summarise this file"));
    assert.deepEqual(report.facts.courseCodes.map((c) => c.code).sort(), ["BIT320", "BSPH121"]);
    // visitors are not told anything about the timetable
    assert.ok(report.facts.courseCodes.every((c) => c.inTimetable === undefined));

    const ask = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "summarise", sessionId: "sess1", documentId: report.documentId }) });
    const body = await ask.json();
    assert.equal(body.answer, "ok:slip.pdf");
    assert.equal(body.document.filename, "slip.pdf");

    const other = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "summarise", sessionId: "other", documentId: report.documentId }) });
    const otherBody = await other.json();
    assert.equal(otherBody.documentExpired, true);

    const del = await fetch(`${base}/upload/${report.documentId}?sessionId=sess1`, { method: "DELETE" });
    assert.equal((await del.json()).removed, true);
  });
});

test("signed-in students get their course codes checked against the UNILUS timetable", async () => {
  const pdf = await makePdf(["Result slip", "Course BSPH121 and ZZZZ999 were mentioned in this slip."]);
  await withServer(async (base) => {
    const up = await fetch(`${base}/upload?filename=slip.pdf&sessionId=s2`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: pdf });
    const report = await up.json();
    const byCode = Object.fromEntries(report.facts.courseCodes.map((c) => [c.code, c]));
    assert.equal(byCode.BSPH121.inTimetable, true);
    assert.equal(byCode.ZZZZ999.inTimetable, false);
    assert.ok(report.steps.some((s) => /against the UNILUS timetable/.test(s.label)));
  }, { username: "demo" });
});

test("bad uploads return a readable error and /pdf returns a PDF", async () => {
  await withServer(async (base) => {
    const bad = await fetch(`${base}/upload?filename=pic.png`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: Buffer.from("x") });
    assert.equal(bad.status, 415);
    assert.match((await bad.json()).error, /PDF, Word/);

    const empty = await fetch(`${base}/pdf`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markdown: "" }) });
    assert.equal(empty.status, 400);

    const res = await fetch(`${base}/pdf`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Test answer", markdown: "## Hi\n\nHello", sources: ["Handbook (p. 1)"] }) });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/pdf");
    assert.match(res.headers.get("content-disposition"), /unilus-test-answer\.pdf/);
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
  });
});
