# UNILUS AI - Implementation Roadmap

**Status:** Approved delivery order; detailed phase estimates pending

## Phase 0 - Architecture baseline

### Deliverables

- Approved frontend stack decision
- Frontend-first architecture
- Backend direction
- API contract strategy
- Implementation handoff

### Completion criteria

All approved decisions are recorded in `/context/architecture/` and no
implementation begins against an undocumented architecture.

## Phase 1 - Dummy environment foundation

### Deliverables

- HTML5/CSS3/Vanilla JavaScript workspace
- Public website, portal, and e-learning application shells
- Shared CSS design tokens and reusable UI patterns
- Modular JavaScript structure
- Repository interfaces and local demo adapters
- Structured fixture data
- Explicit demo-mode states

### Dependencies

Approved frontend stack and supplied visual references.

### Completion criteria

All three clients load independently, share consistent UNILUS branding, and
display loading, empty, success, and error states using demo data.

## Phase 2 - Public website

### Deliverables

Home, admissions, programmes, fees, campus information, news, FAQs, contact
information, and the Guest Digital Front Desk entry point.

### Completion criteria

Responsive, accessible, navigable, and visually aligned with the approved
reference material.

## Phase 3 - Student portal

### Deliverables

Demo login screen, student dashboard, notices, timetable links, registration
shortcuts, and portal navigation.

### Completion criteria

No real credentials are collected. Student data is clearly demo data and is
loaded through repositories rather than page-level hardcoding.

## Phase 4 - E-learning platform

### Deliverables

Dashboard, courses, calendar, announcements, upcoming activities, and demo
learner profile.

### Completion criteria

The LMS has its own information hierarchy while reusing approved shared
branding and accessibility patterns.

## Phase 5 - Companion demonstration

### Deliverables

Chat interface, suggested prompts, scripted demo responses, citation states,
and escalation states.

### Completion criteria

Users can demonstrate the intended companion experience without the frontend
claiming that responses are live AI or live university data.

## Phase 6 - Backend foundation

### Deliverables

Node.js modular monolith, approved API contracts, application services,
repository interfaces, health checks, and public-content endpoints.

## Phase 7 - Knowledge and RAG

### Deliverables

Source ingestion, handbook processing, retrieval, vector search, citations,
confidence handling, and escalation.

## Phase 8 - Student integration

### Deliverables

University authentication integration, student-specific services, portal/LMS
integration boundaries, graceful degradation, and PWA support.

## Implementation gate

No phase may introduce a new framework, provider, database, authentication
mechanism, or deployment platform without an approved architecture decision.
