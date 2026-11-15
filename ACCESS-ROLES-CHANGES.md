# Role-based access: visitors no longer get timetable content

Extract over the project (same as before), then restart the backend:

    Expand-Archive -Path .\access-roles-update.zip -DestinationPath . -Force
    cd backend
    npm start

NOTE: backend/services/chatService.js in this zip also contains the file-upload/PDF change from the last update
(it needs uploadService.js and pdfService.js from that update, so install that one first if you have not).

## What was wrong
Timetable lookups were already blocked for visitors, but the "please sign in" reply only fired when the search found
NOTHING else. A visitor's timetable question still matched two things that were marked for everyone:
  - the crawled website page "Calendars and Time Tables" (web.unilus.ac.zm/calendars-and-time-tables), and
  - the "Timetable Portal" / "Calendars and Time Tables" links in data/resources/resources.json ("audience": ["all"]).
With either of those found, the sign-in check was skipped and the model answered from the public page.
Only ONE file name (exam-timetable-bit-bcs-bscs.txt) was ever treated as student-only.

## What the project document says (the rule applied)
- Visitor: admissions and programmes, official links, campus map, voice, escalate to staff, track a ticket, give feedback.
- Student (signed in): everything a visitor can do, plus timetables and policies (FR2: timetable lookup, actor Student).
- Staff: tickets, knowledge, statistics, after signing in.
- A request that only CLAIMS to be a student, with no valid token, is treated as a visitor (unchanged).

## What changed
1. NEW backend/services/accessPolicy.js: one place for the role rules.
   - isRestrictedTimetableRequest(): a class/exam timetable request is recognised by plain phrases ("timetable", "my classes",
     "who teaches", "exam date"...) or by a course code / lecturer / programme year together with a timetable-style word.
     A course code alone ("what is BIT320 about?"), admissions questions ("when can I apply...") and campus facility
     timetables (gym, pool, hospital...) are NOT blocked.
   - Student-only websites/links are now data-driven: add  "access": "student"  (hide link AND page text) or
     "content_access": "student"  (hide only the crawled page text, keep the link) to an entry in resources.json.
2. retrievalRouter.js: before ANY search, a visitor's timetable request returns nothing (no timetable, no documents, no website text,
   no links) and sets accessDenied. The old file-name filter and the resource filter now go through accessPolicy.
3. chatService.js: accessDenied produces the sign-in reply ("Class and exam timetables are available to signed-in students...") and the
   AI model is not called. The older catch-all is kept.
4. resources.json: Timetable Portal = "access": "student"; Calendars and Time Tables = "content_access": "student".
5. evaluate.js + test-questions.csv: new expected outcome  signin  (rows 006, 009 changed from "yes"; rows 010-012 added).
   Visitors are now told to sign in rather than getting a ticket for these questions.
6. Tests: tests/accessPolicy.test.js, tests/chatAccess.test.js (new); one old test in retrievalService.test.js asserted that a VISITOR gets the
   timetable-portal link, which is the behaviour the document does not allow, so it now checks the student gets it and the visitor does not.

## Choices for you (I did not guess these)
- The "Calendars and Time Tables" page text is hidden from visitors, so they cannot get semester dates from the crawled page either.
  The link to that page is still offered to visitors. If visitors should get semester dates, remove "content_access" from that entry.
- Policies: the document says students "ask about timetables and policies" and visitors "admissions and programmes", but handbook.txt and
  deferment-policy.txt are currently open to visitors (admissions answers probably come from the same handbook). I left them open.
  To make a document student-only, add  "access": "restricted"  to its .meta.json sidecar (already supported). Tell me which documents should be restricted.

## Tested here
New tests pass (visitor refused before any search; model not called; the public timetable page never reaches the model; admissions
questions still answered; students unaffected). Whole backend suite: no new failures compared with your original zip
(the same 13 tests that need your vector index / embedding model still fail without them).
NOT tested here: a real Groq answer, and your real crawled index (it is not in the zip), so please ask the same visitor question again.
