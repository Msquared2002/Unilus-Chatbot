# Database and data sources

> **Phase 1 implementation update (2026-11-10):** Read [the implementation delta, fresh tests and remaining acceptance gates](16_PHASE_1_IMPLEMENTATION.md) before using this historical audit snapshot. Fixed profile, automatic import adapter, persisted override and widget inbox are now implemented locally; no production release or browser acceptance is claimed.


Audit: **2026-11-10, Africa/Lusaka**. Local HEAD `9cbdeb0517da8820b94a623d9b8facbef50ae1ee`, branch `codex/production-integration`, **with pre-existing uncommitted unified-notification work**. Source findings describe that working tree unless explicitly marked production. Documentation only; no implementation/release authorized. [Master](00_MASTER_AUDIT.md) · [Evidence freshness](14_DECISIONS_AND_ASSUMPTIONS.md)

## Current PostgreSQL inventory
Fresh metadata-only connection used postgres in repeatable-read READ ONLY; no student contents/counts/fingerprints were retrieved. [database-metadata.json](database-metadata.json) contains exact columns/types/nullability, constraints, indexes, policies, selected grants, role flags and ledger.

### chat_sessions

Columns: `id` (text, required), `owner` (text, required), `created_at` (text, required), `expires_at` (text, required).

Constraints: `PRIMARY KEY (id)`. Indexes: `chat_sessions_pkey`.

### conversations

Columns: `id` (integer, required), `session_id` (text, required), `role` (text, required), `content` (text, required), `created_at` (text, required).

Constraints: `PRIMARY KEY (id)`. Indexes: `conversations_pkey`, `idx_conversations_session`.

### feedback

Columns: `id` (integer, required), `session_id` (text), `rating` (text, required), `comment` (text), `created_at` (text, required).

Constraints: `PRIMARY KEY (id)`. Indexes: `feedback_pkey`.

### knowledge_records

Columns: `id` (text, required), `payload` (text, required).

Constraints: `PRIMARY KEY (id)`. Indexes: `knowledge_records_pkey`.

### managed_documents

Columns: `id` (text, required), `source_name` (text, required), `object_key` (text, required), `access` (text, required), `title` (text), `active` (integer, required), `created_at` (text, required).

Constraints: `PRIMARY KEY (id)`. Indexes: `idx_documents_source`, `idx_managed_active_source`, `managed_documents_pkey`.

### notifications

Columns: `id` (integer, required), `kind` (text, required), `title` (text, required), `body` (text), `audience` (text, required), `session_id` (text), `ref` (text), `created_at` (text, required), `user_id` (text).

Constraints: `PRIMARY KEY (id)`. Indexes: `idx_notifications_created`, `notifications_pkey`.

### schema_migrations

Columns: `version` (text, required), `checksum` (text, required), `applied_at` (text, required).

Constraints: `PRIMARY KEY (version)`. Indexes: `schema_migrations_pkey`.

### staff_answers

Columns: `id` (integer, required), `question` (text, required), `answer` (text, required), `visibility` (text, required), `active` (integer, required), `times_used` (integer, required), `source_ticket` (text), `created_at` (text, required), `updated_at` (text, required).

Constraints: `PRIMARY KEY (id)`. Indexes: `staff_answers_pkey`.

### ticket_assignments

Columns: `ticket_ref` (text, required), `department` (text, required), `assignee` (text).

Constraints: `PRIMARY KEY (ticket_ref)`. Indexes: `ticket_assignments_pkey`.

### ticket_events

Columns: `id` (integer, required), `ticket_ref` (text, required), `kind` (text, required), `body` (text, required), `actor` (text, required), `visibility` (text, required), `created_at` (text, required).

Constraints: `PRIMARY KEY (id)`. Indexes: `idx_ticket_events_ref`, `ticket_events_pkey`.

### ticket_notification_reads

Columns: `owner` (text, required), `event_id` (integer, required).

Constraints: `FOREIGN KEY (event_id) REFERENCES ticket_events(id)`; `PRIMARY KEY (owner, event_id)`. Indexes: `ticket_notification_reads_pkey`.

### tickets

Columns: `id` (integer, required), `ticket_ref` (text), `session_id` (text, required), `question` (text, required), `summary` (text, required), `history_json` (text, required), `category` (text, required), `priority` (text, required), `department` (text, required), `contact_id` (text), `status` (text, required), `created_at` (text, required), `updated_at` (text, required), `student_email` (text), `student_phone` (text), `contact_status` (text), `student_username` (text), `resolved_notified_at` (text).

Constraints: `PRIMARY KEY (id)`; `UNIQUE (ticket_ref)`. Indexes: `idx_ticket_active_question`, `idx_tickets_session`, `idx_tickets_status`, `tickets_pkey`, `tickets_ticket_ref_key`.


## RLS/runtime interpretation
All integrated tables and schema_migrations have RLS enabled, forceRLS false. Extra public.notifications has RLS disabled. unilus_backend has no SUPERUSER/BYPASSRLS/CREATEROLE/CREATEDB/INHERIT and no role memberships. Core policies allow trusted backend USING true/WITH CHECK true; ticket receipts permit SELECT/INSERT. Server ownership and department predicates enforce per-student access; RLS does not distinguish application students sharing this role. No selected anon/authenticated/unilus_backend grant appears for unexpected notifications. Broader PUBLIC/default/function/sequence effective ACLs remain unverified. Its purpose/owner must be clarified before any change.

## Authority and provenance
| Data | Authority/persistence | Important distinction |
|---|---|---|
|Authentication|Private AUTH_USERS_FILE, scrypt/JWT|Demonstration accounts, not real SIS/Supabase Auth|
|Sessions|chat_sessions owner tied to signed username; guest UUID capability|Body/student label cannot choose owner; guest expiry differs from signed ownership|
|Conversation/ticket/feedback/staff events|PostgreSQL production, SQLite tests|Conversation logs are not durable applicant or academic memory|
|Academics|Private bucket demo-academics/v1/owner-hash/active.txt|Random generated/versioned simulation; GET can write; no SQL academic transcript tables|
|Timetable base|backend/data/timetable/timetable.json + search_index.json|3296 rows,1132 lecturer-only; weekly sessions not registration or full curriculum|
|Accepted timetable|Local003 snapshots/head/changes/subscription/read tables|Absent fresh production schema; current manual subscriber design superseded by Phase1 plan|
|Knowledge|knowledge_records payload/embedding + managed_documents/private objects|Local index1447 records; remote count not inspected this audit|
|Tuition|Verified structured schedule data and original PDFs|Local48 schedules, exact year/category/currency/provenance; no rebootstrap needed|
|Programme rules|Catalogue/verified admissions evidence/coverage|Evidence gaps must remain unknown, not guaranteed eligibility|
|Campus|Versioned JSON/GeoJSON/photos|23 places/37 buildings, no verified walking graph access|

## Migrations and adapter
Fresh ledger confirms001_integrated_core.sql and002_ticket_notification_reads.sql; exact checksums in metadata.003_timetable_notifications.sql is local only. Current working-tree bundle c9b1d7026477f5d5b9bf8c40c31f7b6c3908d9a817c5148442454493efd27cab is evidence, not execution approval. Applied001/002 immutable. Rework unpublished003 only after fresh-ledger/review check; no cloud writes in audit. db.js uses Node24 SQLite locally and pg with verified CA/hostname TLS, Session pooler5432/small pool in production. Startup must not perform DDL.

## Python and update architecture
backend/README.md describes external unilus_timetable: source discovery, HTML grid reconstruction, lecturer/student parsing, token normalization, provenance/conflict merging, validation, index export. Python source/tests were not found in the inspected integration tree; GIS Python tools are unrelated. Cannot verify actual scheduling/extractor error behavior. Expected outputs timetable.json/search_index.json feed Node's indexed timetableService. timetableUpdater validates weekday/time/course, limits invalid-row drops, rejects severe shrinkage and safely swaps local files. No mounted automatic authoritative upstream refresh integration was found. Local publication service is a separate manual accepted-snapshot path.

Needed contract: authenticated complete-import manifest with academic period/source URLs, extraction success/errors, coverage/completeness, source count, version/hash and timestamp. Failure/partial scrape must retain previous accepted head, never publish false removals. Accepted PostgreSQL head should become runtime truth; JSON is staged input/bootstrap/cache. No indiscriminate SQL triggers.

## Exact locally proposed 003 schema (not deployed)

Source: [003_timetable_notifications.sql](../../backend/migrations/003_timetable_notifications.sql).

| Table | Columns and integrity | Intended privileges |
|---|---|---|
|timetable_publications|id PK; revision UNIQUE; period, fingerprint, snapshot_json, previous_id FK to publications, published_at, source|Backend SELECT/INSERT only|
|timetable_changes|id PK; publication_id FK; scope, payload, created_at; index(scope,created_at)|Backend SELECT/INSERT only|
|timetable_subscriptions|owner PK; period, scope; currently one subscription per owner|Backend SELECT/INSERT/UPDATE/DELETE|
|timetable_notification_reads|owner,change_id composite PK; change_id FK to changes|Backend SELECT/INSERT only|

All four enable RLS, revoke PUBLIC/anon/authenticated/backend privileges then grant listed permissions with role-specific policies. Publications are immutable; the latest revision represents the accepted head—there is no separate head table. The new roadmap must replace subscription-required targeting without weakening publication/receipt protections. Override and automatic profile eligibility storage are proposals, not part of current003.

## Storage and backups
Fresh metadata: one private bucket unilus-private-documents. Managed institution uploads and simulated profile objects use server-only private access; no bucket/key changes. Ticket attachments have no implemented owned lifecycle.

logicalBackup.js tablesFor accepts historical CORE or fixed APPLICATION+ledger; APPLICATION omits ticket_notification_reads, future003 tables and extra notifications. validateSnapshot rejects unsupported foreign keys; recovery scope must evolve explicitly before related migrations. Existing isolated recovery reports are historical and do not establish complete current/future backup coverage. DPAPI recovery remains Windows identity/machine dependent; independent portable recovery explicitly deferred for demo. Preserve all backups. Future migration needs complete FK-aware restore rehearsal, fresh metadata/counts/fingerprints and reviewed guards, not a repeated general backup architecture project during this audit.

## Phase 1 persistence delta

Unapplied003 now also contains timetable_demo_overrides(id PK,publication_id FK,session_key,target_owner,profile_id,record_json,venue,starts_at,expires_at), with(publication_id,expires_at) index, RLS and restricted SELECT/INSERT. Server academic context automatically targets reliable profiles; subscriptions retained only for compatibility. Fixed fictional profiles use a separate fixed-luka-v1.txt/local .fixed-luka-v1.json; previous active profiles are preserved. Known receipt/publication/override backup tables now captured with composite-key ordering; FK restoration follows complete table/data restoration and passes isolated16-table recovery. Unknown public.notifications remains outside automatic backup adoption; whole-project scope still needs review. No production schema change occurred.
