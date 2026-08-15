# UNILUS AI - Frontend-First Architecture

**Status:** Approved for Phase 1 implementation

## Purpose

The dummy UNILUS environment is the first project deliverable. It must be
implemented first without becoming throwaway code.

The frontend is therefore treated as a real client with replaceable data
adapters. The initial adapter returns local demo data; a later adapter will
call the Node.js backend.

## Client applications

The repository will contain three distinct client experiences:

### Public website

The guest-facing university site covers admissions, programmes, fees, campus
information, news, FAQs, contacts, and the Guest Digital Front Desk entry
point.

### Student portal

The portal demonstration covers the authenticated student dashboard, notices,
timetable links, registration-related shortcuts, and student navigation. The
login screen is a visual demonstration only. It must not collect or validate
real university credentials.

### E-learning platform

The e-learning demonstration covers the LMS dashboard, courses, calendar,
announcements, upcoming activities, and a demo learner profile. It remains a
separate client experience because its navigation and information hierarchy
are different from the portal.

## Frontend layers

```text
HTML pages and semantic UI
        |
Reusable UI modules and page controllers
        |
Application services and state helpers
        |
Repository interfaces
        |
Demo adapters now; HTTP adapters later
```

### Presentation layer

Contains semantic HTML, accessible controls, layouts, reusable CSS classes,
and UI modules. It may render data and dispatch user actions, but it must not
know whether data came from a JSON fixture, an API, or a future university
system.

### Application layer

Coordinates user actions such as loading programmes, submitting a chat
question, loading announcements, or opening a timetable. It translates
repository results into view-ready state.

### Repository layer

Defines stable interfaces such as:

- `ProgrammeRepository`
- `FaqRepository`
- `AnnouncementRepository`
- `StudentRepository`
- `TimetableRepository`
- `CourseRepository`
- `ConversationRepository`

The initial implementations are local demo repositories. Future
implementations will use the backend API.

### Fixture and adapter layer

Fixtures contain structured demo records. Adapters provide loading, success,
empty, and failure states so the UI is exercised against realistic conditions.

## Avoiding throwaway code

- Use stable domain names and identifiers in demo data.
- Keep content out of JavaScript page controllers where it belongs in data.
- Keep fetch or transport logic out of UI modules.
- Use the same response shapes for mock and future API adapters.
- Represent demo/live state explicitly in returned data.
- Include realistic loading, empty, error, and unavailable states.
- Do not use mock data to hide missing product decisions.

## Styling and assets

UNILUS colours, crest usage, typography, spacing, breakpoints, and reusable
visual patterns must be centralized in CSS files. Supplied screenshots are
visual references, not executable specifications.

Assets must be grouped by purpose and referenced through stable paths. The
implementation must not copy proprietary assets beyond what is necessary for
the approved demonstration environment.

## Demo-mode boundary

Any simulated student identity, notice, timetable, announcement, or AI answer
must be clearly treated as demonstration data. The frontend must not imply
that a simulated response is live university information.
