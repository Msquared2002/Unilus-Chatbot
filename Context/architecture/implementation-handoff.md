# UNILUS AI - Implementation Handoff

**From:** Chief Software Architect

**To:** Senior Implementation Engineer

**Status:** Official Phase 1 handoff

**Scope:** Documentation and dummy frontend environment only. Do not implement
the production backend or real AI integrations in this phase.

## 1. Project overview

UNILUS AI is an AI-powered Student Digital Companion whose first role is the
University's Digital Front Desk. It should reduce repetitive enquiries while
continuing to support students throughout their academic journey.

### Problem

University information is distributed across the public website, student
portal, e-learning platform, documents, and physical offices. Students repeat
routine enquiries, increasing queues and administrative workload.

### Stakeholders

- Prospective students
- Current students
- Academic Office staff
- Registry
- Lecturers
- Future university administrators

### Objectives

- Reduce repetitive enquiries.
- Provide 24/7 access to official information.
- Centralize approved knowledge.
- Support authenticated student services in the future.
- Connect students with verified peer tutors in the future.
- Provide AI-assisted study support.

## 2. Current architectural state

### Approved decisions

- The product is a Student Digital Companion and Digital Front Desk.
- Guest Mode and Student Mode are separate.
- The chatbot must never store or process student passwords.
- University authentication remains the identity source of truth.
- One Node.js backend will serve multiple clients.
- Google Sheets is the initial structured data direction.
- RAG, LangChain, and vector search are technology directions for later
  backend work.
- Official information is preferred; uncertainty must be disclosed or
  escalated.
- The dummy website, portal, and e-learning environment must be built first
  at the lecturer's request.
- The approved frontend stack is HTML5, CSS3, and Vanilla JavaScript (ES6+).
- The frontend must use modular architecture, repositories, adapters,
  structured fixtures, responsive design, and accessibility practices.
- Demo data must not be represented as live university data.

### Pending decisions

- Exact backend framework and Node.js runtime conventions.
- API specification format and endpoint schemas.
- Frontend build tooling, if any, beyond the approved language stack.
- Authentication protocol and university integration mechanism.
- LLM and embedding providers.
- Vector database.
- Google Sheets access and synchronization model.
- Supabase/PostgreSQL migration decision.
- Hosting, deployment, monitoring, and secrets management.
- Privacy, retention, audit logging, and data governance.
- Knowledge approval and publishing workflow.

Do not resolve pending decisions independently.

### Prohibited assumptions

- Do not treat screenshots as backend specifications.
- Do not use real student credentials.
- Do not connect browser code directly to Google Sheets, databases, vector
  stores, or LLM providers.
- Do not assume that the portal and e-learning platform are the same system.
- Do not claim that demo data is live or official.
- Do not add speculative features.
- Do not introduce React, TypeScript, Vite, Supabase, a specific LLM, or a
  specific vector database without approval.

## 3. Technology stack

### Approved for Phase 1

- HTML5: semantic page structure.
- CSS3: styling, layout, responsive behaviour, and design tokens.
- Vanilla JavaScript ES6+: modular application behaviour and UI logic.

### Approved direction for later phases

- Node.js backend.
- Google Sheets as an initial structured data source.
- RAG, LangChain, and vector search.

### Intentionally excluded from Phase 1

- Production backend services.
- Real authentication.
- Real AI calls.
- Real Google Sheets access.
- Native mobile apps.
- Microservices.
- Direct browser data-source access.

## 4. Project structure

```text
context/
  architecture/       Approved architecture and handoff documents
  screenshots/         Visual references
  branding/            Approved branding references
  notes/               Supporting planning notes

apps/
  website/             Public UNILUS client
  portal/              Student portal client
  elearning/           E-learning client

packages/
  ui/                  Shared UI modules and patterns
  design-tokens/       Shared CSS variables and visual rules
  domain-models/       Stable domain names and record shapes
  repositories/        Data interfaces and mock implementations
  mock-data/           Structured demonstration records
  api-client/          Future HTTP adapter boundary
  validation/          Shared input and response validation

contracts/
  schemas/             Future API schemas
  examples/            Contract-compliant example payloads

server/
  src/                 Reserved for the future Node.js backend
```

The implementation engineer may adapt the physical layout for plain
HTML/CSS/JavaScript, but must preserve these responsibilities and boundaries.

## 5. Frontend architecture

Each client should contain semantic HTML pages, CSS modules/stylesheets, and
modular JavaScript. Shared patterns should be reusable without forcing the
three clients into identical layouts.

The data flow is:

```text
Page markup
  -> UI module/page controller
  -> application service
  -> repository interface
  -> local demo adapter now
  -> future HTTP adapter later
```

The public website should cover public university information. The portal
should demonstrate authenticated student workflows without real identity. The
e-learning client should demonstrate learning activity and calendar workflows.

## 6. Backend architecture to preserve

The future backend is a modular monolith with API, application, domain,
repository, and infrastructure layers. Logical boundaries include public
knowledge, conversations, student services, academic data, identity, peer
tutors, notifications, knowledge ingestion, and external integrations.

The AI must call backend application services. It must not access raw data
sources. Authentication must receive identity claims from the university and
must never receive or store passwords.

## 7. UI implementation principles

- Use semantic HTML elements and keyboard-accessible interactions.
- Keep page content separate from reusable presentation patterns.
- Use CSS variables for colours, spacing, typography, and breakpoints.
- Ensure layouts work on mobile, tablet, and desktop widths.
- Provide visible focus states and sufficient colour contrast.
- Use predictable URL routes and links between pages.
- Keep transient UI state separate from domain data.
- Keep assets organized by client and purpose.
- Use loading, empty, success, error, and unavailable states.
- Do not hide demo status where personal or AI-like content is displayed.

## 8. Dummy data strategy

Demo data must be structured with stable IDs and relationships. Suggested
records include programmes, fees, FAQs, announcements, courses, timetable
links, student profiles, and scripted conversation responses.

Fixtures must resemble future repository/API responses. When Google Sheets,
RAG, or university APIs are introduced, only the adapter and mapping layer
should change.

## 9. Strict implementation rules

- Do not redesign the architecture.
- Do not introduce technologies that are not approved.
- Do not hardcode values that belong in fixture data.
- Do not place application logic in HTML markup.
- Do not place data-source logic in UI modules.
- Do not use real credentials or sensitive student data.
- Do not invent official university facts.
- Do not implement speculative backend features.
- Do not silently change a repository, contract, or domain model.
- Keep the three clients visually consistent but functionally distinct.

## 10. Working procedure

For every assigned task:

1. Review the relevant `/context` documents.
2. Identify affected client, shared package, data model, and contract areas.
3. State the proposed implementation approach.
4. Implement only the approved scope.
5. Self-review for accessibility, responsiveness, maintainability, and
   separation of concerns.
6. Verify all affected client states.
7. Report changed files, behaviour, verification performed, and outstanding
   limitations.

## 11. Communication protocol

If implementation reveals a better approach or a conflict with this handoff:

1. Stop the affected work.
2. Explain the issue and its impact.
3. Present alternatives and trade-offs.
4. Recommend one option.
5. Wait for architectural approval.

Never silently replace the approved frontend stack, add a framework, change
the backend boundary, or introduce a new data source.

## 12. Phase 1 deliverables

### Current phase

Dummy UNILUS environment foundation and client interfaces.

### Expected deliverables

- Public website client shell and core pages.
- Student portal client shell and core dashboard pages.
- E-learning client shell and core dashboard pages.
- Shared UNILUS styling and reusable UI patterns.
- Modular Vanilla JavaScript structure.
- Structured demo fixtures.
- Repository interfaces with local adapters.
- Demonstration-only chatbot interaction states.

### Completion criteria

- All three clients are navigable.
- Layouts are responsive.
- Key interactions work without a backend.
- Data is loaded through repositories or services.
- No real credentials or live integrations are used.
- Demo content is clearly distinguishable from live data.
- The code can later replace demo adapters with backend API adapters without
  rewriting page markup.
