const test = require("node:test");
const assert = require("node:assert/strict");
const { formatContext, orderKnowledgeBySourcePriority } = require("../services/chatService");

test("formats timetable-only context with canonical fields", () => {
  const context = formatContext({
    timetable: [
      {
        day: "Monday",
        time: "08:00-10:00",
        course_code: "BIT320",
        course_name: "Systems Development",
        lecturer_name: "Mr. Joseph Mwanza",
        venue_name: "Lecture Room 14",
        programme_code: "BIT32",
      },
    ],
    knowledge: [],
  });

  assert.match(context, /Timetable information/);
  assert.match(context, /BIT320/);
  assert.match(context, /Mr\. Joseph Mwanza/);
  assert.doesNotMatch(context, /University knowledge/);
});

test("formats knowledge-only context with source citation", () => {
  const context = formatContext({
    timetable: [],
    knowledge: [
      {
        text: "Students may defer for up to one year.",
        title: "Deferment Policy",
        source_file: "regulations.pdf",
        page_number: 12,
      },
    ],
  });

  assert.match(context, /University knowledge/);
  assert.match(context, /Deferment Policy, p\.12/);
  assert.match(context, /defer for up to one year/);
});

test("formats a mixed query with both timetable and knowledge sections present", () => {
  const context = formatContext({
    timetable: [
      { day: "Monday", time: "08:00-10:00", course_code: "BIT320", course_name: "Systems Development" },
    ],
    knowledge: [
      { text: "Graduation requires 120 credits.", title: "Graduation Requirements", source_file: "handbook.pdf", page_number: 40 },
    ],
  });

  assert.match(context, /Timetable information/);
  assert.match(context, /University knowledge/);
});

test("returns an empty string, not a crash, when there is nothing to show", () => {
  const context = formatContext({ timetable: [], knowledge: [] });
  assert.equal(context, "");
});

test("formats resource links into context with an instruction to include them", () => {
  const context = formatContext({
    timetable: [],
    knowledge: [],
    resources: [{ title: "Student Portal Password Recovery", url: "https://portal.unilus.ac.zm/password/recover", topic: "password_reset" }],
  });

  assert.match(context, /Official resources/);
  assert.match(context, /Student Portal Password Recovery: https:\/\/portal\.unilus\.ac\.zm\/password\/recover/);
});

test("combines timetable, knowledge, and resources together when all three are present", () => {
  const context = formatContext({
    timetable: [{ day: "Monday", time: "08:00-10:00", course_code: "BIT320", course_name: "Systems Development" }],
    knowledge: [{ text: "Graduation requires 120 credits.", title: "Graduation Requirements", source_file: "handbook.pdf", page_number: 40 }],
    resources: [{ title: "Academic Calendar", url: "https://web.unilus.ac.zm/calendars-and-time-tables/", topic: "calendar_timetables" }],
  });

  assert.match(context, /Timetable information/);
  assert.match(context, /University knowledge/);
  assert.match(context, /Official resources/);
});

test("formatContext works when resources is omitted entirely (backward compatible)", () => {
  const context = formatContext({ timetable: [], knowledge: [{ text: "x", title: "T", source_file: "f.pdf" }] });
  assert.match(context, /University knowledge/);
  assert.doesNotMatch(context, /Official resources/);
});

test("orderKnowledgeBySourcePriority puts structured/PDF chunks before website chunks", () => {
  const { orderKnowledgeBySourcePriority } = require("../services/chatService");
  const chunks = [
    { text: "website content", document_type: "website" },
    { text: "handbook content", document_type: "handbook" },
    { text: "another website chunk", document_type: "website" },
    { text: "fee schedule content", document_type: "fee_schedule" },
  ];

  const ordered = orderKnowledgeBySourcePriority(chunks);
  const documentTypes = ordered.map((c) => c.document_type);

  assert.deepEqual(documentTypes, ["handbook", "fee_schedule", "website", "website"]);
});

test("orderKnowledgeBySourcePriority preserves relative order within each group (stable sort)", () => {
  const { orderKnowledgeBySourcePriority } = require("../services/chatService");
  const chunks = [
    { text: "handbook 1", document_type: "handbook" },
    { text: "handbook 2", document_type: "regulation" },
    { text: "website 1", document_type: "website" },
  ];
  const ordered = orderKnowledgeBySourcePriority(chunks);
  assert.equal(ordered[0].text, "handbook 1");
  assert.equal(ordered[1].text, "handbook 2");
  assert.equal(ordered[2].text, "website 1");
});

test("buildRecommendedResources produces a title/url/reason shape derived from matched keywords", () => {
  const { buildRecommendedResources } = require("../services/chatService");
  const recommended = buildRecommendedResources([
    {
      title: "Student Portal Password Recovery",
      url: "https://portal.unilus.ac.zm/password/recover",
      category: "Password Recovery",
      matchedKeywords: ["forgot password"],
    },
  ]);

  assert.equal(recommended.length, 1);
  assert.equal(recommended[0].title, "Student Portal Password Recovery");
  assert.equal(recommended[0].url, "https://portal.unilus.ac.zm/password/recover");
  assert.match(recommended[0].reason, /forgot password/);
});

test("buildRecommendedResources falls back to a category-based reason with no matched keywords", () => {
  const { buildRecommendedResources } = require("../services/chatService");
  const recommended = buildRecommendedResources([
    { title: "Careers", url: "https://web.unilus.ac.zm/careers/", category: "Careers", matchedKeywords: [] },
  ]);
  assert.match(recommended[0].reason, /Careers/);
});

test("source priority does not demote a clearly more relevant website result", () => {
  const chunks = [
    { id: "pdf", document_type: "handbook", score: 0.03 },
    { id: "web", document_type: "website", score: 0.08 },
  ];
  const ordered = orderKnowledgeBySourcePriority(chunks);
  assert.equal(ordered[0].id, "web");
});

test("knowledge context exposes the exact source URL to the answer model", () => {
  const context = formatContext({
    timetable: [],
    knowledge: [{
      text: "Submit certified documents.",
      title: "Online Application Guide",
      source_file: "https://web.unilus.ac.zm/apply-online/",
      document_type: "website",
    }],
  });
  assert.match(context, /Source: https:\/\/web\.unilus\.ac\.zm\/apply-online\//);
});

test("collectAllowedUrls only includes explicit URL-bearing evidence/resources", () => {
  const { collectAllowedUrls } = require("../services/chatService");
  const urls = collectAllowedUrls({
    knowledge: [
      { source_file: "handbook.pdf" },
      { source_file: "https://web.unilus.ac.zm/apply-online/" },
    ],
    resources: [
      { url: "https://portal.unilus.ac.zm/password/recover" },
    ],
  });
  assert.deepEqual(urls.sort(), [
    "https://portal.unilus.ac.zm/password/recover",
    "https://web.unilus.ac.zm/apply-online/",
  ].sort());
});

test("revised fee PDF becomes PRIMARY and same-scope website becomes SUPPORTING", () => {
  const { annotateKnowledgeEvidence } = require("../services/chatService");
  const chunks = [
    {
      id: "pdf",
      text: "Ordinary Six 6,300.00",
      retrieval_title: "ACCOMMODATION FEES REVISED 2026 JUNE 3",
      source_file: "ACCOMMODATION-FEES-REVISED-2026-JUNE-3.pdf",
      document_type: "fee_schedule",
      fee_scope: "accommodation",
      academic_year: 2026,
      audience: ["local", "foreign"],
    },
    {
      id: "web",
      text: "Ordinary six K7,300.00",
      source_file: "https://web.unilus.ac.zm/accomodation/",
      document_type: "website",
      fee_scope: "accommodation",
      academic_year: 2026,
      audience: ["foreign"],
    },
  ];
  const annotated = annotateKnowledgeEvidence(chunks);
  assert.equal(annotated[0].evidence_role, "primary");
  assert.equal(annotated[1].evidence_role, "supporting");
});

test("primary grounding text excludes conflicting supporting website amounts", () => {
  const { buildPrimaryGroundingText } = require("../services/chatService");
  const text = buildPrimaryGroundingText([
    {
      text: "REVISED Ordinary Six 6,300.00",
      retrieval_title: "REVISED ACCOMMODATION FEES 2026",
      document_type: "fee_schedule",
      fee_scope: "accommodation",
      academic_year: 2026,
      audience: ["local", "foreign"],
    },
    {
      text: "Ordinary six K7,300.00",
      document_type: "website",
      fee_scope: "accommodation",
      academic_year: 2026,
      audience: ["foreign"],
    },
  ]);
  assert.match(text, /6,300/);
  assert.doesNotMatch(text, /7,300/);
});

test("knowledge context explicitly marks revised evidence precedence", () => {
  const context = formatContext({
    timetable: [],
    knowledge: [
      {
        text: "REVISED Ordinary Six 6,300.00",
        retrieval_title: "REVISED ACCOMMODATION FEES 2026",
        document_type: "fee_schedule",
        fee_scope: "accommodation",
        academic_year: 2026,
      },
      {
        text: "Ordinary six K7,300.00",
        source_file: "https://web.unilus.ac.zm/accomodation/",
        document_type: "website",
        fee_scope: "accommodation",
        academic_year: 2026,
      },
    ],
  });
  assert.match(context, /PRIMARY evidence controls/i);
  assert.match(context, /Evidence role: PRIMARY/i);
  assert.match(context, /Evidence role: SUPPORTING/i);
});


test("programme timetable context includes the complete cohort rather than truncating at eight rows", () => {
  const timetable = Array.from({ length: 11 }, (_, i) => ({
    day: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][i % 5],
    time: `${String(8 + (i % 4) * 2).padStart(2, "0")}:00-${String(10 + (i % 4) * 2).padStart(2, "0")}:00`,
    course_code: `BIT3${String(i).padStart(2, "0")}`,
    course_name: `Course ${i + 1}`,
    lecturer_name: `Lecturer ${i + 1}`,
    venue_name: `Room ${i + 1}`,
    programme_code: "BIT32",
    programme_name: "Bachelor of Science in Information Systems and Technology 3rd Yr 2nd Semester A1",
    year: 3,
    semester: 2,
    session_type: "Lecture",
  }));

  const context = formatContext({ timetable, knowledge: [] });
  assert.match(context, /Cohort: .*BIT32.*year 3.*semester 2/i);
  assert.match(context, /Course 11/);
  assert.doesNotMatch(context, /additional timetable entries were omitted/i);
});


test("incomplete programme timetable request asks for year and semester deterministically", async () => {
  const { answerQuestion } = require("../services/chatService");
  const result = await answerQuestion("show me the BIT timetable");
  assert.match(result.answer, /need the study year and semester/i);
  assert.equal(result.timetableMatches, 0);
});
