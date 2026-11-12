# Feature completion matrix

> **Phase2 local implementation — 2026-11-11:** [Implementation, exact source delta, fresh440/146 tests and limitations](17_PHASE_2_IMPLEMENTATION.md). Personalized StudentMode is implemented locally. Manual browser/visual acceptance is intentionally deferred until the consolidated seven-phase stage. Historical audit/Phase1 evidence below remains dated; no production release is implied.


> **Phase 1 implementation update (2026-11-10):** Read [the implementation delta, fresh tests and remaining acceptance gates](16_PHASE_1_IMPLEMENTATION.md) before using this historical audit snapshot. Fixed profile, automatic import adapter, persisted override and widget inbox are now implemented locally; no production release or browser acceptance is claimed.


Audit: **2026-11-10, Africa/Lusaka**. Local HEAD `9cbdeb0517da8820b94a623d9b8facbef50ae1ee`, branch `codex/production-integration`, **with pre-existing uncommitted unified-notification work**. Source findings describe that working tree unless explicitly marked production. Documentation only; no implementation/release authorized. [Master](00_MASTER_AUDIT.md) · [Evidence freshness](14_DECISIONS_AND_ASSUMPTIONS.md)

Status applies only to the named evidence scope; source presence does not mean production readiness. Historical deployment reports are not fresh interactive acceptance.

| Feature | Status | Evidence | Limitation/next step |
|---|---|---|---|
| HTTP readiness/site/API origin | DEPLOYED AND VERIFIED | Fresh GET200 /readyz, website, runtime-config | Configuration/availability only; not hosted feature acceptance |
| Groq chat/RAG/tuition | IMPLEMENTED BUT UNVERIFIED | chatService/knowledgeService/tuitionFeeService; historical deployed baseline | No fresh production POST; local index1447/48 schedules |
| Programme Advisor/ECZ | IMPLEMENTED LOCALLY AND TESTED | 3 fresh conversation tests within21; structured evidence rules | In-memory expiring profile; admission evidence incomplete |
| Auth/Staff Support Centre | IMPLEMENTED BUT UNVERIFIED | authService/attachUser/supportRoutes/admin adapter | Demo file identity; no fresh hosted login/privacy test |
| CA30/exam70 simulator | IMPLEMENTED BUT UNVERIFIED | demoAcademicService/policy4; historical regression | No profile GET this audit; results simulated |
| Fixed Luka/full curriculum | PLANNED ONLY | Owner spec vs mappings reconciliation | No fixed policy; catalogue derived from schedule |
| Avatar/theme/mobile/widget | IMPLEMENTED BUT UNVERIFIED | widget/avatar/styles, historical144 tests | No fresh browser run |
| Campus place map/search/photos/GPS | IMPLEMENTED BUT UNVERIFIED | campus modules/data; historical browser report | No fresh live browser/photo crawl |
| Walking routes | BLOCKED BY EXTERNAL DEPENDENCIES | Graph0 walkways/0 accesspoints | Physical survey needed |
| Timetable normalization/search foundation | IMPLEMENTED LOCALLY AND TESTED | Fresh13 timetable notification tests use real data | Browser search/timetable API not freshly exercised |
| Python pipeline/automatic import | BLOCKED BY EXTERNAL DEPENDENCIES | README external project; Node exported JSON | Source/tests/upstream job unavailable |
| Ticket reply/status inbox | IMPLEMENTED LOCALLY AND TESTED | Fresh5 ticket tests, production002 schema | Hosted feature not freshly exercised |
| Unified timetable inbox | IMPLEMENTED LOCALLY AND TESTED | Fresh timetable tests, historical local unified tests | Uncommitted003 not in production; current portal UI |
| Automatic targeting/publication | PARTIALLY IMPLEMENTED | Diff/head/recipient subscription services exist | Automatic context targeting is new requirement |
| Two-minute override | PLANNED ONLY | No override table/module | Absolute expiry/lifecycle idempotency needed |
| Chatbot bell | PLANNED ONLY | Portal-main UI exists, header has no bell | Move presentation; reuse one poll |
| Private knowledge management | IMPLEMENTED BUT UNVERIFIED | managedKnowledgeService + private bucket | Fresh write/upload prohibited; lifecycle gaps |
| Ticket contacts/attachments | MISSING | No contact/attachment schema/owned upload flow | KB uploads are separate |
| Department routing | PARTIALLY IMPLEMENTED | assign exists; draft omits contact, Registry fallback | Canonical resolver→actual assignment needed |
| Peer tutors | MISSING | No tutor table/service/UI found | Opt-in/verification/privacy foundation |
| Morning Brief | PLANNED ONLY | Timetable/unread sources reusable | No calendar/deadline feed |
| PWA/offline/Web Push | MISSING | No active service-worker/push infrastructure found | Separate future authorized scope |
| Feedback/analytics | IMPLEMENTED BUT UNVERIFIED | feedback table/support aggregate reports | No private record queries in audit |
| Office hours/announcements/collaboration/voice | MISSING | Knowledge mentions do not implement live services | Official data and selected-feature scope required |

Exact shared paths: [architecture](01_ARCHITECTURE_AND_FILE_MAP.md). Persistence: [database](02_DATABASE_AND_DATA_SOURCES.md). Each phase below adds its acceptance requirements.

## Phase2 current status

| Capability | Status | Evidence/qualification |
|---|---|---|
|Personalized current/history/future courses, stored results/CA/exam and comparisons|IMPLEMENTED LOCALLY AND TESTED|personalAcademicService +36 API/helper cases; fixed catalogue/profile unchanged|
|Today/tomorrow/week/next lecture, venue/lecturer and course clarification|IMPLEMENTED LOCALLY AND TESTED|Same effective publication/overlay; group/calendar uncertainty explicit; BCS identity unresolved|
|Owned follow-ups, account/logout/stale-response isolation|IMPLEMENTED LOCALLY AND TESTED|Bounded refs, old transcript redaction,2 new widget cases; no durable-memory claim|
|Live date/term/holiday confirmation and missing extractor|BLOCKED BY EXTERNAL DEPENDENCIES|No invented occurrences/upstream integration|
|Manual consolidated visual acceptance|IMPLEMENTED BUT UNVERIFIED|Intentionally deferred by owner; no browser pass claimed|


## Phase 3 implementation update — 2026-11-11

Phase3 routing, consented private contacts, private attachments, authorized staff handling and existing notifications are implemented with isolated automated coverage. Real contact seeding and hosted acceptance are pending. See [Phase3 implementation and evidence](18_PHASE_3_IMPLEMENTATION.md) for authoritative current details. Earlier audit findings remain historical.


## Phase 5 local implementation — 2026-11-11

Peer tutoring now has local opt-in, internal course checks, chatbot cards, one-to-one requests, explicit contact acceptance and unified notifications. Hosted/manual acceptance remains unverified. See [Phase5 implementation and fresh evidence](20_PHASE_5_IMPLEMENTATION.md). Older audit statements remain historical.


## Phase 6 local implementation — 2026-11-11

Morning Brief now assembles owner-scoped weekly candidates, updates and reminders. Optional daily opening claims, confirmed one-time reminders and unified due receipts are locally implemented; visual/hosted acceptance remains deferred. See [Phase6 implementation and verification](21_PHASE_6_IMPLEMENTATION.md). Prior audit/proposal findings remain historical.


## Phase 7 local implementation — 2026-11-11

Calendar/exam/announcement/consultation contracts are integration-ready awaiting authoritative data. Study, source-qualified facility answers and safe public PWA/offline logic are implemented/tested locally. See [implementation report](22_PHASE_7_IMPLEMENTATION.md) and [consolidated handoff](23_CONSOLIDATED_ACCEPTANCE_HANDOFF.md).
