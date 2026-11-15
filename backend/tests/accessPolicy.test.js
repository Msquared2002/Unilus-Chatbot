const test = require("node:test");
const assert = require("node:assert/strict");

const policy = require("../services/accessPolicy");
const { classifyQuery, retrieveAnswer } = require("../services/retrievalRouter");

const restricted = (q) => policy.isRestrictedTimetableRequest(q, classifyQuery(q).entities);

test("timetable questions are student-only, however they are worded", () => {
  for (const q of [
    "Show me the BIT320 timetable",
    "when is my BIT101 exam",
    "when is my BIT101 class",
    "what is the exam timetable",
    "where can I see the class timetable online",
    "who teaches BIT101",
    "what are my classes on Monday",
    "BIT 3rd year 2nd semester timetable",
    "What time is BIT320?",
  ]) assert.equal(restricted(q), true, q);
});

test("admissions, programme, policy and campus questions from a visitor are not blocked", () => {
  for (const q of [
    "when can I apply for first year BIT",
    "when is registration",
    "what are the admission requirements",
    "what is BIT320 about",
    "how do I defer my studies",
    "where is the library",
    "what time does the gym open",
    "gym timetable",
    "how much are the fees",
  ]) assert.equal(restricted(q), false, q);
});

test("pages and links marked student-only in the resource registry are hidden from visitors, not from students", () => {
  const chunk = (url) => ({ url, source_file: url, text: "x" });
  const knowledge = [chunk("https://web.unilus.ac.zm/calendars-and-time-tables/"), chunk("https://web.unilus.ac.zm/admissions/"), { source_file: "exam-timetable-bit-bcs-bscs.txt", text: "x" }, { source_file: "handbook.txt", text: "x" }];
  const restrictedFiles = new Set(["exam-timetable-bit-bcs-bscs.txt"]);

  const visitor = policy.filterKnowledge(knowledge, "public", restrictedFiles).map((c) => c.url || c.source_file);
  assert.deepEqual(visitor, ["https://web.unilus.ac.zm/admissions/", "handbook.txt"]);
  assert.equal(policy.filterKnowledge(knowledge, "student", restrictedFiles).length, 4);

  const links = [{ topic: "timetable_portal" }, { topic: "calendar_timetables" }, { topic: "sms_payment" }];
  assert.deepEqual(policy.filterResources(links, "public").map((r) => r.topic), ["calendar_timetables", "sms_payment"]);
  assert.equal(policy.filterResources(links, "student").length, 3);
});

test("a visitor's timetable question is refused before any search, so nothing from the timetable, documents or website is returned", async () => {
  for (const audience of ["public", undefined, "spoofed", "admin"]) {
    const result = await retrieveAnswer("Show me the BIT320 timetable", [], audience);
    assert.equal(result.accessDenied, "timetable", String(audience));
    assert.deepEqual([result.timetable, result.knowledge, result.resources], [[], [], []]);
  }
});

test("a signed-in student is not refused", async () => {
  const result = await retrieveAnswer("Show me the BIT320 timetable", [], "student");
  assert.equal(result.accessDenied, undefined);
  assert.ok(result.timetable.length > 0);
});
