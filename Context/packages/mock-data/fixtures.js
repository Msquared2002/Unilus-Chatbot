export const demoProfile = {
  id: "student-demo-001",
  name: "Thandiwe Banda",
  programme: "Bachelor of Business Administration",
  year: "Year 2",
  studentNumber: "DEMO-2026-0142",
  email: "demo.student@example.invalid",
  status: "Demonstration profile"
};

export const programmes = [
  { id: "programme-bba", name: "Bachelor of Business Administration", school: "School of Business", duration: "4 years", mode: "Full-time" },
  { id: "programme-bsc-cs", name: "Bachelor of Science in Computer Science", school: "School of Computing", duration: "4 years", mode: "Full-time" },
  { id: "programme-llb", name: "Bachelor of Laws", school: "School of Law", duration: "4 years", mode: "Full-time" },
  { id: "programme-bpharm", name: "Bachelor of Pharmacy", school: "School of Health Sciences", duration: "5 years", mode: "Full-time" }
];

export const faqs = [
  { id: "faq-application", question: "How do I begin an application?", answer: "Start with the admissions information page, review the programme requirements, and use the university's approved admissions channel for the next step.", category: "Admissions" },
  { id: "faq-fees", question: "Where can I find fee information?", answer: "Fee information is presented here as demonstration content. Confirm current amounts with the Academic Office before making a decision.", category: "Fees" },
  { id: "faq-support", question: "Where can I get student support?", answer: "The Academic Office and Registry are the appropriate escalation points for official student support questions.", category: "Student support" }
];

export const announcements = [
  { id: "announcement-orientation", title: "Orientation week information", date: "2026-08-24", category: "Student life", summary: "Review the orientation schedule and bring your student identification when attending on-campus sessions." },
  { id: "announcement-library", title: "Library services demonstration", date: "2026-08-18", category: "Services", summary: "Library opening hours and support links are shown here as local demonstration content." },
  { id: "announcement-registration", title: "Registration support window", date: "2026-08-17", category: "Academic", summary: "Use the portal shortcut to see the kind of registration support flow planned for a future integration." }
];

export const timetable = [
  { id: "slot-mon-0900", day: "Monday", time: "09:00–10:30", course: "Business Communication", room: "Demo Room A" },
  { id: "slot-tue-1100", day: "Tuesday", time: "11:00–12:30", course: "Principles of Marketing", room: "Demo Room C" },
  { id: "slot-wed-1400", day: "Wednesday", time: "14:00–15:30", course: "Introduction to Financial Management", room: "Demo Room B" },
  { id: "slot-thu-1000", day: "Thursday", time: "10:00–11:30", course: "Business Information Systems", room: "Online · Demo link" }
];

export const courses = [
  { id: "course-bus-201", code: "BUS 201", name: "Business Communication", tutor: "Demo tutor", progress: 72, colour: "blue", next: "Reading: communication models" },
  { id: "course-mkt-204", code: "MKT 204", name: "Principles of Marketing", tutor: "Demo tutor", progress: 54, colour: "gold", next: "Quiz 3 · Customer insight" },
  { id: "course-fin-202", code: "FIN 202", name: "Financial Management", tutor: "Demo tutor", progress: 38, colour: "green", next: "Assignment brief" }
];

export const activities = [
  { id: "activity-quiz", title: "Quiz 3 · Customer insight", course: "MKT 204", due: "Tomorrow", type: "Quiz" },
  { id: "activity-reading", title: "Reading · Communication models", course: "BUS 201", due: "18 Aug 2026", type: "Reading" },
  { id: "activity-assignment", title: "Assignment brief review", course: "FIN 202", due: "21 Aug 2026", type: "Assignment" }
];

export const conversationResponses = [
  { id: "conversation-admissions", keywords: ["admission", "apply", "application"], answer: "This is a scripted demonstration response. Review the Admissions page and confirm current requirements with the university before applying.", citation: "Demo source · Admissions fixture" },
  { id: "conversation-fees", keywords: ["fee", "fees", "cost", "tuition"], answer: "Fee information in this environment is demonstration content and may not reflect current university charges. Please verify with the Academic Office.", citation: "Demo source · Fees fixture" },
  { id: "conversation-help", keywords: ["help", "support", "contact"], answer: "I can point you toward admissions, programmes, fees, FAQs, or contact information in this demonstration environment.", citation: "Demo source · Scripted response" }
];
