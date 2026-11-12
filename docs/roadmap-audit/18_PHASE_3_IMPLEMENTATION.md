# Phase 3 — Digital Front Desk implementation

Date: 2026-11-11. Status: local implementation and automated verification; no production changes. Phase 4 has not started. All existing Phase 1/2 work is retained. No commit, push, deployment, private credential access or cloud writes were performed.

## Reused workflow and routing

The existing support draft, session ownership, ticket service, staff workflow, private Supabase Storage adapter, administrative knowledge upload pipeline and unified notification inbox remain the foundation. No separate authentication, helpdesk, polling loop, email/SMS sender or notification framework was introduced.

One shared directory, dummy-environment/js/support-departments.js, supplies backend routing and staff UI names. Existing departments are Registry, Academic Office, Finance Office, ICT Support, Admissions Office, Student Affairs and Library. Known aliases are normalized. Distinct matched keywords avoid counting fees and fee twice; tied or unmatched classifications fall back explicitly to Registry. Unknown assignment names fail closed. Department and initial ticket_assignments row are inserted together; department filtering happens before queue limits. Admin reassignment remains supported and permission changes take effect on subsequent requests.

## Private contact defaults and consent

backend/services/supportContactService.js stores support defaults separately from simulated academic profiles. Signed stable usernames control ownership. Defaults can be reviewed, edited, saved or cleared; ticket sharing is separately unchecked by default. A ticket snapshots only the explicitly consented email/phone or records omission. Defaults are not rewritten by sign-in or academic regeneration. Student A receives no Student B defaults. Guests may consent to contact sharing without gaining a student identity; attachment access retains the existing exact, unexpired guest-session capability requirement.

The actual owner email/mobile screenshots were not available in this attachment/workspace. No real contact values were invented, embedded or imported. To associate the approved values with Luka, prepare a private JSON file outside the repository, for example C:\UNILUS-secrets\student-b-support-contact.json. Set SUPPORT_CONTACTS_FILE to that path in the server's private environment. Required fields: owner equal to unilus-demo-student-b, supportContactAuthorized equal to true, email, and phone. Include only those purpose-authorized contact values. The signed Student B contact-profile request seeds them once if no saved row exists; subsequent edits/clearing win over the file. No real name, student number, NRC, balance or academic data is read from that file. Actual real-contact association remains pending this private configuration; synthetic persistence/isolation is verified.

Validation covers length, controls/HTML, email structure, Zambian 07/09 or +260 mobile formats and international E.164. Contact-shaped text is redacted from incoming chat and persisted/retrieved general history; private form data uses a separate API, never a chatbot prompt. Staff contact access requires the existing signed role and matching canonical department, or admin. Public ticket views, general RAG and notification previews omit contacts. No email/SMS sending is implemented.

All public ticket creation uses ticketSubmissionService: owned session, explicit consent, bounded issue and optional contact validation. Direct callers now must send consent:true. Two older authorized API fixtures were updated accordingly; negative consent tests remain.

## Private attachments

frontDeskRoutes and ticketAttachmentService add owned ticket upload/list/download/removal and department-authorized staff downloads. Authorization happens before upload byte parsing or private file retrieval; downloads recheck current assignment after Storage retrieval. Object IDs and original/stored SHA256 are server controlled; responses expose safe metadata, not object keys or public links. Downloads force attachment disposition, no-store, nosniff and sandbox CSP.

Allowlist: passive PDF, PNG, JPEG and UTF-8 text. Default per-file maximum 3 MiB, server-configurable with hard cap 5 MiB, maximum five files and 10 MiB per ticket. The UI conservatively limits 3 MiB. Filename normalization/traversal guards, MIME/signatures, PDF active-content rejection, image decode/re-encoding and bounded pixels protect the path. No uploads enter the vector store or LLM.

Metadata reserves the exact private object key before upload. Duplicate operations/content are idempotent; quota covers pending/active/cleanup rows. Failed uploads compensate only that reserved object and retain failed or cleanup_pending metadata. Confirmed cleanup permits retry; owner removal hides bytes and retains metadata. Pending cleanup is not presented as successful. There is no unattended cleanup worker; interrupted pending/cleanup rows require authorized reconciliation. Closed tickets reject new attachments.

Production uses the existing private SUPABASE_DOCUMENT_BUCKET with support-tickets/v1 prefix and existing server-only Storage credentials. Local TICKET_ATTACHMENT_STORE_DIR is non-production only. Single-object DELETE is supported by the official Supabase Storage route (see source below). No bucket/policy changes were made.

Malware limitation: passive-format checks are not antivirus certification. Optional TICKET_ATTACHMENT_SCAN_COMMAND invokes a server-controlled executable with a fixed temporary file argument; TICKET_ATTACHMENT_REQUIRE_SCAN=yes fails closed if unavailable. No scanner was installed/configured. Files should be handled as untrusted downloads.

## Knowledge administration

Existing admin-only document upload/extraction/embedding/source replacement/search/deactivation is exercised against synthetic private object storage and isolated database/vector data. A failed metadata commit now attempts deletion of its newly uploaded object. Cleanup failures log a reconciliation requirement; a process crash between knowledge object upload and its DB commit remains a reconciliation risk. Existing document deactivation intentionally retains private source bytes; no new destructive retention policy was invented. KNOWLEDGE_TEST_WORK_DIR works only under NODE_ENV=test, avoiding corpus writes in these fixtures. Support attachments are never ingested as knowledge.

## Staff replies and notifications

Existing staff reply/status/note operations and unified bell/read receipts are reused. Authorized replies and resolution updates reach the owner; internal notes, contacts and attachment contents never appear in generic previews. Ticket detail adds authorized attachment controls. There is no new polling or push subsystem. Student UI asynchronous callbacks capture account/session context, rejecting late prefills and detached-form actions after identity changes. Module-scoped sendMessage is passed explicitly to the form callback.

## Schema and migration

The core ticket schema did not contain the four contact columns assumed in the task. Rather than alter previously applied/core-fingerprinted tables, additive 004_digital_front_desk.sql creates support_contact_profiles, ticket_support_details and ticket_attachments, including ticket FKs, attachment lookup index and uniqueness/idempotency constraints. Existing core rows and migrations001–003 remain untouched. RLS is enabled; PUBLIC/anon/authenticated receive no grants. Only unilus_backend receives operation-specific grants/policies: profile CRUD, immutable ticket-detail SELECT/INSERT, attachment SELECT/INSERT/UPDATE. It does not own the tables. frontDeskSchemaCheck validates table shape, key constraints, FKs, policies and effective grants within the guarded migration. No remote migration has been run.

Logical capture/recovery includes the three new tables, preserving dependency order, indexes, policies, grants and fingerprints. Isolated PGlite migration/recovery verifies 19 tables and denies unauthorized runtime/anon operations. Synthetic bytes are separately hash-checked from a copied in-memory object fixture. Database metadata recovery does NOT prove recovery of real Supabase Storage bytes. Existing backups were not touched; any later release needs a fresh coordinated database/private-object backup under the established approval process.

## Verification evidence

- phase3-focused.txt: 23/23 focused support/privacy/attachment tests, including guest ownership.
- phase3-knowledge.txt: 2/2 synthetic administrative lifecycle/compensation tests.
- phase3-recovery.txt: 1/1 isolated guarded migration and recovery test.
- phase3-widget-focused-final.txt: 4/4 focused widget tests.
- phase3-notification-regression.txt: 3/3 existing combined notification workflows after consent fixture update.
- phase3-backend-full.txt: 466/466 passed, zero failures/skips, including existing academic/tuition/Programme Advisor/campus/timetable/authentication regressions.
- phase3-widget-full.txt: 150/150, zero failures/skips.
- phase3-build.txt: production Vite bundle passed, 18 modules.
- phase3-syntax.json: 263/263 syntax checks passed, including the generated bundle.
- phase3-change-manifest.json: exact Phase3-only source changes against the preserved baseline, immutable migration checks and changed-file credential-pattern findings.

Initial backend sandbox run encountered localhost EACCES; the authorized host run reached fixtures successfully. Its two failures traced to one old direct-ticket fixture omitting newly required consent, with the second inbox assertion dependent on its missing ticket. The fixture was corrected rather than weakening consent. Earlier focused tests found and corrected fee/fees duplicate routing keywords and stale account-switch form callbacks. No unresolved automated failure should be inferred from superseded intermediate logs.

Manual/browser/visual acceptance is deliberately deferred until all seven phases per owner instructions; no browser verification is claimed. No hosted Storage, real contact configuration, antivirus or public deployment acceptance is claimed.

## Release prerequisites and limitations

Local code is prepared; this is not production release approval. Later steps: privately configure Luka's authorized contact file; review new004 and updated guarded bundle; validate fresh recovery coverage including actual private bytes; apply through the guarded runner only with separate production authorization; retain private bucket/server-only credentials and HTTPS; decide scanner/retention/reconciliation operations; execute consolidated browser/accessibility/mobile and hosted acceptance. Do not reapply001–003 or bootstrap knowledge. Existing unexpected remote notification schema from prior audit is untouched; no fresh cloud schema claims are made here.

## Exact Phase3 source files changed

- backend/app.js
- dummy-environment/chatbot-widget/app.js
- dummy-environment/chatbot-widget/widget.css
- dummy-environment/js/admin.js
- dummy-environment/js/admin-ticket-service.js
- dummy-environment/js/ticket-notifications.js
- dummy-environment/js/support-departments.js
- backend/migrations/004_digital_front_desk.sql
- dummy-environment/chatbot-widget/front-desk.js
- backend/routes/supportRoutes.js
- backend/routes/frontDeskRoutes.js
- dummy-environment/chatbot-widget/main.js
- dummy-environment/chatbot-widget/tests/front-desk.test.cjs
- backend/tests/frontDeskRecovery.test.js
- backend/tests/frontDeskKnowledge.test.js
- backend/tests/frontDesk.test.js
- backend/services/chatService.js
- backend/tests/unifiedNotificationIntegration.test.js
- backend/tests/integrationSecurity.test.js
- backend/services/ticketWorkflowService.js
- backend/services/ticketSubmissionService.js
- backend/services/ticketAttachmentService.js
- backend/services/supportService.js
- backend/services/supportConversationService.js
- backend/services/supportContactService.js
- backend/services/sessionService.js
- backend/services/postgresOperations.js
- backend/services/migrationService.js
- backend/services/managedKnowledgeService.js
- backend/services/logicalBackup.js
- backend/services/knowledgeUpdater.js
- backend/services/frontDeskSchemaCheck.js
- dummy-environment/chatbot-widget/dist/chatbot-widget.js

Documentation additionally updates 00,03,06,11,12,13,14,15 and creates this18 plus Phase3 evidence artifacts. Prior Phase1/2 uncommitted files listed by Git are not all Phase3 changes; use the baseline manifest to distinguish them.

Official Storage endpoint reference: [Supabase single-object deletion route](https://github.com/supabase/storage/blob/master/src/http/routes/object/deleteObject.ts).

## Final local verdict

Phase3 code and automated verification are locally complete (466 backend,150 widget,263 syntax; production build passed). The focused suites are included in the backend/widget totals and must not be added again. The changed-file pattern scan found no matching secrets across33 source/test/generated files; this is pattern-based verification, not an absolute secrecy guarantee. No baseline file was removed, migrations001–003 hashes match, and HEAD is unchanged. Full machine-readable results are in phase3-final-validation.json. Real contact import, scanner configuration, actual Storage-byte recovery and consolidated visual/hosted acceptance remain explicitly unverified. These are release follow-ups, not claims of completed production integration.
