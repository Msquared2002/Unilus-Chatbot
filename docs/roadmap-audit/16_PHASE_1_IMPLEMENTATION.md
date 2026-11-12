# Phase 1 local implementation report

Date: 2026-11-10 (Africa/Lusaka). HEAD remains 9cbdeb0517da8820b94a623d9b8facbef50ae1ee with preserved pre-existing notification work. **No commit, push, deployment, production migration, cloud write or private account-file change.**

## Definition of done

Local implementation and automated checks are complete. Full Phase1 acceptance remains **conditional**: visual browser acceptance is blocked by platform browser policy, live Python extractor integration is unavailable, and Luka's actual class group is unknown. None is reported as passed. No production readiness/deployment approval is implied.

## Completed checkpoints

| Checkpoint | Implemented / evidence | Remaining qualification |
|---|---|---|
|A Fixed profile|Versioned35-course curriculum,22 completed/5 current/8 future, deterministic fictional transcript, existing CA30/exam70 model4; fixed renewal rejected, flexible renewal retained|Results are explicitly simulated, not real portal grades|
|Identity reconciliation|Actual private Student B records verified; demo alias authenticated against existing private hash, stable username unilus-demo-student-b retained for JWT/session/ticket/profile ownership; Student A unilus-demo-student unchanged|Local server config DEMO_FIXED_ACCOUNT required; no production config/account changed|
|B Automatic notifications|Successful complete manifest→normalized immutable snapshot/diff transaction→server context eligibility→combined inbox; no operator approval/student subscription for reliable context|Real external extractor not present; group-specific rows withheld when group unknown|
|C Two-minute demo|Real BIT32 registered lecture; persisted120-second venue overlay; no base mutation; expiry evaluated per read; lifecycle unique events, restart and duplicate processing tested|Tests advance expiry in isolated fixtures; no completed real-time browser120-second run claimed|
|D Chatbot UI|One header bell Map/Bell/Settings/Expand/Close, count/accessible label, unified list/details, safe actions/read, one visibility/auth poll, abort/cleanup on identity switch, existing views/history DOM retained|Automated DOM fixtures pass; visual/mobile/focus acceptance remains unverified|
|E Security/recovery|Unapplied003 adds restricted overlay table;001/002 unchanged; known notification backup tables/composite receipts/FK restore supported and rehearsed in PGlite|Unknown remote notifications table remains untouched; full production backup/fingerprint review still needed before future writes|

## Fixed account and data preservation

Set DEMO_ACADEMIC_ENABLED=yes, DEMO_FIXED_ACCOUNT=unilus-demo-student-b, retain DEMO_ACADEMIC_USERS including both original students, and existing AUTH_USERS_FILE privately. demo is a login alias, not an ownership migration: backend username/JWT subject intentionally remains Student B's stable identifier. Existing Student B password hash is retained; actual private authentication passed. No plaintext copied. If an unrelated demo user exists, alias login fails closed. Student/staff/admin identities are not merged.

Fixed identity: Luka Hamududu / BIT24240001 / BIT Information Systems and Technology / full-time /3.2. Owner checklist contains35 unique courses across8 semesters. First5 periods22 simulated completed courses, current5 BBA360/BIT301/BIT320/BIT326/BIT346, future8 year4 without grades. Fixed seed/version produces consistent marks under existing policy; portal and chat load same profile. Profile Storage uses fixed-luka-v1.txt (or local .fixed-luka-v1.json), leaving previous active.txt/random profile intact. Profile session can expire normally; transcript stays fixed. No official full-course-load progression decision is fabricated.

Source title conflicts remain in bit-curriculum-v1.json as sourceTitles/aliasReviewRequired, including BIT301 Decision Support Systems conflict; no ambiguous source title is silently adopted as equivalent. BCS mismatch remains out of Phase1 BIT scope and documented for later reconciliation.

## Automatic source contract and executable workflow

Run with the intended local test environment: node backend/scripts/ingestTimetable.js timetable.json manifest.json. Or call timetableUpdater.importTimetable({buffer,manifest}); non-dry raw file replacement is refused. This is a trusted server-side import adapter, not a student-facing write endpoint. Legacy acceptTimetable.js is superseded for new integrations; no extra manual approval stage belongs in the new flow.

Manifest fields: version:1; success:true; complete:true; errors:[]; sources:[{url:HTTPS-source,success:true}]; expectedSources equal successful source count; rowCount; sha256 of exact input bytes; academic period such as2026-sem2; expectedPrevious null or accepted publication ID. Producer must establish actual page coverage/completeness; caller assertions are not proof that the missing Python extractor succeeded. No invented extractor output or live update claim.

Adapter validates manifest/hash/count, existing normalization/time/day checks and snapshot/diff guards. Publication retains expected-head/advisory transaction/idempotency/shrink/missing-scope protections; fully validated removals do not need human review and wording never confirms cancellation. Initial/new-period baseline silent. Duplicate/reordered/format-only data silent. Accepted DB snapshot is runtime truth; JSON is bootstrap/import data.

Eligibility uses signed server academic context, exact programme/year/semester/mode and registered codes including BBA/AFIN. Unknown class groups are not guessed; actual A1 membership has not been supplied, so Luka does not receive unqualified official group-specific alerts. Explicit simulated override notifications target the fixed fictional owner/profile. Old subscription APIs remain compatibility-only for accounts without reliable context; the new UI does not require/manage them.

To connect Python: supply its source/job and successful complete-source manifest adapter; run unchanged/reorder/one venue/day/time/lecturer/add/remove and missing-source/error/stale-head cases against isolated DB; verify only matching profiles' inbox/read/detail routes; then separately review production rollout.

## Override guarantees

Set DEMO_TIMETABLE_OVERRIDE_ENABLED=yes only for an authorized demonstration process and run node backend/scripts/demoTimetableOverride.js unique-operation-id "Simulated venue" under explicit local configuration. No HTTP/student write endpoint exists. Service requires the fixed enabled student, accepted publication and real registered BIT32 lecture. Operation IDs deduplicate, overlap is refused, publication advisory lock coordinates instances.

Overlay expiry is persisted starts_at+120000ms; original authoritative snapshot is unchanged. Effective resolver stops overlay after expiry even without a worker. Startup/request refresh loads persisted state; lazy settle inserts at most one ending event. Sleeping backend delays delivery, not the expiry decision. If accepted base changes, overlay invalidates and ending message says it was superseded rather than inventing an original-venue restoration. Separate-process tests verify same transcript, unchanged base fingerprint, expired effective data and exactly applied/ending events. Fixture tests shorten persisted expiry to avoid120-second suite delay; manual wall-clock acceptance remains listed below.

## Fresh verification

- Complete backend: **404 passed,0 failed,0 skipped**; [log](phase1-backend-full.txt).
- Complete widget: **144 passed,0 failed,0 skipped**; [log](phase1-widget-full.txt).
- JavaScript syntax: **248 passed,0 failed**; [evidence](phase1-syntax.json).
- Production build passed:144.65kB, gzip45.06kB; [log](phase1-build.txt). Existing Vite ESM/CommonJS config-loader warning remains nonfatal.
- New profile/eligibility/manifest/overlay/recovery/restart/alias tests included in full suite. Expanded recovery test restores16 known integrated tables with receipts/overrides and verifies rows, schema, indexes, constraints, sequences, RLS/grants in isolated PGlite.
- Actual private Student B alias authentication verified without changing file or printing/copying password; [metadata-only evidence](phase1-private-account-check.json).
- Changed source credential-pattern scan: zero hits; see [change manifest](phase1-change-manifest.json). Not a claim that all historical files have been independently credential-audited.
- Sandbox localhost EACCES initially prevented API fixtures; rerun through permitted host execution passed. In-app browser localhost timed out; desktop Computer Use stopped because URL-policy enforcement is unsupported. No browser acceptance/screenshots claimed; no alternate bypass attempted.

## Precise remaining browser acceptance

1. Build widget, then node deployment/phase1-preview.cjs. It clears cloud configuration and creates synthetic local SQLite/profile files, binds127.0.0.1:8791. Open http://127.0.0.1:8791/phase1-preview.html. This developer fixture creates synthetic token/session only; never deploy it. Private-account variant: add --private-accounts, then sign in manually through portal-login with demo using existing private password; no credentials are displayed/copied. Stop an existing fixture before starting another.
2. Confirm Luka identity/3.2,5 current courses, previous5 fixed periods, refresh/reopen stable; switch to ?account=flex synthetic fixture to verify New Profile still works. Private variant Student A signs in normally.
3. Open launcher and bell: one bell between Map/Settings, support+simulated timetable entries, correct details, unread decrements once, Back preserves chat/draft/scroll. Ticket notes never shown.
4. For a fresh fixture, observe temporary venue, wait120 seconds from recorded override start, query updated timetable then inbox; original effective venue restored and one ending event. Close/reopen browser and restart backend using a persistent isolated DB for restart variant. The provided fixture intentionally starts fresh on every launch; restart behavior is separately automated.
5. Desktop expanded and mobile390x844: no horizontal overflow, controls fit, focus visible, keyboard Back/read, light/dark, avatar emotion/outfit/settings/map preserved. Test401/offline/retry, hidden-tab polling, logout/account-switch late responses. These remain unverified visually.

## Unexpected remote notifications table

Existing read-only metadata shows public.notifications outside this implementation, RLSdisabled, no selected grants to anon/authenticated/unilus_backend. Local source inspection found no current SQL consumer. New design uses ticket_events/receipts and timetable_changes/receipts, so no naming/data conflict. No remote change made. Purpose/full effective PUBLIC/default/function permissions remain unresolved. Logical backup deliberately does not adopt unknown table data; a native reviewed full-schema backup or explicit owner-approved scope is needed before claiming whole-project recovery. Existing backups preserved; independent off-machine recovery remains deferred.

## Migration review and future release

Current reviewed-candidate bundle SHA256: 079ae42449357c1bfaa9aafa8eb2d9a00f0b64bcf7db0101ff50e700f20b761e. This is **not approved for production execution**.001/002 hashes remain unchanged;003 candidate 53798599e912e9540985ff59810e16ecf719b7f87f84aa173b2b3200c31d1976. See [migration evidence](phase1-migration-review.json). Schema adds timetable_demo_overrides with publication FK/expiry index and RLS/SELECT+INSERT-only runtime policy; no anon/authenticated access. Updated verifier checks override privileges alongside existing003 tables.

Before release: complete browser/manual acceptance and extractor/group qualification; review exact final SQL/guards/hash and full-scope encrypted backup with current production schema/count/fingerprints and restore rehearsal; clarify unexpected table scope; obtain explicit guarded migration/configuration/commit/push/deployment authorization. Keep001/002 immutable, existing services/K0/private secrets; no legacy migration reapply. Configure fixed-account alias privately on the approved backend, preserve original hash/owner paths. Verify restricted role/receipt FK/RLS/original records after migration, then backend+frontend compatible deployment and two-account hosted acceptance. Do not claim independent recovery.

## Exact application/test/helper files changed since audit baseline

| Path | Purpose |
|---|---|
| backend/data/bit-curriculum-v1.json | Versioned owner curriculum with source-title conflicts preserved |
| backend/migrations/003_timetable_notifications.sql | Unapplied restricted additive schema and security verification |
| backend/scripts/demoTimetableOverride.js | Persisted simulated override and idempotent lifecycle |
| backend/scripts/ingestTimetable.js | Validated automatic ingestion contract and sole accepted authority |
| backend/services/academicContextService.js | Server-controlled registration/stage/group eligibility |
| backend/services/notificationService.js | Unified inbox targeting, owned detail/read handlers and effective timetable |
| backend/services/timetableIngestionService.js | Validated automatic ingestion contract and sole accepted authority |
| backend/services/timetableNotificationSchemaCheck.js | Unapplied restricted additive schema and security verification |
| backend/services/timetableNotificationService.js | Unified inbox targeting, owned detail/read handlers and effective timetable |
| backend/services/timetableOverrideService.js | Persisted simulated override and idempotent lifecycle |
| backend/tests/phase1Alias.test.js | Secure demo sign-in alias with unchanged stable subject/password |
| backend/tests/phase1ProfilesAndTimetable.test.js | Focused ownership/profile/notification regression coverage |
| backend/tests/phase1Recovery.test.js | Expanded known-table capture and FK/composite-key recovery |
| backend/tests/phase1Restart.test.js | Independent-process persistence/expiry regression |
| deployment/phase1-preview.cjs | Isolated localhost synthetic/private-account acceptance helper |
| dummy-environment/chatbot-widget/tests/unified-notifications.test.cjs | Focused ownership/profile/notification regression coverage |
| dummy-environment/css/notifications.css | Single chatbot inbox/bell presentation, lifecycle and rebuilt bundle |
| backend/routes/notificationRoutes.js | Unified inbox targeting, owned detail/read handlers and effective timetable |
| backend/services/authService.js | Secure demo sign-in alias with unchanged stable subject/password |
| backend/services/demoAcademicService.js | Fixed transcript, protected renewal and versioned Storage object |
| backend/services/logicalBackup.js | Expanded known-table capture and FK/composite-key recovery |
| backend/services/postgresOperations.js | Expanded known-table capture and FK/composite-key recovery |
| backend/services/rehearsePortableBackup.js | Expanded known-table capture and FK/composite-key recovery |
| backend/services/timetableService.js | Unified inbox targeting, owned detail/read handlers and effective timetable |
| backend/services/timetableUpdater.js | Validated automatic ingestion contract and sole accepted authority |
| backend/tests/demoAcademic.test.js | Focused ownership/profile/notification regression coverage |
| dummy-environment/chatbot-widget/dist/chatbot-widget.js | Single chatbot inbox/bell presentation, lifecycle and rebuilt bundle |
| dummy-environment/chatbot-widget/main.js | Single chatbot inbox/bell presentation, lifecycle and rebuilt bundle |
| dummy-environment/chatbot-widget/tests/ticket-notifications.test.cjs | Focused ownership/profile/notification regression coverage |
| dummy-environment/chatbot-widget/widget.css | Single chatbot inbox/bell presentation, lifecycle and rebuilt bundle |
| dummy-environment/chatbot-widget/widget.js | Single chatbot inbox/bell presentation, lifecycle and rebuilt bundle |
| dummy-environment/js/demo-academics.js | Single chatbot inbox/bell presentation, lifecycle and rebuilt bundle |
| dummy-environment/js/ticket-notifications.js | Single chatbot inbox/bell presentation, lifecycle and rebuilt bundle |
| dummy-environment/portal.html | Single chatbot inbox/bell presentation, lifecycle and rebuilt bundle |

Audit reference updates:00,01,02,03,04,11,12,13,14,15 link this implementation delta; this16 report and phase1 evidence/logs are new. Pre-existing unmodified application changes remain in the working tree and must not be discarded.
