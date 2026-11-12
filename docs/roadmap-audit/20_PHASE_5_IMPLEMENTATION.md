# Phase 5 — Peer tutor implementation

Date: 2026-11-11, Africa/Lusaka. Local implementation; no commit, push, deployment, remote migration, credential access or production write. Phase4 remains explicitly deferred. Phase6 has not started. Existing uncommitted Phases1–3 are preserved. Current implementation supersedes historical proposals for verification/eligibility badges in08: none are displayed.

## Completion and architecture

Chatbot-led opt-in tutor management, course discovery, tutor cards, one-to-one confirmed requests, acceptance/decline, independent contact sharing, request lifecycle and the existing unified inbox are integrated locally. This is a simulated academic demonstration, not official UNILUS accreditation or enrolment verification. No new provider, framework, package, separate website, bell, poller, push service, payment system, public ratings or messaging platform was introduced.

Reused services: demoAcademicService/academicContextService records and profile ownership; undergraduateAcademicPolicy grade mapping; existing programme mappings and bit-curriculum-v1; signed attachUser/authService identity; db transactions; existing private academic Storage; chatService/chatRoutes/widget orchestration; notificationService and existing bell lifecycle; guarded migrationService/postgresOperations/logicalBackup/rehearsePortableBackup.

## Internal eligibility and account identity

peerTutorService.passed uses the server's current academic model, explicitly completed periods, canonical course codes and an integer final mark whose existing policy grade exactly matches the recorded passing grade. Missing/unknown/inconsistent/failed/uncompleted or not-examined results fail closed. It introduces no threshold or alternative grading policy. Eligibility choices return code/title only. Grades, marks, transcripts, student numbers and academic verification indicators are not part of tutor cards.

Both flexible and fixed accounts retain their existing stable authentication identifiers. Luka's identity remains unilus-demo-student-b (demo alias); StudentA remains unilus-demo-student. No account/profile ownership was migrated, real transcript was changed or marks fabricated to qualify a real demonstration account. Unsupported academic history produces a clear refusal rather than creating a fake academic record.

Profiles store a SHA256 academic snapshot/version reference. Registration and course updates validate completed records. Discovery and request creation revalidate current offered courses against a non-mutating existing academic snapshot; the profile renewal hook removes invalid offers immediately, preserving requests and stable ownership. The non-mutating snapshot avoids recursively acquiring academic locks during chat or cross-student discovery. Academic reads occur before DB locks, then a version comparison prevents an older validator overwriting a newer saved offer. Per-page validation is bounded to11 candidates; no full tutor database is sent to Groq. This favors fresh validity over caching and can entail private snapshot reads for each candidate on a cold/remote page; production latency remains unmeasured.

## Registration, visibility and course matching

Natural prompts open inline controls, e.g. become a tutor, show my tutoring profile, hide my tutoring profile or stop accepting students. Opening the form makes no profile write. Saving explicitly confirms opt-in and validates up to12 offered courses, a400-character plain-text introduction, visibility and availability. Recognizable email/phone contacts and active HTML are rejected in introductions. Profile fields are derived from authenticated academic context, never client usernames or student numbers.

States are hidden, visible/unavailable, and visible/accepting. Discovery returns only current visible/accepting offers, excludes self, uses stable creation-time/ID ordering and pages of10. Removal hides the profile and removes offers, retaining connection history. Existing pending requests remain manageable after hiding or becoming unavailable; terminal requests remain readable by participants. No new request may target a currently hidden/unavailable offer.

Course resolution reuses the existing catalogue assembled from established mappings, including shared BIT/BBA/AFIN codes. Exact code takes priority. A small subject matcher maps database normalization, Java, PHP/server-side and data structures to existing course titles, not new invented courses. General title matches can return choices; a unique current registration may disambiguate. Unknown codes ask clarification. BIT301 keeps the established E-Business and Enterprise Information System identity; Decision Support Systems is not silently introduced as its alias. Vague programming requests offer supported choices.

Ordinary 'What is database normalization?' remains ordinary academic assistance. Explicit peer help and supported natural subject-help requests invoke discovery. Fee/tuition and support-ticket requests are excluded. No-tutor results honestly return an empty list and offer ordinary explanation; they do not seed fictional tutors or create tickets. Unsupported account history is handled without Groq. Structured peer data is forwarded by chatRoutes, not merely produced in an unreachable service.

## One selected tutor and lifecycle

Students choose a card, review the selected tutor/course, optionally enter a bounded600-character message, then explicitly confirm. The server accepts a tutor profile ID and canonical course, derives requester identity from the token, verifies the current offer, prevents self-request and rejects forged ownership fields. It creates exactly one request and one selected-recipient event. No fan-out, automatic assignment or bidding exists.

A unique requester/operation ID supports retries. Changed replay payloads are rejected. At most one pending request per requester/course is enforced by both transaction logic and a PostgreSQL partial unique index. Maximum10 requests per requester per rolling24 hours plus the existing120/minute IP API limiter limit abuse. SQL transactions, a shared peer-write advisory lock in PostgreSQL, SQLite serialization and conditional pending updates protect concurrent transitions. Messages and introductions are bounded, plain text and reject recognizable contact details; request messages are never sent to a general LLM.

Legal transitions: pending→accepted, declined, cancelled or expired. Tutor only accepts/declines; requester only cancels. Terminal requests cannot change to another decision. Identical terminal retries do not duplicate events. Expiry defaults to72 hours, configurable with PEER_TUTOR_REQUEST_HOURS clamped1–168 hours. Persisted expiry timestamps are settled on request/inbox access without timers or always-on workers. Acceptance conditionally checks that expiry has not passed. Expiry notifications appear when the sleeping backend resumes and serves the relevant workflow; no offline delivery guarantee is claimed.

## Independent contact consent and privacy

Acceptance requires the selected tutor to enter exactly one email or phone value and explicitly consent to that sharing. It reuses only the Phase3 validation function, never its contact defaults, private configuration or saved profile values. Contact acceptance and notification creation commit atomically. Accepted detail discloses the chosen value only to the requester and tutor; unrelated students/staff/guests cannot read it. Decline/cancel/expiry disclose no contact.

No actual Luka contact file was read/imported or copied. Public cards and notification previews contain no contact or private request message. General chatbot history receives peer-interaction placeholders; request/contact data stays in dedicated authorized endpoints and structured UI, outside RAG/model context. Tutor withdrawal clears the stored contact value and removes future API access while retaining accepted request history. Already copied details cannot be remotely erased. Profiles/requests/events are retained; no automatic destructive retention policy or account-record deletion is implemented.

## Existing unified notifications and frontend

peer_tutor_events persists recipient-specific requested/accepted/declined/cancelled/expired events and read_at. This category-specific event source fits the existing ticket/timetable inbox composition; it is not a new general notifications platform and does not touch remote public.notifications. Unique request/recipient/kind prevents duplicate events. The same notificationService merges counts/items and routes peer: read receipts. The existing bell's30-second lifecycle is reused without a new poller. Generic previews show course and status only. Opening a peer item uses the authorized request detail inside the existing widget; failed detail loads are not acknowledged as read.

peer-tutors.js renders management, course choices, compact tutor cards, profile expansion, explicit request confirmation, incoming requests, acceptance contact selection, decline/cancel, status and withdrawal. Declines offer other tutors for the stored course and exclude the declined tutor from that result presentation. More-result paging is bounded. All text uses textContent and controls retain mobile wrapping/visible keyboard focus. No badges, verification checks, grade ranking or contact defaults appear.

Account/profile context is captured for asynchronous work; logout/context change aborts requests and clears registered private tutoring roots, including contact displays. Detached controls cannot submit under a new identity. Existing chat account cleanup and notification cleanup remain in place. Avatar, settings, map, notifications and academic table systems were not replaced.

## Database and security

Local-only005_peer_tutors.sql adds four tables: peer_tutor_profiles (unique stable owner), peer_tutor_courses (profile FK and unique course offer), peer_tutor_requests (profile FK, status constraint, idempotency and single-pending constraint, consented contact snapshot) and peer_tutor_events (request FK, recipient/event uniqueness and read receipt). All records have stable text IDs; existing file-backed auth owners intentionally have no invented database-user FK.

RLS is enabled. PUBLIC/anon/authenticated direct access is revoked. unilus_backend has SELECT/INSERT/UPDATE on these tables and DELETE only on replaceable course offers; it does not own tables. Application signed-owner predicates enforce per-student privacy, since the backend role is shared. The guarded runner calls peerTutorSchemaCheck to verify columns/types, keys/FKs, indexes/partial pending constraint, policies and effective grants. Migrations001–004 remain hash-identical. No SQL was applied remotely and no unrelated table was repurposed.

Logical inspection/capture/restore explicitly includes these four tables after their dependencies. The recovery validator allows only the precise new peer-request status CHECK expression, retaining refusal for unknown schema dependencies. Isolated recovery verifies23 tables with original/support/timetable plus tutor profiles/offers/requests/contact/events, indexes, policies, grants and fingerprints. Runtime/anon access denial, FK failure and immutable request deletion restrictions are exercised. A deliberately missing peer_one_pending index now causes the guarded runner to refuse and roll back before the valid bundle is applied in the isolated fixture. Existing backups remain untouched. This is isolated synthetic recovery evidence, not proof of complete hosted disaster recovery.

## Automated evidence and defects corrected

- phase5-focused.txt:20/20 focused backend, real HTTP chat/request acceptance and isolated migration/recovery tests.
- phase5-widget-focused.txt:7/7 focused UI tests.
- phase5-backend-full.txt:486/486 passed, zero failures/skips.
- phase5-widget-full.txt:157/157 full widget tests.
- phase5-build.txt: production build passed,19 transformed modules.
- phase5-syntax.json:273/273 passed, including the generated bundle. phase5-change-manifest.json:23 Phase5 source/test/generated files, no removed baseline files, migrations001–004 unchanged, zero changed-file credential-pattern findings.
- phase5-final-validation.json: consolidated final results.

Synthetic fixtures create only isolated temporary profiles/databases/objects; no production tutors or real academic marks were inserted. The actual chat acceptance test exercises existing signed authentication and withChat locking, discovery cards, selected request, tutor notification, unauthorized acceptance denial, accepted contact isolation, existing inbox/read receipt and flexible profile renewal. A separate Node process verifies persisted request history. Other tests cover completion/grade failure, hidden/unavailable states, duplicate/replayed/self requests, concurrent acceptance/cancellation, expiry, quota, contact withdrawal and private-history placeholders.

Development checks caught and corrected: the backup validator initially rejecting the new status CHECK; the chat route initially not forwarding structured peer metadata; recursive/cross-owner academic locking during discovery/management; database/profile lock-order inversion; a missing guarded-runner hook caught by the final wiring check (now covered by a rollback test); and unsupported academic history surfacing a generic AI-service error. Final results supersede intermediate diagnostic logs. No existing tests were weakened to hide a regression.

Manual browser/mobile/visual acceptance is intentionally deferred by owner. Automated DOM/source checks do not establish visual acceptance, actual mobile rendering, real account interactions or hosted performance. No hosted/production acceptance is claimed.

## Exact Phase5 source changes

- dummy-environment/chatbot-widget/widget.css
- backend/app.js
- dummy-environment/chatbot-widget/app.js
- backend/migrations/005_peer_tutors.sql
- dummy-environment/js/ticket-notifications.js
- backend/routes/peerTutorRoutes.js
- backend/routes/chatRoutes.js
- dummy-environment/chatbot-widget/tests/peer-tutors.test.cjs
- dummy-environment/chatbot-widget/peer-tutors.js
- dummy-environment/chatbot-widget/main.js
- dummy-environment/chatbot-widget/dist/chatbot-widget.js
- backend/services/chatService.js
- backend/services/demoAcademicService.js
- backend/services/logicalBackup.js
- backend/services/migrationService.js
- backend/services/notificationService.js
- backend/services/peerTutorSchema.js
- backend/services/peerTutorSchemaCheck.js
- backend/services/peerTutorService.js
- backend/tests/peerTutors.test.js
- backend/tests/peerTutorRecovery.test.js
- backend/tests/peerTutorChat.test.js
- backend/services/postgresOperations.js

Documentation additionally updates00,03,08,11,12,13,14,15 and creates this20 plus phase5 evidence artifacts. The Phase5 baseline distinguishes this delta from pre-existing Phase1–3 uncommitted files. No baseline source file was removed.

## Future release requirements and Phase6 handoff

Later production release requires separate authorization, reviewed new migration bundle/fingerprints/backups and the existing guarded runner; do not reapply or edit001–004. Preserve private Storage academic records, restricted runtime role, signed owner identity and existing HTTPS/CORS configuration. No peer-specific external key or paid resource is needed; request lifetime is optional environment configuration. Validate consolidated hosted and visual/accessibility/mobile acceptance before release. Production latency of private academic snapshot revalidation is not yet measured.

Eligibility is limited to existing reliable server-owned demonstration academic history. A real university academic integration remains outside this phase; unsupported histories fail closed. No actual demo account was force-enrolled as a tutor. Course topic matching is deterministic and intentionally conservative; ambiguous or unsupported wording asks clarification. No delivery is promised while Render sleeps. Requests/history and withdrawn-contact audit timestamps remain retained until an separately authorized retention policy exists.

Phase5 is ready for local handoff once final checks below pass. Phase4 remains deferred. Do not begin Phase6 Morning Brief, commit, push, migrate or deploy without the owner's next instruction. Read this report and final evidence before continuing; preserve all current work.

## Final verdict

Phase5 is locally complete:486 backend tests,157 widget tests,273 syntax checks and production build passed. Focused20 backend and7 UI tests are included in the full totals, not additional independent test counts. Isolated23-table migration/restore and missing-index rollback tests passed. HEAD remains9cbdeb0517da8820b94a623d9b8facbef50ae1ee. Credential scanning is pattern-based, not an absolute guarantee. No commit/push/deployment/production migration or production data write occurred. Manual visual/mobile and hosted performance acceptance remain unverified by design; no official academic verification is claimed. Continue only under the owner's next instruction, leaving Phase4 deferred and Phase6 unstarted.
