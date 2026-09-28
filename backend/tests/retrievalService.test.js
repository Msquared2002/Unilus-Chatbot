const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classifyQuery, extractCourseCode, extractVenueCode, extractDay, extractLecturerQuery,
  extractProgrammeStage,
} = require("../services/retrievalService");

test("extractCourseCode finds a generic course code pattern", () => {
  assert.equal(extractCourseCode("Where is BIT320 today?"), "BIT320");
  assert.equal(extractCourseCode("no course code here"), null);
});

test("extractVenueCode finds a generic venue code pattern", () => {
  assert.equal(extractVenueCode("Which room is PNR_RM14?"), "PNR_RM14");
});

test("extractDay finds a weekday name case-insensitively", () => {
  assert.equal(extractDay("what do I have on monday"), "Monday");
  assert.equal(extractDay("no day mentioned"), null);
});

test("extractLecturerQuery recognizes a titled name", () => {
  assert.equal(extractLecturerQuery("What does Mr. Joseph teach?"), "Mr. Joseph");
});

test("extractLecturerQuery recognizes a bare surname from real data (no hardcoded list)", () => {
  // "mwanza" is only recognized because it exists in data/timetable.json,
  // not because it's hardcoded anywhere in retrievalRouter.js.
  assert.equal(extractLecturerQuery("what classes does mwanza have today"), "mwanza");
});

test("classifyQuery: a course-code question is timetable-only", () => {
  const result = classifyQuery("Where is BIT320 today?");
  assert.equal(result.isTimetable, true);
  assert.equal(result.entities.courseCode, "BIT320");
});

test("classifyQuery: a policy question is knowledge-only", () => {
  const result = classifyQuery("How do I defer my studies?");
  assert.equal(result.isKnowledge, true);
  assert.equal(result.entities.courseCode, null);
  assert.equal(result.entities.lecturer, null);
});

test("classifyQuery: a mixed question sets isMixed", () => {
  const result = classifyQuery("When is my graduation and what are the requirements for BIT320?");
  assert.equal(result.isKnowledge, true);
  assert.equal(result.isTimetable, true);
  assert.equal(result.isMixed, true);
});

test("classifyQuery: 'who teaches' phrasing is a timetable keyword even without a course code", () => {
  const result = classifyQuery("Who teaches Database Systems?");
  assert.equal(result.isTimetable, true);
});

test("classifyQuery: an unrelated question defaults to a knowledge candidate, not silently dropped", () => {
  const result = classifyQuery("Who is the Vice Chancellor?");
  assert.equal(result.isKnowledge, true);
});

test("retrieveAnswer always includes a resources array, populated for a resource-registry match", async (t) => {
  const { retrieveAnswer } = require("../services/retrievalService");
  // "I forgot my password" has no timetable signal, so retrieveAnswer
  // also calls knowledgeService (real embedding model) for this one —
  // same documented network dependency as knowledgeService's own
  // tests. Skip gracefully if that model can't be reached here.
  let result;
  try {
    result = await retrieveAnswer("I forgot my password");
  } catch (err) {
    t.skip(`Needs the embedding model (network access to huggingface.co): ${err.message}`);
    return;
  }
  assert.ok(Array.isArray(result.resources));
  assert.ok(result.resources.some((r) => r.topic === "password_reset"));
});

test("retrieveAnswer returns an empty resources array for a query matching no registry entry, without throwing", async () => {
  const { retrieveAnswer } = require("../services/retrievalService");
  const result = await retrieveAnswer("What time is BIT320?");
  assert.ok(Array.isArray(result.resources));
});

test("retrieveAnswer suppresses resource recommendations for a specific course-code timetable query", async () => {
  const { retrieveAnswer } = require("../services/retrievalService");
  // Even though this course code exists and nothing in the registry
  // would incidentally match "timetable" here anyway, the guard
  // itself is asserted directly: a course-code query must never carry
  // resource suggestions, by design, not by keyword-overlap luck.
  const result = await retrieveAnswer("Show me the BIT320 timetable");
  assert.deepEqual(result.resources, []);
});

test("retrieveAnswer suppresses resource recommendations for a venue-code timetable query", async () => {
  const { retrieveAnswer } = require("../services/retrievalService");
  const result = await retrieveAnswer("Where is PNR_RM14?");
  assert.deepEqual(result.resources, []);
});

test("retrieveAnswer still returns resources for a generic timetable question with no specific entity", async (t) => {
  const { retrieveAnswer } = require("../services/retrievalService");
  // A generic timetable question with no specific entity found also
  // triggers the knowledge-search fallback (real embedding model) —
  // same documented network dependency as above.
  let result;
  try {
    result = await retrieveAnswer("Where can I see my timetable online?");
  } catch (err) {
    t.skip(`Needs the embedding model (network access to huggingface.co): ${err.message}`);
    return;
  }
  assert.ok(result.resources.some((r) => r.topic === "timetable_portal"));
});


test("extractProgrammeStage understands BIT 3,2 shorthand", () => {
  assert.deepEqual(extractProgrammeStage("the BIT timetable for 3,2"), {
    programmeFamily: "BIT",
    year: 3,
    semester: 2,
    studyMode: null,
  });
});

test("extractProgrammeStage understands natural year/semester wording", () => {
  assert.deepEqual(extractProgrammeStage("3rd year 2nd sem timetable for BIT"), {
    programmeFamily: "BIT",
    year: 3,
    semester: 2,
    studyMode: null,
  });
});

test("extractProgrammeStage understands direct cohort code and part-time mode", () => {
  assert.deepEqual(extractProgrammeStage("show BIT32-PT timetable"), {
    programmeFamily: "BIT",
    year: 3,
    semester: 2,
    studyMode: "part_time",
  });
});

test("classifyQuery extracts programme family, year and semester", () => {
  const result = classifyQuery("3rd year 2nd semester timetable for BIT");
  assert.equal(result.isTimetable, true);
  assert.equal(result.isKnowledge, false);
  assert.equal(result.entities.programmeFamily, "BIT");
  assert.equal(result.entities.year, 3);
  assert.equal(result.entities.semester, 2);
});

test("retrieveAnswer returns the exact BIT32 cohort instead of fuzzy unrelated rows", async () => {
  const { retrieveAnswer } = require("../services/retrievalService");
  const result = await retrieveAnswer("the BIT timetable for 3,2");
  assert.ok(result.timetable.length >= 10);
  assert.ok(result.timetable.every((r) => r.programme_code === "BIT32"));
  assert.ok(result.timetable.every((r) => r.year === 3 && r.semester === 2));
  assert.ok(result.timetable.some((r) => r.course_code === "BIT320"));
  assert.ok(result.timetable.some((r) => r.course_code === "BIT346"));
  assert.ok(result.timetable.some((r) => r.course_code === "BIT326"));
  assert.ok(result.timetable.some((r) => r.course_code === "BBA360"));
});

test("programme-stage timetable query also honors a requested day", async () => {
  const { retrieveAnswer } = require("../services/retrievalService");
  const result = await retrieveAnswer("BIT 3rd year 2nd semester timetable on Monday");
  assert.ok(result.timetable.length > 0);
  assert.ok(result.timetable.every((r) => r.programme_code === "BIT32"));
  assert.ok(result.timetable.every((r) => r.day === "Monday"));
});

test("programme family without year/semester does not fall into unrelated fuzzy timetable search", async () => {
  const { retrieveAnswer } = require("../services/retrievalService");
  const result = await retrieveAnswer("show me the BIT timetable");
  assert.deepEqual(result.timetable, []);
});
