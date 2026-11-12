# Reusable Codex phase handoff

> **Phase2 local implementation — 2026-11-11:** [Implementation, exact source delta, fresh440/146 tests and limitations](17_PHASE_2_IMPLEMENTATION.md). Personalized StudentMode is implemented locally. Manual browser/visual acceptance is intentionally deferred until the consolidated seven-phase stage. Historical audit/Phase1 evidence below remains dated; no production release is implied.


> **Phase 1 implementation update (2026-11-10):** Read [the implementation delta, fresh tests and remaining acceptance gates](16_PHASE_1_IMPLEMENTATION.md) before using this historical audit snapshot. Fixed profile, automatic import adapter, persisted override and widget inbox are now implemented locally; no production release or browser acceptance is claimed.


Audit: **2026-11-10, Africa/Lusaka**. Local HEAD `9cbdeb0517da8820b94a623d9b8facbef50ae1ee`, branch `codex/production-integration`, **with pre-existing uncommitted unified-notification work**. Source findings describe that working tree unless explicitly marked production. Documentation only; no implementation/release authorized. [Master](00_MASTER_AUDIT.md) · [Evidence freshness](14_DECISIONS_AND_ASSUMPTIONS.md)

## Resume efficiently
Read [master](00_MASTER_AUDIT.md), [architecture](01_ARCHITECTURE_AND_FILE_MAP.md), [database](02_DATABASE_AND_DATA_SOURCES.md), selected phase below. Recheck HEAD/working diff and changed files only. Audit ended without implementing features; wait for separate Phase1 instruction. Old migration/deploy approvals do not automatically authorize a new phase/bundle.

| Phase | Blueprint | Source/test entry points |
|---|---|---|
|1|[Profile/notifications](04_PHASE_1_PROFILE_AND_NOTIFICATIONS.md)|demoAcademicService mappings/generate/renew/withChat; authService; timetableUpdater/Change/NotificationService; notificationRoutes; widget.js init/goToView; ticket-notifications.js; timetableNotifications/ticketNotifications/unifiedNotificationIntegration/widget unified tests|
|2|[Personalization](05_PHASE_2_PERSONALIZED_STUDENT_MODE.md)|chatRoutes/chatService/demoAcademicChatService; phase1 context, planner, timetable/presentation; owned profile/date tests|
|3|[Front desk](06_PHASE_3_DIGITAL_FRONT_DESK.md)|supportConversation/createTicket/contactService/ticketWorkflow.assign; supportRoutes/admin adapter/managedKnowledge; consent/ownership/upload tests|
|4|[Campus](07_PHASE_4_CAMPUS_NAVIGATION.md)|campus graph/access/data/routing service; map/location/search; survey tools; campusLocalRouting/campusSurvey/widget regressions|
|5|[Tutors](08_PHASE_5_PEER_TUTORS.md)|auth/context/curriculum/widget patterns; no tutor implementation|
|6|[Brief](09_PHASE_6_MORNING_BRIEF.md)|effective timetable/context/owned inbox; no trusted assignment feed or scheduler|
|7|[Future](10_PHASE_7_FUTURE_ENHANCEMENTS.md)|Select one row, confirm official source/access first|

## Preserve and avoid traps
Local HEAD9cbdeb0 plus uncommitted unified work is audited candidate. No reset/revert/discard, no applied001/002 edits, no academic policy4 rewrite. Fresh production ledger001/002 only;003 local, current bundle c9b1d7026477f5d5b9bf8c40c31f7b6c3908d9a817c5148442454493efd27cab is not approval.

Credentials remain outside repo; never print or hardcode password/token. Production academic profile GET can write Storage; chat POST persists conversations. Use synthetic local mocks for read-only tasks.

One signed owner/context, canonical course/programme IDs, DB accepted timetable truth, effective overlay resolver, combined inbox/receipts and one browser poll. Preserve avatar/map/settings/chat/mobile/theme. Guests never gain private inbox. No invented walking routes, official marks, deadlines or enrolment.

demo absent from local account metadata; reconcile designated account. BCS conflict needs canonical review. Timetable mappings omit legitimate curriculum/projects/periods. New auto source targeting supersedes manual publication/subscription but cannot skip completeness safeguards. Render sleep delays delivery, not expiry. Extra notifications table RLSoff/purpose unknown must remain untouched. Backup scope/FK support incomplete for new tables. Pedestrian feature requires physical survey.

Fresh audit21/21; wider396/144 historical. Use [release strategy](12_TESTING_AND_RELEASE_STRATEGY.md) for future tests/gates; report exact new counts/files. Ask for concrete production authorization when actually needed, not routine authorized local work. This documentation does not grant code/cloud/commit/deployment permission.


## Phase 3 implementation update — 2026-11-11

Phase3 local implementation is available. Preserve all uncommitted Phase1–3 work. Read18 and its final artifacts before continuing; do not commit, deploy or begin Phase4 without instruction. See [Phase3 implementation and evidence](18_PHASE_3_IMPLEMENTATION.md) for authoritative current details. Earlier audit findings remain historical.


## Phase 5 local implementation — 2026-11-11

Phase5 local source/evidence is in20. Preserve uncommitted Phases1–3 and5. Phase4 is deferred; Phase6 and production/commit/push remain unauthorized. See [Phase5 implementation and fresh evidence](20_PHASE_5_IMPLEMENTATION.md). Older audit statements remain historical.


## Phase 6 local implementation — 2026-11-11

Phase6 local implementation and fresh evidence are in21. Preserve all uncommitted Phases1,2,3,5,6. Phase4 remains deferred and Phase7 is not authorized. No commit/push/production migration/deployment occurred. See [Phase6 implementation and verification](21_PHASE_6_IMPLEMENTATION.md). Prior audit/proposal findings remain historical.


## Phase 7 local implementation — 2026-11-11

Phase7 handoff is22 and23. Preserve every uncommitted prior phase. Phase4 remains deferred. Await explicit owner authorization for consolidated acceptance, commits, cloud migrations, pushes or deployment. See [implementation report](22_PHASE_7_IMPLEMENTATION.md) and [consolidated handoff](23_CONSOLIDATED_ACCEPTANCE_HANDOFF.md).
