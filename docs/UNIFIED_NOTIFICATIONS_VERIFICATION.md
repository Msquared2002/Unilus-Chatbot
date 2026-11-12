# Unified ticket and timetable notifications — local completion report

Prepared 10 November 2026. **No commit, push, deployment or production database write was performed during this task.**

## Previous-operation status

The earlier approved migration 002 committed before this task, and its postflight verified original record counts/fingerprints, the foreign key, grants, policies and ledger. It was not rerun or rolled back. The notification implementation was locally committed as `9cbdeb0517da8820b94a623d9b8facbef50ae1ee` before the interruption. Read-only checks at the start of this task found GitHub and both hosted services still on `2335d9f7b4611491290f612e7c07510239c2ddcb`. No old push process remained running. Original backups were not modified.

## A. Existing implementation audit

The ticket foundation already used successful, persistent `ticket_events` as its inbox, with owner-scoped read receipts, an unread count, student-only routes and generic notification text. Repeated polling did not write events, and unchanged status updates already avoided duplicate events. Guests and internal notes were excluded. The portal polled while visible.

Missing pieces were notification selection/opening, explicit read/unread labels, a shared presentation for a second category, and lifecycle cleanup/duplicate-mount protection. The foundation now opens authorized ticket details in the same inbox, acknowledges a successfully opened item, retains a separate Mark read button and distinguishes read items visually. It also suppresses events whose actor is the ticket owner. There is no second ticket-event or generic notification writer.

## B. Ticket results and privacy

Ticket notifications are derived from student-visible reply/status events joined through the original ticket's `chat_sessions.owner`. The signed-in username determines ownership; no client owner field or ticket reference grants access. Numeric ticket notification IDs remain compatible with the previous API. Timetable IDs have a `timetable:` prefix, avoiding ID collisions.

The shared list does not contain private reply text, internal notes, staff actor names or ticket descriptions. Opening a ticket calls an authenticated detail route which rechecks ownership and returns only the public ticket summary and permitted reply/status bodies. It never returns the administrative ticket object. Internal notes remain inaccessible. Dynamic content is rendered through `textContent`, including ticket bodies and timetable changes.

## C. Timetable architecture and acceptance

The documented upstream Python project discovers source pages, parses lecturer/student views, normalizes, merges with provenance, validates and builds indexes. Its JSON/index outputs are copied into `backend/data/timetable/`. The Python implementation and its test suite are not present in this integration workspace; no scraper was added, changed or run. The existing Node timetable service and index builder remain in use.

The current local corpus contains 3,296 records, including 1,132 raw rows without a programme association. Its real rows pass the new normalization test. Lecturer-only records remain in the accepted raw snapshot and retrieval; they are excluded from recipient targeting, with an untargeted-record count/reason in publication results. No programme enrolment is inferred for them.

`acceptTimetable.js` is the explicit operator acceptance step. It requires a reviewed complete-source flag, source-validation flag, period, source provenance and expected previous publication ID. It never runs on a student request or on a scraper schedule. Raw imports are refused once the running timetable has an accepted snapshot; dry-run validation remains available.

Each accepted publication stores an immutable previous-version link, revision, content fingerprint, original JSON, normalized records, source, period and publication timestamp. The first import, or the first import of a new period, establishes a silent baseline. A transaction and PostgreSQL advisory lock serialize acceptance; the SQLite adapter serializes local tests. Snapshot and change inserts commit together. An injected mid-publication failure was tested and rolled back both.

Normalization ignores ordering, whitespace and capitalization; normalizes programme-code spacing and time formatting; and excludes scraper/provenance noise from comparison. Explicit groups are retained. When the source's explicit group field is empty, an unambiguous terminal cohort label such as A1 in the published programme name is used. Course/tutorial group labels are kept distinct in matching keys. Programme, cohort group, course, variant and session type form the matching key. Exact unchanged sessions are removed first; only one-to-one remaining sessions are treated as modifications. Ambiguous matches are represented as additions/removals for operator review rather than guessed reschedules.

Supported changes: day, time, venue, lecturer, newly listed session and removed published session. Several changed fields on one matched session form one coherent event. A removed session is explicitly described as no longer listed, not a confirmed cancellation. Excessive shrinkage, an entirely missing previous cohort/group, empty/invalid data and stale acceptance versions are rejected. Any removal additionally requires explicit review. These checks plus operator source validation prevent raw extraction failures from becoming mass cancellation alerts; they are not a substitute for checking the source is genuinely complete.

Identical accepted content is idempotent. Historical content cannot silently replace a newer accepted head. Reverting to an older accepted version is intentionally not an automatic operation.

## D. Targeting and unified interface

Authenticated account data supplies a programme/year/semester but no reliable class-group or course enrolment. Demo academic profiles are simulated. Accordingly, timetable notifications use an explicit **student-selected** period/cohort/group subscription, validated against accepted source choices. The UI labels this as a preference, not verified enrolment. Programme aliases are not guessed from an ambiguous full name; published canonical codes, whitespace/case variants and part-time code spacing are handled consistently.

Only changes with the exact subscribed period and cohort/group are eligible. Other academic levels, semesters, part-time cohorts or groups are excluded. Shared/lecturer-only records without a source-backed cohort association are not broadcast. One cohort/group subscription per account is currently supported; verified course-level enrolment and multi-subscription delivery are outside this implementation.

One existing portal bell now shows both categories, a combined unread count, newest-first ordering with a deterministic ID tie-break, read/unread labels, safe detail views, subscription controls and empty/loading/error states. The latest 50 items are displayed; the unread count covers all eligible items. The shared inbox read occurs in a consistent database transaction. Selecting an item loads the authorized ticket details or the relevant current cohort timetable and then marks it read.

The timetable action includes its publication ID. Opening it checks the accepted head immediately, so an alert cannot leave the student looking at an older cached timetable. Ordinary timetable/API/chat retrieval uses a shared 30-second head-check cache with an in-flight request guard, and loads the full snapshot only when the accepted ID changes. No scraper or full diff runs during inbox reads. All weekly times are source local times; display timestamps use `Africa/Lusaka`. Calendar-date changes cannot be inferred because the present records are weekday schedules, not dated lecture occurrences.

The browser sends no polling requests while hidden or logged out; timers are stopped/restarted on visibility/page lifecycle changes, and duplicate script mounting is guarded. Failed requests wait for the normal polling interval rather than an aggressive retry loop. No Web Push, service worker, background worker, announcements or morning brief was added.

## E. Prepared database changes

Migrations 001 and 002 are byte-for-byte unchanged. **003 is prepared only and was not applied.**

| Table | Keys / index | Backend grants |
|---|---|---|
| `timetable_publications` | Text primary key; unique integer revision; previous-publication foreign key | SELECT, INSERT |
| `timetable_changes` | Text primary key; publication foreign key; `(scope, created_at)` index | SELECT, INSERT |
| `timetable_subscriptions` | Authenticated owner primary key | SELECT, INSERT, UPDATE, DELETE |
| `timetable_notification_reads` | Composite owner/change primary key; change foreign key | SELECT, INSERT |

Every new table has RLS enabled. PUBLIC, anon and authenticated have no direct table access. The backend role has command-specific policies and no truncate/schema-administration permission. User isolation is enforced by authenticated application queries, not falsely attributed to shared-role RLS. The new schema checker is invoked by the guarded migration runner when 003 is included. Original ticket read receipts remain in migration 002 and are not migrated into a generic table.

New complete bundle SHA-256, computed by `migrationService.bundleHash`:

`c9b1d7026477f5d5b9bf8c40c31f7b6c3908d9a817c5148442454493efd27cab`

003 SQL SHA-256:

`b65489cd19424348e6c29efc0f4014f9e18b1bce31810c88a81af1494411f28e`

The historical `119aca...` approval is not valid for this expanded bundle.

## F. Changed files

Relative to the local ticket-notification checkpoint `9cbdeb0`:

| File | Reason |
|---|---|
| `backend/migrations/003_timetable_notifications.sql` | Additive snapshots, changes, subscriptions and read receipts with indexes/RLS/grants. |
| `backend/scripts/acceptTimetable.js` | Explicit validated-source acceptance command; no scraper hook. |
| `backend/services/timetableChangeService.js` | Normalization, stable matching, field differences and messages. |
| `backend/services/timetableNotificationService.js` | Atomic/idempotent publication, subscriptions, targeted history, read state and accepted-head hydration. |
| `backend/services/timetableNotificationSchemaCheck.js` | Focused migration security verifier. |
| `backend/services/notificationService.js` | Consistent combined inbox and category-aware acknowledgement. |
| `backend/services/ticketNotificationService.js` | Safe category/action metadata, status wording, owner-action suppression and deterministic ordering. |
| `backend/services/migrationService.js` | Verify 003's security before a future guarded commit. |
| `backend/services/timetableService.js` | Adopt accepted snapshots with the existing index builder; canonical code-spacing lookup. |
| `backend/services/timetableUpdater.js` | Prevent raw publication over an accepted snapshot. |
| `backend/services/retrievalRouter.js` | Lightweight accepted-head refresh before authenticated retrieval. |
| `backend/routes/notificationRoutes.js` | Unified inbox, owner-safe ticket details and validated subscription endpoints. |
| `backend/routes/timetableRoutes.js` | Refresh accepted head for timetable views and notification selections. |
| `backend/app.js` | Hydrate the accepted snapshot during local/future application startup. |
| `dummy-environment/js/ticket-notifications.js` | Extend the same bell/inbox; detail actions, subscription controls and polling lifecycle. |
| `dummy-environment/css/notifications.css` | Read/unread distinction, wrapping, keyboard focus and mobile layout. |
| `dummy-environment/portal.html` | Load the notification stylesheet. |
| `backend/tests/timetableNotifications.test.js` | Change, targeting, noise, failure, idempotency and real-corpus normalization cases. |
| `backend/tests/timetableNotificationMigration.test.js` | Isolated PostgreSQL permissions and foreign-key test. |
| `backend/tests/unifiedNotificationIntegration.test.js` | Real local API workflows A–D and privacy. |
| `dummy-environment/chatbot-widget/tests/ticket-notifications.test.cjs` | Adapt the existing test to the extended controls/lifecycle. |
| `dummy-environment/chatbot-widget/tests/unified-notifications.test.cjs` | Both category actions, read count, lifecycle and responsive/focus styles. |
| `docs/TICKET_NOTIFICATIONS.md` | Point the ticket foundation notes to this combined local release. |
| `docs/UNIFIED_NOTIFICATIONS_VERIFICATION.md` | This audit, evidence, limitations and future release plan. |

No unrelated application modules, credentials, runtime endpoint configuration, campus dataset, academic simulator or university knowledge records were changed.

## G. Test and local acceptance evidence

- Full backend: **396 passed, 0 failed, 0 skipped**. Includes authentication, ticket workflow, academic/fee retrieval, timetable parsing/presentation and campus integration regressions.
- Full widget: **144 passed, 0 failed, 0 skipped**.
- Focused timetable/ticket service tests: **18 passed** (13 timetable + 5 ticket).
- Focused new API/PostgreSQL tests: **4 passed**; final API/timetable cache-refresh run: **16 passed** (overlaps the above suites; do not add these to full-suite totals).
- Frontend notification-specific tests: **5 passed**.
- Syntax: **241 JavaScript files passed**. Production widget build passed and its bundle remains unchanged at 139.29 kB / gzip 43.42 kB. The existing nonfatal future Vite config-loader warning remains.
- Private-value scan covering tracked and untracked implementation files: **559 files checked, zero matches** before adding this report.
- No unresolved automated failures. During development, an old frontend test referenced a fixed child position which changed when subscription controls were added; it was adapted to select the Mark read control by label. A real-corpus check found the intentionally unscoped lecturer rows; the implementation now preserves those rows and suppresses guessed recipients rather than refusing the real dataset.
- The separate Python timetable extractor/test suite is absent from this workspace and was not executed. No claim is made that its live scraping completeness was verified.

### Real browser, localhost only

A localhost-only synthetic preview used an in-memory database, synthetic users, synthetic ticket events and synthetic timetable records. No production credentials or database connection were used. Verified in the real portal:

1. Actual synthetic sign-in and a single bell showing 2 unread items across both categories.
2. Open ticket displayed the correct synthetic staff response and reduced unread count to 1.
3. View updated timetable displayed the correct BIT41/A1 rows and changed room; unread count became 0.
4. Refresh retained zero unread.
5. A new synthetic staff reply was posted through the localhost staff API; the bell automatically changed to 1 unread through polling, without a chatbot query or page refresh.
6. A 390×844 viewport showed the unified inbox with wrapping and full-width controls. Timetable subscription choices saved successfully in that viewport.
7. Mark read returned the count to zero. The temporary viewport override was reset.

Initial native typing did not successfully sign in; using exact form-field locators succeeded. This was confined to the synthetic browser fixture. The complete API tests independently verified owner/other-student access. Staff changes in this browser acceptance were made through the authorized local API fixture, not by exercising the full Staff Support Centre UI. Browser screenshots show local synthetic data only. No hosted acceptance was performed for the new code.

### Workflows

| Workflow | Local result |
|---|---|
| A: ticket → staff reply → correct owner → open details → mark read → other student denied | PASS, actual local API and browser detail/read flow |
| B: baseline → reviewed venue change → matching subscriber → correct updated timetable → repeat produces no duplicate | PASS, local transactional/API tests and browser timetable view |
| C: identical/reordered/reformatted import | PASS, zero new alerts |
| D: failed/partial extraction or interrupted publication | PASS, accepted head/data and alert counts unchanged |

## H. Eventual release plan — not executed

1. Obtain separate approval for the **new** bundle and combined source diff. Recheck local/remote branch state without discarding the existing local checkpoint.
2. Read-only production preflight: verify ledger entries/checksums for 001/002, current schemas/grants, absence or known state of 003, and unchanged original-data safeguards.
3. Revalidate backup freshness, encryption/hash and recovery checks. Preserve the existing backup with SHA-256 `fd1f2ee3a67d199522f224786bedb348ace06218503c31da67aec0a37f4b8cdd`. A new fresh backup may be required; the old backup is not permission to migrate. Existing backup tooling covers its established table set; before ongoing real timetable publication, the recovery procedure must also cover the new snapshot/change/subscription/read tables and the existing ticket receipts.
4. Run only the guarded runner with the new approved hash and a verified backup. Correctly tracked 001/002 must be skipped, not reapplied. Validate the new keys, indexes, policies, effective grants, ledger and original-record fingerprints before proceeding.
5. Commit/push the reviewed combined code only after approval and release checks. No new environment variables, paid resources or replacement services are needed.
6. Deploy the backend to the existing Render service after schema readiness; then hydrate/review a complete real timetable baseline through the explicit operator workflow. The baseline is silent. Before any later publication, review source completeness, period, expected head and removals. Protect private runtime configuration outside source control.
7. Publish the matching frontend through the existing manual Netlify workflow. Keep its HTTPS Render API base. Existing ticket notifications and old numeric acknowledgement IDs remain compatible during the backend-first transition.
8. Hosted synthetic acceptance: two students, explicit subscriptions, one marked test ticket, staff reply/resolution, automatic inbox poll, both detail actions, persistent read state and cross-account denial. Verify timetable retrieval, chatbot, campus and authentication. Do not modify historical university tickets to prove acceptance.
9. On failure, stop writes and retain diagnostics. Do not delete snapshot history, drop additive tables or roll back production data automatically. An older application can ignore the additive tables; any rollback or new migration requires explicit approval.

## I. Remaining limitations

- Real source completeness requires operator review; no trusted automatic publication signal exists in the external scraper.
- Timetable targeting is a selected cohort/group preference, not verified enrolment. Unknown/shared course associations are intentionally withheld from alerts. One subscription per account is supported.
- Weekly data supports day/time changes, not verified dated cancellations. Entire-cohort disappearance and large shrinkage are blocked conservatively.
- Full standalone Python pipeline execution, real hosted accepted publications and authenticated hosted UI acceptance are unverified and must wait for the next approved release.
- Existing backup/recovery remains subject to its previously accepted Windows dependency. The new tables need inclusion in the future recovery scope; no backup automation was rewritten here.
- The unified feature is locally implemented and tested, **not live**. No new migration, GitHub push, hosting deployment or Web Push activation occurred during this task.
