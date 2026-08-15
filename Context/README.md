# UNILUS AI · Phase 1 Dummy Environment

This workspace contains the Phase 1 frontend foundation for the UNILUS AI Student Digital Companion. It uses only HTML5, CSS3, and Vanilla JavaScript ES6+.

## Clients

- `apps/website/index.html` — public website and Guest Digital Front Desk
- `apps/portal/index.html` — student portal demonstration
- `apps/elearning/index.html` — e-learning platform demonstration

Open `index.html` to choose a client. Because the clients use ES modules, serve this folder through a simple local static server when testing in a browser. No build step or framework is required.

## Boundaries

- All records are structured local fixtures in `packages/mock-data/fixtures.js`.
- Repository interfaces and local adapters live in `packages/repositories/repositories.js`.
- `packages/api-client/api-client.js` is a reserved future HTTP boundary and makes no network calls in Phase 1.
- No real authentication, credentials, backend services, live university data, Google Sheets, Supabase, AI, RAG, or vector search are used.
- Simulated identity, notices, timetable entries, course records, and scripted responses are visibly marked as demonstration content.

## Demo state verification

Append `?state=empty` or `?state=error` to any client URL to exercise the empty and error states. The default state is the successful local-fixture path.

Examples:

- `apps/website/index.html?state=empty#programmes`
- `apps/portal/index.html?state=error#dashboard`
- `apps/elearning/index.html?state=empty#calendar`

The implementation follows `architecture/implementation-handoff.md` and the approved frontend architecture references.
