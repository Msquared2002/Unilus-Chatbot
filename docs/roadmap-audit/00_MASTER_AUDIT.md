# Master audit and development roadmap

> **Phase2 local implementation — 2026-11-11:** [Implementation, exact source delta, fresh440/146 tests and limitations](17_PHASE_2_IMPLEMENTATION.md). Personalized StudentMode is implemented locally. Manual browser/visual acceptance is intentionally deferred until the consolidated seven-phase stage. Historical audit/Phase1 evidence below remains dated; no production release is implied.


> **Phase 1 implementation update (2026-11-10):** Read [the implementation delta, fresh tests and remaining acceptance gates](16_PHASE_1_IMPLEMENTATION.md) before using this historical audit snapshot. Fixed profile, automatic import adapter, persisted override and widget inbox are now implemented locally; no production release or browser acceptance is claimed.


Audit: **2026-11-10, Africa/Lusaka**. Local HEAD `9cbdeb0517da8820b94a623d9b8facbef50ae1ee`, branch `codex/production-integration`, **with pre-existing uncommitted unified-notification work**. Source findings describe that working tree unless explicitly marked production. Documentation only; no implementation/release authorized. [Master](00_MASTER_AUDIT.md) · [Evidence freshness](14_DECISIONS_AND_ASSUMPTIONS.md)

## Executive summary
The integrated demonstration already contains public/authenticated chat, bounded Groq and hybrid RAG, deterministic tuition lookup, Programme Advisor, a simulated academic portal, support/staff workflows, private knowledge Storage and campus place browsing. It is not yet the complete personalized Student Companion. Preserve these systems and build shared academic identity and one notification surface.

Ticket notifications exist at local checkpoint9cbdeb0. Uncommitted unified timetable notifications are local-only and require migration003. The new owner direction supersedes their manual publication/subscription design. Fixed Luka identity, full curriculum, automatic profile targeting, two-minute overlays and a chatbot-header bell are not implemented.

## Fresh verification and limits
- Read-only public HTTP: website200, backend /readyz200 ready, runtime-config200 points to the stated Render backend. [HTTP evidence](hosted-readonly.json).
- Read-only PostgreSQL: schema/constraints/indexes/policies/selected grants/role/ledger/bucket metadata, transaction_read_only on. No student records fetched. Applied001/002, no003. [Metadata](database-metadata.json).
- Focused automated verification: **21 passed,0 failed**,0 skipped. [Exact log](targeted-tests.txt).
- Historical full suites396 backend/144 widget and prior browser/recovery reports were not rerun. No fresh browser acceptance or production feature interaction is claimed.
- Historical hosted baseline2335d9f is not a freshly verified deployed commit. HTTP readiness does not establish source revision or notification operation. No production POST chat/profile GET/upload/ticket/migration, commit/push/deployment occurred.

## Major findings
1. Simulator curriculum is derived from timetable observations and excludes projects/research. Whole BIT2.1 and3.1 periods are absent from retained mappings. Catalogue, registration, completed history and weekly sessions must be distinct.
2. BIT means Information Systems and Technology. Simulator/login BCS means Computer Science, while timetable BCS describes Cyber Security: canonical programme identity needs correction before cross-programme personalization.
3. Metadata-only local account inspection found two student accounts, both BIT3.2, neither named demo. Do not implement Luka by changing a browser display label.
4. Timetable has3296 rows, including1132 lecturer-only rows. Described Python extractor is unavailable here; no verified automatic source refresh path exists.
5. Existing notification UI is in portal main, not the chatbot. Reuse backend/poll lifecycle and move presentation once.
6. Campus graph has114 nodes/127 edges but zero local walkways and zero verified access points. Place browsing is distinct from reliable pedestrian directions.
7. Chatbot ticket creation does not pass contact/department into createTicket, leaving Registry fallback. Topic classification is not effective queue routing.
8. Fresh production metadata includes an unexpected public.notifications table outside current migration/source consumers, RLS disabled. No selected anon/authenticated/unilus_backend grants found; full effective ACL/purpose unresolved. Do not repurpose/delete it.
9. Logical backup scope omits receipts and future timetable tables; existing foreign-key restore restrictions also need review. Tested historical backups remain Windows-dependent, as explicitly accepted for the demonstration.

## Roadmap readiness
| Phase | Can start? | Main gate |
|---|---|---|
|1 Fixed profile + notifications|Local implementation after separate instruction|Account mapping, curriculum aliases, trusted extraction-completeness contract, reviewed migration|
|2 Personalized Student Mode|After shared academic context|Explicit registration/history/calendar; no inferred enrolment|
|3 Front desk|Routing/contact can begin independently|Canonical department and attachment privacy/retention decisions|
|4 Walking navigation|Survey preparation yes; route release blocked|Verified paths/entrances/access restrictions|
|5 Tutors|After identity/catalogue|Opt-in visibility and honest verification meaning|
|6 Morning Brief|After phases1/2|Calendar and trustworthy dated feeds|
|7 Remaining features|Select individually|Official sources and per-feature gates|

## Reusable reference index
- [ARCHITECTURE AND FILE MAP](01_ARCHITECTURE_AND_FILE_MAP.md)
- [DATABASE AND DATA SOURCES](02_DATABASE_AND_DATA_SOURCES.md)
- [FEATURE COMPLETION MATRIX](03_FEATURE_COMPLETION_MATRIX.md)
- [PHASE 1 PROFILE AND NOTIFICATIONS](04_PHASE_1_PROFILE_AND_NOTIFICATIONS.md)
- [PHASE 2 PERSONALIZED STUDENT MODE](05_PHASE_2_PERSONALIZED_STUDENT_MODE.md)
- [PHASE 3 DIGITAL FRONT DESK](06_PHASE_3_DIGITAL_FRONT_DESK.md)
- [PHASE 4 CAMPUS NAVIGATION](07_PHASE_4_CAMPUS_NAVIGATION.md)
- [PHASE 5 PEER TUTORS](08_PHASE_5_PEER_TUTORS.md)
- [PHASE 6 MORNING BRIEF](09_PHASE_6_MORNING_BRIEF.md)
- [PHASE 7 FUTURE ENHANCEMENTS](10_PHASE_7_FUTURE_ENHANCEMENTS.md)
- [SECURITY PERFORMANCE AND RISKS](11_SECURITY_PERFORMANCE_AND_RISKS.md)
- [TESTING AND RELEASE STRATEGY](12_TESTING_AND_RELEASE_STRATEGY.md)
- [IMPLEMENTATION DEPENDENCIES](13_IMPLEMENTATION_DEPENDENCIES.md)
- [DECISIONS AND ASSUMPTIONS](14_DECISIONS_AND_ASSUMPTIONS.md)
- [CODEX PHASE HANDOFF](15_CODEX_PHASE_HANDOFF.md)

Read master plus selected phase, then refresh changed evidence only. This audit stops before implementation. Await a separate Phase1 instruction.


## Phase 3 implementation update — 2026-11-11

Phase 3 Digital Front Desk is implemented locally; production and visual acceptance remain deferred. See [Phase3 implementation and evidence](18_PHASE_3_IMPLEMENTATION.md) for authoritative current details. Earlier audit findings remain historical.


## Phase 5 local implementation — 2026-11-11

Phase5 peer tutoring is implemented locally. Phase4 is explicitly deferred; Phase6 has not started. See [Phase5 implementation and fresh evidence](20_PHASE_5_IMPLEMENTATION.md). Older audit statements remain historical.


## Phase 6 local implementation — 2026-11-11

Phase6 Morning Brief and reminders are implemented locally. Phase4 remains deferred; Phase7 has not started. See [Phase6 implementation and verification](21_PHASE_6_IMPLEMENTATION.md). Prior audit/proposal findings remain historical.


## Phase 7 local implementation — 2026-11-11

Phase7 is locally implemented as far as trusted data permits. Read22 and23 for implementation/acceptance status. Real official feeds and hosted/manual acceptance are not claimed. See [implementation report](22_PHASE_7_IMPLEMENTATION.md) and [consolidated handoff](23_CONSOLIDATED_ACCEPTANCE_HANDOFF.md).
