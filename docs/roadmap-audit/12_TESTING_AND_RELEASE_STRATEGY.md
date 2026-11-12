# Testing and controlled release strategy

> **Phase2 local implementation — 2026-11-11:** [Implementation, exact source delta, fresh440/146 tests and limitations](17_PHASE_2_IMPLEMENTATION.md). Personalized StudentMode is implemented locally. Manual browser/visual acceptance is intentionally deferred until the consolidated seven-phase stage. Historical audit/Phase1 evidence below remains dated; no production release is implied.


> **Phase 1 implementation update (2026-11-10):** Read [the implementation delta, fresh tests and remaining acceptance gates](16_PHASE_1_IMPLEMENTATION.md) before using this historical audit snapshot. Fixed profile, automatic import adapter, persisted override and widget inbox are now implemented locally; no production release or browser acceptance is claimed.


Audit: **2026-11-10, Africa/Lusaka**. Local HEAD `9cbdeb0517da8820b94a623d9b8facbef50ae1ee`, branch `codex/production-integration`, **with pre-existing uncommitted unified-notification work**. Source findings describe that working tree unless explicitly marked production. Documentation only; no implementation/release authorized. [Master](00_MASTER_AUDIT.md) · [Evidence freshness](14_DECISIONS_AND_ASSUMPTIONS.md)

## Executed during this audit
| Check | Result |
|---|---|
|node --test backend/tests/timetableNotifications.test.js backend/tests/ticketNotifications.test.js backend/tests/programmeAdvisorConversation.test.js|21 tests,21 passed,0 failed/skipped;663.6949ms; [exact log](targeted-tests.txt)|
|PostgreSQL metadata|READ ONLY transaction, schema/role/ledger/buckets only, no records/count/fingerprint read|
|Public HTTP GET|/readyz200 ready; website200; runtime-config200 correct backend; [evidence](hosted-readonly.json)|
|Documentation and source preservation|[validation.json](validation.json), generated after documents|

## Historical / not rerun
deployment/unified-backend-tests.txt396/396 and unified-widget-tests.txt144/144; previous syntax241/build139.29kB(gzip43.42). These are historical logs, not this audit's full-suite results. No installs/build needed for Markdown. No browser, hosted login/notification writes, profile GET, upload, backup restore or Python tests run. Python source unavailable; real walking acceptance blocked by geometry; production writes forbidden.

## Phase test priorities
1. Fixed/flexible identity,35-course placement, owner/version conflicts, complete auto-import/reorder/partial/shrink guards, affected groups/shared codes, one inbox/poll, absolute expiry/restart/multi-instance.
2. Owned current/future/history/calendar boundary, simulation labels, no cross-owner retrieval.
3. Actual assignment/department permissions, draft/direct consent, minimal optional contact, safe attachment lifecycle and compensation.
4. Survey/access provenance, fail-closed graph, distance/GPS/animation and physical walkthrough.
5. Tutor opt-in/out immediate visibility, identity/course ownership/contact privacy.
6. Dated source/provenance/unknown deadlines, expiry and bounded compose calls.
7. Selected feature source/expiry/access; PWA private-cache exclusion/update; language numeric fidelity/mic fallback.

## Future full checks
Node24. Backend npm test from backend invokes node --test. Widget node --test with discovered tests/*.test.cjs paths; use supported shell expansion or explicit paths. Build npm run build from chatbot-widget. Run focused checks while fixing, then full relevant suites once code stabilizes. Use isolated SQLite/PGlite/synthetic object store. Browser guest/student, chat/history/avatar/theme/keyboard/mobile, bell/read/detail, timetable/map/support. Never present earlier commit results as new validation.

## Future release gates, not authorized now
1. Recheck HEAD/working diff; preserve local notification work, applied001/002 and academic model4.
2. Review exact new migration/bundle and guards; no reapply/applied-file edits. Fresh ledger decides whether unpublished003 can be revised.
3. Isolated schema/RLS/grant/FK/index/runtime permission tests; no anon/authenticated table privileges.
4. Resolve backup scope/FK-aware restoration for new tables; fresh source/schema/count/fingerprints. Independent-recovery deferral remains explicit, not falsely satisfied.
5. Obtain explicit approval for actual production bundle; guarded runner only, target project, locks/timeouts/fingerprints, transaction. Guard failure aborts, no bypass.
6. Verify ledger/schema/role/RLS and original preservation; then specifically authorized fictional-account acceptance. No university record changes.
7. Commit/push reviewed branch only after relevant full tests/build. Existing Render/Netlify, K0, secret files private, exact HTTPS/CORS; no replacements/paid resources.
8. Backend readiness/API first, validated frontend replacement second. Hosted owner privacy/inbox/timetable/support/map/chat/avatar acceptance; retain release evidence. Stop failed critical gate; no destructive recovery without approval.

Historical deployment IDs/commit remain historical until fresh platform metadata; HTTP readiness is not source/version/feature acceptance.


## Phase 3 implementation update — 2026-11-11

Fresh Phase3 automated results and artifacts are recorded in18. Manual/browser acceptance remains intentionally deferred; production writes/commit/push/deploy were not performed. See [Phase3 implementation and evidence](18_PHASE_3_IMPLEMENTATION.md) for authoritative current details. Earlier audit findings remain historical.


## Phase 5 local implementation — 2026-11-11

Fresh Phase5 focused/HTTP/recovery/full regressions and build results are recorded in20 and phase5 artifacts. Visual/browser acceptance remains deferred. See [Phase5 implementation and fresh evidence](20_PHASE_5_IMPLEMENTATION.md). Older audit statements remain historical.


## Phase 6 local implementation — 2026-11-11

Fresh Phase6 evidence:511 backend,168 widget,283 syntax checks and production build passed; isolated27-table recovery and missing-index rollback passed. Visual/browser/hosted acceptance remains deferred. See [Phase6 implementation and verification](21_PHASE_6_IMPLEMENTATION.md). Prior audit/proposal findings remain historical.


## Phase 7 local implementation — 2026-11-11

Fresh Phase7 gates:530 backend,182 widget,296 syntax, production build and isolated29-table recovery passed. Consolidated manual/browser/mobile/accessibility and hosted acceptance remain deferred. See [implementation report](22_PHASE_7_IMPLEMENTATION.md) and [consolidated handoff](23_CONSOLIDATED_ACCEPTANCE_HANDOFF.md).
