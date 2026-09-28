const test = require("node:test");
const assert = require("node:assert/strict");
const { formatContext } = require("../services/chatService");

test("timetable context cleans display artifacts while preserving group labels, co-lecturers, and room capacity", () => {
  const context = formatContext({
    timetable: [{
      day: "Thursday",
      time: "15:00-16:00",
      course_code: "AFIN209",
      course_name: "C_TT_SVT Corporate Finance & Financial Modeling TUTORIAL GROUP C#100",
      session_type: "Tutorial",
      lecturer_name: "Mr. Kabwe B195 Mrs Lenganji Chela",
      venue_name: "SVT07_NB_ Silverest Lecture Room 07 Knowledge Field 2#192",
      venue_capacity: 242,
      programme_code: "BBA21",
      programme_name: "Bachelor of Business Administration 2nd Yr 1st Semester A1",
      year: 2,
      semester: 1,
    }],
    knowledge: [],
  });

  assert.match(context, /Corporate Finance & Financial Modeling Group C/);
  assert.match(context, /Mr\. Kabwe & Mrs Lenganji Chela/);
  assert.match(context, /Silverest Lecture Room 07 Knowledge Field 2/);
  assert.match(context, /room capacity 192/i);
  assert.doesNotMatch(context, /C_TT_SVT/);
  assert.doesNotMatch(context, /#100|#192|B195/);
  assert.doesNotMatch(context, /room capacity 242/i);
  assert.match(context, /Group A\/B\/C\/D labels are official/i);
});

test("timetable context harmonizes BIT346 C# title across lecture and tutorial rows", () => {
  const rows = [
    {
      day: "Monday", time: "10:00-12:00", course_code: "BIT346",
      course_name: "Business Web Development -Server Side with Visual Studio and C",
      lecturer_course_name: "Business Web Development -Server Side with Visual Studio and C#",
      student_course_name: "Business Web Development -Server Side with Visual Studio and C#",
      course_variant: "20", session_type: "Lecture", lecturer_name: "Mr Joseph Mwanza",
      venue_name: "Lecture Room 14", programme_code: "BIT32", programme_name: "Bachelor of Science in Information Systems and Technology 3rd Yr 2nd Semester A1",
      year: 3, semester: 2,
    },
    {
      day: "Wednesday", time: "10:00-11:00", course_code: "BIT346",
      course_name: "Business Web Development -Server Side with Visual Studio and C",
      lecturer_course_name: "Business Web Development -Server Side with Visual Studio and C TUTORIAL",
      student_course_name: "Business Web Development -Server Side with Visual Studio and C TUTORIAL",
      course_variant: "TT", session_type: "Tutorial", lecturer_name: "Mr Joseph Mwanza",
      venue_name: "Lecture Room 10", programme_code: "BIT32", programme_name: "Bachelor of Science in Information Systems and Technology 3rd Yr 2nd Semester A1",
      year: 3, semester: 2,
    },
  ];
  const context = formatContext({ timetable: rows, knowledge: [] });
  const matches = context.match(/Visual Studio and C#/g) || [];
  assert.equal(matches.length, 2);
  assert.doesNotMatch(context, /Visual Studio and C \[Tutorial\]/);
});
