const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyDocumentType, deriveTitle, buildDocumentMetadata } = require("../services/documentIngestion/metadata");

test("classifies fee schedules generally, not by programme name", () => {
  assert.equal(classifyDocumentType("BACHELOR-OF-PHAMARCY-USD-FEES-UNILUS-2026.pdf"), "fee_schedule");
  assert.equal(classifyDocumentType("2025-LLM-FEES-FOREIGN.pdf"), "fee_schedule");
  assert.equal(classifyDocumentType("UNDERGRADUATE-FEES-ZMW.pdf"), "fee_schedule");
  // Crucially: a fee document for a programme NEVER seen before still classifies correctly.
  assert.equal(classifyDocumentType("BACHELOR-OF-QUANTUM-COMPUTING-FEES-2030.pdf"), "fee_schedule");
});

test("classifies forms, regulations, handbooks, prospectuses, notices", () => {
  assert.equal(classifyDocumentType("exemption-form.pdf"), "form");
  assert.equal(classifyDocumentType("PROGRAMME-DEFERMENT-FORM-28.05.25-1.pdf"), "form");
  assert.equal(
    classifyDocumentType("STUDENTS__CODE_OF_CONDUCT_AND_DISCIPLINARY_PROCEDURES-_JULY_2026.pdf"),
    "regulation"
  );
  assert.equal(classifyDocumentType("University-of-Lusaka-Student-Handbook.pdf"), "handbook");
  assert.equal(classifyDocumentType("UNILUS-PROSPECTUS-2026-11.pdf"), "prospectus");
  assert.equal(classifyDocumentType("news-letter-draft-january-to-june-2025-1.pdf"), "notice");
  assert.equal(classifyDocumentType("Guide-to-distance-learning.pdf"), "guide");
});

test("falls back to 'general' honestly instead of guessing", () => {
  assert.equal(classifyDocumentType("The-University-of-Lusaka-brings-research-to-life.pdf"), "general");
});

test("title prefers the document's own first heading over the filename", () => {
  const title = deriveTitle("2025-LLM-FEES-FOREIGN.pdf", "LLM Fees for Foreign Students");
  assert.equal(title, "LLM Fees for Foreign Students");
});

test("title falls back to a cleaned filename when no heading was found", () => {
  const title = deriveTitle("2025-LLM-FEES-FOREIGN.pdf", null);
  assert.equal(title, "2025 LLM FEES FOREIGN");
});

test("buildDocumentMetadata never leaves source_file or document_type empty", () => {
  const meta = buildDocumentMetadata({ filename: "exemption-form.pdf" });
  assert.equal(meta.source_file, "exemption-form.pdf");
  assert.equal(meta.document_type, "form");
  assert.equal(meta.department, null); // honest, not fabricated
  assert.ok(meta.created_date);
});

test("noisy PDF page markers and generic UNILUS headings fall back to the informative filename", () => {
  assert.equal(
    deriveTitle("University-of-Lusaka-Student-Handbook.pdf", "-- 1 of 140 --"),
    "University of Lusaka Student Handbook"
  );
  assert.equal(
    deriveTitle("BACHELOR-OF-PHARMACY-ZMW-UNILUS-20266.pdf", "UNIVERSITY OF LUSAKA"),
    "BACHELOR OF PHARMACY ZMW UNILUS 20266"
  );
});

test("metadata extracts retrieval clues from a generic programme fee document", () => {
  const meta = buildDocumentMetadata({
    filename: "BACHELOR-OF-PHARMACY-ZMW-UNILUS-20266.pdf",
    firstHeading: "UNIVERSITY OF LUSAKA",
    firstFewLines: "BACHELOR OF PHARMACY 2026 FEE SCHEDULE FOR LOCAL AND SADC STUDENTS - ZMW",
  });

  assert.equal(meta.document_type, "fee_schedule");
  assert.equal(meta.programme, "Bachelor Of Pharmacy");
  assert.equal(meta.academic_year, 2026);
  assert.equal(meta.currency, "ZMW");
  assert.deepEqual(meta.audience, ["local", "SADC"]);
  assert.match(meta.retrieval_title, /Pharmacy/);
  assert.match(meta.retrieval_title, /Fee Schedule/);
});

test("a prospectus does not get incorrectly labelled as one programme just because its contents list programmes", () => {
  const meta = buildDocumentMetadata({
    filename: "UNILUS-PROSPECTUS-2026-11.pdf",
    firstHeading: "2",
    firstFewLines: "Programmes on offer Bachelor of Science in Public Health Bachelor of Science in Nursing Bachelor of Pharmacy",
  });
  assert.equal(meta.programme, null);
  assert.equal(meta.title, "UNILUS PROSPECTUS 2026 11");
});

test("Non-SADC audience is treated as foreign and not SADC", () => {
  const { extractAudience } = require("../services/documentIngestion/metadata");
  assert.deepEqual(extractAudience("Undergraduate Programs - Non-SADC Students"), ["foreign"]);
});

test("document-level audience prefers the source label over incidental body mentions", () => {
  const meta = buildDocumentMetadata({
    filename: "2025-LLM-FEES-LOCAL-AND-SADC.pdf",
    firstHeading: "UNIVERSITY OF LUSAKA",
    firstFewLines: "Local fees. Foreign students should consult the separate foreign schedule.",
  });
  assert.deepEqual(meta.audience, ["local", "SADC"]);
});

test("fee scope distinguishes programme tuition from accommodation", () => {
  const { extractFeeScope } = require("../services/documentIngestion/metadata");
  assert.equal(extractFeeScope({
    filename: "BACHELOR-OF-PHARMACY-ZMW-FEES-UNILUS-2026.pdf",
    documentType: "fee_schedule",
    programme: "Bachelor of Pharmacy",
  }), "programme_tuition");

  assert.equal(extractFeeScope({
    filename: "ACCOMMODATION-FEES-REVISED-2026-JUNE-3.pdf",
    documentType: "fee_schedule",
  }), "accommodation");
});

test("generic undergraduate fee tables do not inherit one programme from a body row", () => {
  const meta = buildDocumentMetadata({
    filename: "UNDERGRADUATE-FEES-ZMW.pdf",
    firstHeading: "UNIVERSITY OF LUSAKA",
    firstFewLines: "Bachelor of Science in Public Health 14,950 16,750 General Fees ZMW",
  });
  assert.equal(meta.document_type, "fee_schedule");
  assert.equal(meta.programme, null);
});

test("year-prefixed programme fee filenames are still recognized as programme-specific", () => {
  const meta = buildDocumentMetadata({
    filename: "2025-LLM-FEES-LOCAL-AND-SADC.pdf",
    firstHeading: "UNIVERSITY OF LUSAKA",
    firstFewLines: "LLM FEE SCHEDULE FOR LOCAL AND SADC STUDENTS",
  });
  assert.equal(meta.programme, "Llm");
});
