# Phase 2 — personalized Student Mode

> **Phase2 local implementation — 2026-11-11:** [Implementation, exact source delta, fresh440/146 tests and limitations](17_PHASE_2_IMPLEMENTATION.md). Personalized StudentMode is implemented locally. Manual browser/visual acceptance is intentionally deferred until the consolidated seven-phase stage. Historical audit/Phase1 evidence below remains dated; no production release is implied.


Audit: **2026-11-10, Africa/Lusaka**. Local HEAD `9cbdeb0517da8820b94a623d9b8facbef50ae1ee`, branch `codex/production-integration`, **with pre-existing uncommitted unified-notification work**. Source findings describe that working tree unless explicitly marked production. Documentation only; no implementation/release authorized. [Master](00_MASTER_AUDIT.md) · [Evidence freshness](14_DECISIONS_AND_ASSUMPTIONS.md)

**PARTIALLY IMPLEMENTED.** chatRoutes passes signed user and demo academic profile; demoAcademicChatService handles some owned CA/history/current-period queries. Next-lecture, future curriculum and explicit registration are incomplete. Session logs/ID do not prove durable conversation memory; Advisor state is in-memory/expiring, private profile persists separately.

## Implementation contract

| Required item | Proposed work, not implemented in audit |
|---|---|
| 1 Reuse | chatRoutes/chatService, demoAcademicChatService, demoAcademicService.withChat, sessionOwnershipService, timetableService/Presentation, bounded planner |
| 2 Modify | Owned academic intent dispatch, chatService routing, planner context fields and response metadata |
| 3 New modules | Phase1 academicContextService plus deterministic personalized timetable/curriculum/history helpers |
| 4 Existing tables | chat_sessions, accepted timetable head/snapshots/overrides; no cross-owner log search |
| 5 Proposed migrations | None for read-only first iteration if versioned profile suffices; real enrolment/history tables separately reviewed |
| 6 Frontend | Existing chat/actions, simulated/freshness labels and profileId/version guards |
| 7 Backend | Resolve owner context before planner; deterministic next/tomorrow classes and current/future/history lookup |
| 8 External | Official term/calendar/holiday data, registration/group confidence; real SIS unavailable |
| 9 Security | Private history only current signed owner; no cross-student answer cache or arbitrary browser enrolment |
| 10 Acceptance | Correct owned classes/courses/results/future curriculum; explicit unknowns; bounded context |
| 11 Existing tests | Programme conversation, simulator/presentation, timetable and integrationSecurity tests |
| 12 New tests | Lusaka midnight/weekend/term, future-no-grades, cross-owner403, stale409, shared BBA/AFIN and restart-state limits |
| 13 Risks | Weekly pattern is not proof of a dated class; simulator inferred year not authoritative calendar |
| 14 Order | Phase1 context→deterministic queries→minimal planner context→actions/privacy regression |
| 15 Complexity | Medium after phase1; high if real SIS included |

## Acceptance scenarios
- Current courses returns the five registrations, not every scheduled BIT row.
- Second-year results show fixed simulated records or unknowns; fourth-year curriculum has no grades.
- Tomorrow/next lecture uses Africa/Lusaka with term uncertainty disclosed; changed classes uses same eligible feed as bell.
- Account switch/logout cannot display a stale private response.

Cloud migrations/releases need separate concrete authorization. [Release gates](12_TESTING_AND_RELEASE_STRATEGY.md).

## Implemented source and acceptance update

Use backend/services/personalAcademicService.js tryAnswer/localTime/schedule/selection/courseReference and academicContextService.fromProfile. chatService dispatch preserves fees/support/Advisor first-class boundaries and rememberLegacy tracks CA-vs-results references. sessionService.getRecentHistory excludes academic tables from general model context. Widget app.js clears private state and checks request plus token/profile identity. Tests: backend/tests/personalAcademic.test.js and widget tests/chat-actions.test.cjs; full440/146 and syntax250/build passed. No Phase2 schema migration or dependencies. See [full report](17_PHASE_2_IMPLEMENTATION.md) for exact8 changed source/test/build files and scenario evidence. The earlier table is a historical blueprint, not remaining implementation work.
