# Stage A consolidated acceptance report

> 2026-11-12 remediation update: the owner's subsequent manual Firefox acceptance identified additional conversational,academic-follow-up,table,staff-display and workflow defects beyond the original automated coverage below. See [26_STAGE_A_DEFECT_REMEDIATION.md](26_STAGE_A_DEFECT_REMEDIATION.md) for the corrected implementation,per-ID status,current evidence and remaining live Groq/Firefox/hosted limitations. Earlier findings and evidence are preserved as the dated StageA snapshot; passing automation alone is not full product acceptance. No release or production action is authorized by this update.

Date: 2026-11-11, Africa/Lusaka. Scope: integrated local demonstration; production metadata read-only. Stage A ends here. No commit, push, deployment, remote migration, hosted-account change or production test write was performed. Phase 4 remains deferred.

## Verdict and evidence rules

**Local automated acceptance passes after four demonstrated integration corrections. Release remains NO-GO until the Stage B prerequisites in report25 are satisfied.** Local synthetic acceptance does not establish hosted operation or current official university feeds.

PASS means executed and verified in the specified environment; FAIL means an observed incorrect result; BLOCKED means a dependency prevented the named acceptance; DEFERRED means expressly excluded. Earlier phase counts are historical. Fresh evidence below supersedes them. Unit/DOM checks are not visual acceptance. Headless Edge screenshots were inspected, but this is not a physical handset or full screen-reader assessment.

## Exact state and changes

Branch: `codex/production-integration`. HEAD remains `9cbdeb0517da8820b94a623d9b8facbef50ae1ee`. All existing uncommitted Phases1/2/3/5/6/7 remain present. No reset, checkout, cleanup or discard was used. `stage-a-working-tree.txt` records the full working tree, which includes earlier work and must not be treated as this acceptance's delta. `stage-a-change-verification.json` contains fresh syntax inventory, migration hashes and credential-pattern findings. Migrations001–006 match the Phase7 input baseline; no SQL migration was edited. Applied001/002 hashes also match the current remote ledger.

Application/test/helper files added or modified during Stage A, including its interrupted first turn:

- `backend/services/chatService.js`
- `backend/services/supportConversationService.js`
- `backend/tests/frontDesk.test.js`
- `backend/tests/studentCompanionRecovery.test.js`
- `dummy-environment/chatbot-widget/widget.js`
- `dummy-environment/chatbot-widget/campus-map.js`
- `dummy-environment/chatbot-widget/tests/unified-notifications.test.cjs`
- `dummy-environment/chatbot-widget/dist/chatbot-widget.js`
- `deployment/stage-a-local.cjs`
- `deployment/stage-a-browser.cjs`
- `deployment/stage-a-api.cjs`
- `deployment/stage-a-metadata.cjs`
- `deployment/stage-a-gates.cjs`

Documentation: this report and `25_RELEASE_READINESS_AND_BLOCKERS.md`; supporting `stage-a-*` evidence files in this directory. No academic simulator model, grades, source documents, GIS dataset, authentication implementation or production credentials were changed.

## Demonstrated defects and corrections

|Initial result|Reproduction/root cause|Correction and final result|
|---|---|---|
|FAIL: personal fee assistance reached tuition lookup|`I need help with my fees.` was accepted by the earlier deterministic fee handler before support.|Narrow explicit personal-assistance detection skips fee lookup and offers support without a write. Factual programme tuition questions retain the existing fee path. PASS in actual HTTP matrix and focused/full regression.|
|FAIL: support-request synonym fell into general retrieval|`Create a support request.` did not match the ticket-only request pattern.|Recognize the synonym in the existing consent state machine. Issue review/confirmation still required. PASS; no ticket created merely by asking.|
|FAIL: bell raised a browser TypeError|Bell/brief consumed `UnilusWidget.showNotifications`, absent from the public widget exports. Existing inbox tests mocked the consumer boundary.|Export the existing view transition. Added actual-widget export contract regression. PASS: browser bell, authorized announcement detail, and no uncaught errors.|
|FAIL: first map opening after preload lacked tiles/markers|`CampusMap.init()` had already loaded campus data; `show()` initialized Leaflet but called campus rendering only if data was absent, leaving no initial bounds/view.|Render through the existing cached load promise on opening. No dataset/routing changes. PASS: real tiles, boundary, markers, library search/photo and View on Map.|

The initial matrix failure evidence is `stage-a-api-initial.json`. Initial browser evidence is `stage-a-browser-initial.json`; later browser failures above were observed in successive runner outputs and diagnosed against the exact source paths described here. Final browser/API JSON is authoritative for the corrected state.

Acceptance-fixture corrections, not product defects: the first helper omitted the portal appearance-session flag and used BIT instead of the catalogue programme ID; URL waiting initially excluded portal hashes. A new VM test initially failed because its fake window was not the JavaScript global; it now models a real browser global. A screenshot wait included an intentionally infinite avatar animation; it now waits only for finite transitions. A new support test expected an empty description despite preceding fee-issue history; it now asserts the exact quoted prior issue and pending confirmation, rather than discarding the established contextual behavior. A 503 test initially expected a generic connection message; the application correctly displays its existing warm-up message. No old assertions were weakened.

## Reproducible complete local environment

Run from the integration repository root with Node24 and installed repository dependencies. No private env file is loaded by these acceptance helpers. They explicitly remove inherited database, Supabase, Groq, auth and profile configuration before loading the existing Express application. Their only backend outbound fetch destination is their own loopback port. SQLite, profiles, hashed synthetic accounts and attachment bytes are temporary local files; no replacement application is introduced.

```powershell
# Optional conventional port; Ctrl+C stops this helper.
node deployment/stage-a-local.cjs
# If 8793 is occupied, use an OS-assigned port and read the printed public URL.
$env:STAGE_A_PORT='0'
node deployment/stage-a-local.cjs
```

Open the printed origin with `/website.html` for Guest Mode; `/stage-a/b` selects isolated Luka, `/stage-a/a` selects the flexible student, `/stage-a/staff` selects isolated Finance staff and `/stage-a/admin` selects the isolated administrator. These loopback-only fixture selectors are NOT application authentication endpoints and must never be deployed. The helper serves the existing dummy website/portal, built widget, Support Centre and Express routes at one origin with a local runtime-config override. It signs synthetic sessions rather than using or changing actual account passwords. Private contacts are not imported. Local attachment storage is separate from RAG knowledge. General inference has no cloud credentials; the API runner additionally stubs inference/retrieval for routing-only questions.

Port8793 was occupied/unresponsive from the supported execution context; an attempted second bind returned EADDRINUSE. No unknown listener was terminated. The automated runners start the same helper on an OS-assigned loopback port, first assert HTTP200, and close their server/database/browser in finally blocks. Temporary fixture directories are retained; no backups are overwritten. The original interrupted-turn listener's lifetime is not asserted. Use Ctrl+C in the owning terminal for an interactive helper; do not kill unrelated Node processes.

```powershell
node deployment/stage-a-api.cjs
# Installed Playwright and installed Edge; no downloads.
# Set STAGE_A_PLAYWRIGHT to an existing module path on another machine if needed.
node deployment/stage-a-browser.cjs
node --test --test-isolation=process backend/tests/frontDesk.test.js
cd backend
node --test
node --test tests/migrationSafety.test.js tests/*Recovery.test.js tests/timetableNotificationMigration.test.js
cd ../dummy-environment/chatbot-widget
node --test tests/*.test.cjs
node node_modules/vite/bin/vite.js build
cd ../..
node deployment/stage-a-gates.cjs
```

The full/backend suites were run from backend, widget suite from its own directory. On this machine commands used the installed absolute Node runtime path; no npm dependency installation was required. The browser runner requires the installed Playwright module referenced in its source or the explicit module-path override. It uses a fresh temporary browser context and installed Edge channel, not Windows Computer Use, saved browser accounts, or a browser-security bypass.

Staff queues/replies/reassignment, tutoring transitions and publication administration are exercised through the real application API in the backend suites; the browser runner adds seeded, clearly labelled local source/tutor fixtures and interactive student workflows. No real official publication was inserted anywhere.

## Fresh regression gates

|Gate|Fresh result|Evidence|
|---|---|---|
|Complete supported backend|PASS: 533/533;0 failed/cancelled/skipped/todo|`stage-a-backend-full.txt`|
|Complete widget|PASS:183/183;0 failed/cancelled/skipped/todo|`stage-a-widget-full.txt`|
|JavaScript syntax|PASS:301/301|`stage-a-syntax.json`|
|Production widget build|PASS:21 modules,163.49kB, gzip51.21kB|`stage-a-build.txt`; existing Vite config-loader warning nonfatal|
|Isolated migration/recovery group|PASS:22/22;0 failed/skipped|`stage-a-migration-recovery.txt`|
|Final strengthened001–007 repeatability/29-table recovery|PASS:1/1; also included in final full backend suite|`stage-a-29-table-recovery.txt`|
|Actual HTTP matrix/lifecycle|PASS:21 checks, including14 routing questions|`stage-a-api.json`|
|Real headless browser|PASS:27 recorded checks;24 feature/behavior checks plus reachability, network-diagnostic capture and uncaught-error check|`stage-a-browser.json`|
|Source/migration/credential-pattern verification|PASS for the recorded scan rules; not a guarantee of detecting every possible secret format|`stage-a-change-verification.json`|

Focused/recovery counts overlap the full suites and must not be added to them. Initial support/UI fixture failures were corrected and final suites rerun. No failed test was silently skipped. The seven configured support departments now each have persisted routing coverage. Full migration repeatability was strengthened to assert the same seven ledger entries/checksums on a second guarded invocation.

## Real browser findings

Final source scan:252 changed/untracked text files,0 unresolved credential-pattern findings. One pre-existing VM-only synthetic localhost URL was explicitly reviewed/classified rather than silently ignored. Before/after production counts, core content fingerprints and schema columns all match in the recorded snapshots.

Screenshot qualification: the existing dummy-site header is crowded/clipped at1365px; it was not changed by StageA and remains a P2 host-page polish item. The widget fits, and390px body-overflow checks pass. Network diagnostics also record satellite tile requests cancelled during map movement; successful tiles were separately asserted, so cancellation is not described as a failed tile service.

Windows Computer Use was unavailable by platform URL policy; it was not retried in the recovery turn. Bundled Playwright browsers were absent, but the installed Playwright package successfully controlled the already installed Edge executable headlessly. This is genuine browser execution, not a DOM mock.

PASS: guest launcher/header, avatar rendering, real deterministic tuition response, dark mode, keyboard focus movement,390×844 guest overflow,390×844 Luka overflow, StudentB portal/current courses, outfit/glasses controls, bell/notice detail,1365×900 expansion, keyboard-labelled academic-table region, support consent/submission/private text upload, manual brief, confirmed reminder save, actual eligible tutor card/request, StudentA switch, selected tutor contact consent/acceptance,503 draft preservation/successful retry, typing indicator and logout during a paused request, service-worker registration/public-only cache, offline fallback/reconnection, map tiles, boundary/markers/library search/photo, chatbot View on Map selecting the library.

Browser diagnostics contain only host/path/error categories, not request headers/tokens. Expected ERR_ABORTED requests occurred during account/logout transitions. Final uncaught page-error list is empty. No HAR/auth traces or private-portal screenshots were stored. Sanitized guest screenshots: `stage-a-guest-desktop.png` and `stage-a-guest-mobile-dark.png`; inspected for visible layout. Browser JSON records results without academic response bodies or tutor contact values.

Remaining browser acceptance is BLOCKED by absent physical-device/suitable assistive tooling or not yet executed comprehensively: real mobile soft keyboard/installation, full Firefox compatibility, screen-reader certification, full focus trap/order audit, every avatar emotion/accessory permutation, GPS permission/denial on actual hardware, all map filter/pan/bottom-sheet gestures, every form's switching combination, multi-tab PWA upgrade lifecycle, and staff visual workflows. Automated negative/stale-response/security suites cover narrower corresponding contracts. The existing reduced-motion and table/focus tests pass; they are not full accessibility certification.

## End-to-end scenario matrix

|Area|Classification and executed evidence|Limits|
|---|---|---|
|Guest public information|PASS: deterministic programme/Advisor/tuition/campus/grounding regressions and real guest tuition UI; public source citations/provenance tests|Actual Groq quality and full live public RAG interaction BLOCKED/not exercised; safe no-source behavior retained. No private guest capability is implied.|
|Fixed Luka|PASS:35-course curriculum,22 historical/5 current/8 future, refresh/restart stability, CA/results/comparisons, ownership guards in full suite; current courses/table in browser|Fictional simulated records. No SIS integration. Real private account password/hash not exercised by this fixture.|
|Flexible StudentA|PASS: independent stored profile, renewal/stale-context/restart regressions and actual switch/tutor UI|No marks altered to qualify a tutor. No claim of complete approved curriculum for every programme.|
|Authentication/identity|PASS: synthetic login/demo alias stable subject, expired/forged token and cross-account request guards; browser logout clearing|No actual university/hosted account modified or logged in. Existing real private credential mapping is historical Phase1 evidence, not newly claimed here.|
|Timetable ingestion/diff|PASS: manifest integrity/head guards/duplicate suppression/group targeting tests using existing source rows|External Python extractor BLOCKED; a synthetic trusted-manifest fixture is not live scraper proof. Class-group/term uncertainty remains explicit.|
|120-second demonstration|PASS: real wall-clock120303ms final run; applied event only for target; one restoration after repeated settlement; original file hash and accepted fingerprint unchanged|Local SQLite only; no production override or browser real-time lifecycle assertion.|
|Unified inbox|PASS: ticket/timetable/peer/reminder/announcement receipts/count/ownership persistence tests; bell and notice in browser|No guaranteed sleeping-backend/background delivery. Bounded announcement window, not an unlimited historic total.|
|Digital Front Desk|PASS: all7 department assignments/fallback; contact consent/omission, staff queue/reassignment/reply/note privacy, student notification, upload validation/isolation/compensation; browser submits and uploads|Synthetic contacts only. Real Luka contact setup, antivirus and hosted Storage remain external prerequisites.|
|Peer tutoring|PASS: voluntary offer, actual passed-course selection, visibility/availability, selected-only request, acceptance/decline/privacy/isolation, restart and UI acceptance|No grades/eligibility badges disclosed. No broadcast/rating/payment/messaging added.|
|Brief/reminders|PASS: manual/automatic opt-in, Lusaka06:00–11:59, daily claims, idle gating, restart, date/confirmation/edit/complete/cancel/due settlement and bell; actual brief/reminder UI|Claim is at-most-once, not guaranteed displayed after a lost response. Lazy due settlement after wake; no exact-time offline notification.|
|Phase7 publications|PASS: signed-admin drafts/review/publish, period/cohort/owner targeting, expiry/revision/cancel, source/access/contact rules and receipts; browser notice|Current real calendar/exam/notice/consultation feeds BLOCKED. Local labelled fixtures validate contracts only.|
|Study/facilities|PASS: existing hybrid search/AI-mode contract, privacy exclusions, resource provenance, unavailable inference, tutor handoff; dated facility caveats/map actions|Generated education is not official notes/exams. No live Groq quality evaluation. Facility observations are dated, not current operational guarantees.|
|PWA/offline|PASS: actual SW registration/public cache/fallback/reconnect plus full policy tests denying private caching/replay|Public status/branding only. Installation eligibility/prompt and device-specific icon/update behavior remain unverified.|
|Pedestrian navigation|DEFERRED|No invented distances, walking times, paths or entrances. Existing unavailable-route handling tested; not a routing release.|

## Cross-feature routing

All14 requested example questions were submitted to actual local POST /api/chat using stored profiles. `stage-a-api.json` records subsystem and elapsed time, without private answers. Routes: Java explanation→study; teach Java→peer; courses/results/next class/timetable changes→academic; personal fee help/create support request→support; tutoring requests→peer; morning brief→brief; reminder→reminder; exams→academicInfo; library location→navigation; library hours→facility. General inference/search were deterministic substitutes for this matrix; routing, identity, HTTP, persistence and structured metadata were real. Measured local per-question times are bounded diagnostic samples, not hosted performance/SLA or live-model latency.

## Security, privacy and failure behavior

PASS through executed suites: signed owner/session guards; forged owner rejection; expired/invalid auth; cross-student academics/reminders/tutoring/contacts/tickets; staff departmental queues and reassignment restrictions; guest separation; publication admin-only gates; source audience/exam-schedule exclusions; attachment MIME/magic/size/quota/path/active-content checks, fail-closed configured scanner, protected downloads; malicious HTML rendered as text/sanitized; generic private-history placeholders; bounded actions/reference IDs; token/profile/generation checks on stale responses; API origin/rate/input controls; public-only service worker. Bearer headers, not ambient auth cookies, carry these feature requests; CORS is an origin control, not a substitute for owner authorization. Full suite includes negative/expired-token tests and application rate/validation configuration; no intrusive production attack was attempted.

Failure cases executed include unavailable inference, missing publication/timetable evidence, private Storage/disk failure, database finalization failure/compensation, aborted old requests, invalidated drafts, duplicate confirmation/operation IDs, competing reminder updates, concurrent daily claims and separate-process restart. Actual browser503 warm-up/retry preserves the draft and actual paused-request logout clears old output. A universal database-outage/physical offline/full multi-tab product certification is not claimed. Current host Render cold wake-up and Supabase request latency were not measured.

## Database, production metadata and recovery

Local PASS: guarded001–007 application in isolated PGlite; repeat checksums/ledger; FKs/indexes/constraints/RLS/grants; runtime versus anon/admin-denial cases; missing-index/changed-checksum/data-drift/SQL-error rollback;29-table capture/restore and fingerprint/schema comparison. The29 tables are: conversations, feedback, staff_answers, tickets, chat_sessions, ticket_events, ticket_assignments, knowledge_records, managed_documents, schema_migrations, ticket_notification_reads, timetable_publications, timetable_changes, timetable_subscriptions, timetable_notification_reads, timetable_demo_overrides, support_contact_profiles, ticket_support_details, ticket_attachments, peer_tutor_profiles, peer_tutor_courses, peer_tutor_requests, peer_tutor_events, brief_preferences, brief_deliveries, personal_reminders, reminder_events, academic_publications, academic_notice_reads.

Read-only production PASS: correct project qhnspcstqvazxkqshuir; repeatable-read read-only transactions; verified client TLS1.3; privileged inspection role postgres; distinct unilus_backend verified read-only and current core permission checks pass. The pooler's upstream pg_stat_ssl entry reports no SSL; that is not the client→pooler TLS session, which was separately verified authorized TLS1.3. Production ledger has001/002 only. Pending003–007 must NOT be assumed applied. `stage-a-production-metadata.json`, `stage-a-production-extra.json`, `stage-a-runtime-readonly.json`, `stage-a-production-after.json` and comparison JSON contain sanitized metadata/counts/fingerprints only.

Observed counts: conversations146,feedback0,staff_answers2,tickets17; no duplicate active-ticket groups. Knowledge1447,managed documents2,chat sessions49,ticket events14,assignments4,read receipts0,ledger2. Core fingerprints/counts/schema comparison across the two StageA read-only snapshots is recorded separately; this does not lock the database or guarantee absence of later external writes. No record contents were fetched.

Unexpected notifications:9 columns,1 row (contents not read), no description/user trigger establishing purpose, RLS off. Effective SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER are all false for anon/authenticated/unilus_backend; true for service_role. It is not consumed by this integration, is outside the29-table scope, and must not be deleted or repurposed. Its shared-project owner must clarify purpose. No current anonymous exposure was demonstrated by these privilege checks.

Storage metadata: existing unilus-private-documents is private;26,214,400-byte bucket limit; allowed application/pdf,DOCX,text/plain,text/html. PNG/JPEG are absent, incompatible with this attachment adapter's image Content-Type uploads. Local image validation passes; hosted image acceptance is BLOCKED pending an explicitly approved private Storage configuration decision. Nothing was uploaded or reconfigured.

Recovery qualification: logical backup/rehearsal captures database rows, ledger, relational schema/indexes/constraints/RLS/grants/sequences. It does not by itself capture Auth configuration or private object bytes. Profile objects (fixed and flexible), ticket attachment bytes and managed knowledge objects require separate private-object inventory, matching checksums/keys and recovery tests. The local29-table test verifies synthetic attachment bytes separately; it is not complete cloud object recovery. Existing encrypted backups were neither deleted nor overwritten. No independent off-machine disaster recovery claim is made; the owner's accepted demonstration-stage deferral remains recorded.

## Remaining owner checks and Stage A stop

Use the isolated Firefox origin printed by the helper; never the public hosted site for synthetic writes. Select `/stage-a/b` and `/stage-a/a`. Check light/dark chat, expand/close, all avatar controls/emotions; keyboard Tab/Shift+Tab/Escape and visible focus; screen-reader labels/status announcements/table scrolling;390×844 or actual phone soft keyboard; bell/details/back focus; consent/omit/edit support contacts and uploads; staff queue/reply/internal-note boundaries; tutor decline/reselect/contact revoke; reminder edit/cancel/complete and brief opt-out; switch accounts during each unfinished form and delayed response. Verify no prior identity/contact/table remains. Test PWA installation/update, offline public fallback and no private cached pages. Check GPS allow/deny/unavailable, map filters/zoom/pan/recenter and mobile detail-sheet close. Record screenshots only of synthetic or public data. User actions that require real device permissions remain owner-controlled.

Do not run production migrations, push or deploy from these instructions. Report25 separates actual release blockers from desirable follow-ups. Stage A is complete within the permitted evidence scope; await explicit Stage B authorization.
