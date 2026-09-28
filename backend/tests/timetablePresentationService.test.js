const test = require("node:test");
const assert = require("node:assert/strict");
const {
  cleanCourseName,
  cleanLecturerName,
  cleanVenueName,
  extractRoomCapacity,
  inferSessionType,
  toDisplayTimetableEntry,
} = require("../services/timetablePresentationService");

test("removes Mimosa scheduling prefixes/count markers but preserves official course group labels", () => {
  assert.equal(
    cleanCourseName("C_TT_SVT Corporate Finance & Financial Modeling TUTORIAL GROUP C#100", "Tutorial"),
    "Corporate Finance & Financial Modeling Group C"
  );
  assert.equal(
    cleanCourseName("BUS#2_A Quantitave Methods Business Students GROUP A#250", "Lecture"),
    "Quantitative Methods Business Students Group A"
  );
  assert.equal(cleanCourseName("Human Resource Management#50", "Lecture"), "Human Resource Management");
});

test("normalizes flattened co-lecturer strings without deleting either lecturer", () => {
  assert.equal(
    cleanLecturerName("Mr. Kabwe B195 Mrs Lenganji Chela"),
    "Mr. Kabwe & Mrs Lenganji Chela"
  );
  assert.equal(
    cleanLecturerName("Mr. Ackim Ng'uni B189 Ms. Abigail Kawama"),
    "Mr. Ackim Ng'uni & Ms. Abigail Kawama"
  );
});

test("extracts room capacity from the trailing human-readable room marker", () => {
  assert.equal(extractRoomCapacity("Silverest Lecture Room 05 GROUND FLOOR BUSINESS BLOCK#192"), 192);
  assert.equal(extractRoomCapacity("PNR_RM02 Lecture Room 2 Pioneer Campus #99"), 99);
  assert.equal(extractRoomCapacity("Computer Room 17 @ Pioneer Campus Capacity #35"), 35);
  assert.equal(extractRoomCapacity("Virtual Class"), null);
});

test("cleans the visible venue while preserving capacity separately", () => {
  assert.equal(
    cleanVenueName("SVT07_NB_ Silverest Lecture Room 07 Knowledge Field 2#192"),
    "Silverest Lecture Room 07 Knowledge Field 2"
  );
  assert.equal(
    cleanVenueName("PNR_RM02 Lecture Room 2 Pioneer Campus #99"),
    "Lecture Room 2 Pioneer Campus"
  );
  assert.equal(
    cleanVenueName("PNR_RM17 Computer Room 17 @ Pioneer Campus Capacity #35"),
    "Computer Room 17 @ Pioneer Campus"
  );
});

test("infers tutorial display type from TT markers even when raw parser said Lecture", () => {
  assert.equal(inferSessionType({ course_name: "TT Group Studio ICT Projects", session_type: "Lecture" }), "Tutorial");
  assert.equal(inferSessionType({ course_name: "Systems Development and Implementation", session_type: "Lecture" }), "Lecture");
});

test("display conversion preserves raw fields and uses venue-label capacity over the misleading raw capacity field", () => {
  const raw = {
    course_name: "TT Group Studio ICT Projects#15",
    lecturer_name: "Mr Joseph Mwanza",
    venue_name: "SVT_BUS005 Silverest Lecture Room 05 GROUND FLOOR BUSINESS BLOCK#192",
    venue_capacity: 242,
    session_type: "Lecture",
  };
  const shown = toDisplayTimetableEntry(raw);
  assert.equal(shown.course_name, raw.course_name);
  assert.equal(shown.session_type, "Lecture");
  assert.equal(shown.venue_capacity, 242); // untouched raw provenance
  assert.equal(shown.display_course_name, "Group Studio ICT Projects");
  assert.equal(shown.display_session_type, "Tutorial");
  assert.equal(shown.display_venue_name, "Silverest Lecture Room 05 GROUND FLOOR BUSINESS BLOCK");
  assert.equal(shown.display_room_capacity, 192); // human-readable venue label is authoritative for display
});

test("prefers agreeing source course names when merge normalization dropped meaningful punctuation", () => {
  const raw = {
    course_code: "BIT346",
    course_name: "Business Web Development -Server Side with Visual Studio and C",
    lecturer_course_name: "Business Web Development -Server Side with Visual Studio and C#",
    student_course_name: "Business Web Development -Server Side with Visual Studio and C#",
    course_variant: "20",
    session_type: "Lecture",
  };
  const shown = toDisplayTimetableEntry(raw);
  assert.equal(
    shown.display_course_name,
    "Business Web Development - Server Side with Visual Studio and C#"
  );
});

test("source-agree display recovery still removes Mimosa scheduling/count markers", () => {
  const raw = {
    course_name: "Non-Communicable Diseases",
    lecturer_course_name: "Non-Communicable Diseases TT#25",
    student_course_name: "Non-Communicable Diseases TT#25",
    course_variant: "TT#25",
    session_type: "Lecture",
  };
  const shown = toDisplayTimetableEntry(raw);
  assert.equal(shown.display_course_name, "Non-Communicable Diseases");
  assert.equal(shown.display_session_type, "Tutorial");
});

test("harmonizes course titles that differ only because meaningful hash punctuation was lost", () => {
  const { harmonizeDisplayCourseNames } = require("../services/timetablePresentationService");
  const rows = harmonizeDisplayCourseNames([
    { course_code: "BIT346", display_course_name: "Business Web Development - Server Side with Visual Studio and C#" },
    { course_code: "BIT346", display_course_name: "Business Web Development - Server Side with Visual Studio and C" },
    { course_code: "AFIN209", display_course_name: "Corporate Finance Group A" },
    { course_code: "AFIN209", display_course_name: "Corporate Finance Group C" },
  ]);
  assert.equal(rows[0].display_course_name, "Business Web Development - Server Side with Visual Studio and C#");
  assert.equal(rows[1].display_course_name, "Business Web Development - Server Side with Visual Studio and C#");
  assert.equal(rows[2].display_course_name, "Corporate Finance Group A");
  assert.equal(rows[3].display_course_name, "Corporate Finance Group C");
});
