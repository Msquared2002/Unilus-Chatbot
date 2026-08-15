# UNILUS AI - Approved Frontend Stack Decision

**Status:** Approved

**Decision date:** 2026-08-15

## Decision

The UNILUS AI dummy environment will use:

- HTML5 for page structure and semantic content
- CSS3 for styling, layout, responsiveness, and design tokens
- Vanilla JavaScript (ES6+) for behaviour, application logic, routing helpers,
  data access, and UI composition

This decision applies to the public website, student portal, and e-learning
platform demonstration clients.

## Rationale

The lecturer requires the dummy UNILUS environment as the first deliverable.
The selected stack:

- matches the project's educational and demonstration context;
- keeps the first deliverable lightweight and easy to explain;
- avoids introducing framework complexity before it is justified;
- remains compatible with a future Node.js backend;
- allows professional architecture through modular JavaScript and clear
  boundaries rather than framework dependence.

This is not permission to build an unstructured static website. The frontend
must still apply separation of concerns, reusable components where practical,
repository and adapter patterns, API-first thinking, accessibility, and
responsive design.

## Required architectural constraints

- Page markup must not contain data-source or backend integration logic.
- JavaScript modules must separate UI, application services, repositories, and
  data adapters.
- Demo data must live in structured fixture files or mock repositories.
- Future API responses must be representable by the same domain models used by
  demo fixtures.
- Browser code must never connect directly to Google Sheets, vector stores,
  databases, or LLM providers.
- No production credentials or student passwords may be placed in frontend
  files.

## Not approved by this decision

This decision does not approve or reject the following items:

- React, Vue, Angular, TypeScript, or Vite;
- Supabase or PostgreSQL;
- Gemini, Groq, OpenAI, or another LLM provider;
- a vector database or embedding provider;
- hosting, authentication protocol, or deployment platform.

These require separate architectural decisions. They must not be introduced
by the implementation engineer without approval.
