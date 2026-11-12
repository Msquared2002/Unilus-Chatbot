# Phase 6 — Personalized Morning Brief and reminders

Date:2026-11-11, Africa/Lusaka. Status: locally implemented and automatically verified. Existing uncommitted Phases1,2,3 and5 are preserved. Phase4 pedestrian routing remains deferred; Phase7 has not started. No commit, push, production migration, hosted account change, private credential read, deployment or cloud write was performed. Existing backups are untouched.

## Local completion and reused architecture

The current chatbot now supports deterministic requested daily/tomorrow briefs, optional first-opening morning briefs, and owner-controlled one-time reminders. The existing chat, avatar, settings, map, academic tables, support controls, tutor cards and single notification bell remain the interface. No calendar application, dashboard, parallel student profile database, provider, paid dependency, email/SMS/push or always-on scheduler was introduced.

Reused: signed attachUser/authService identities and sessionOwnershipService; demoAcademicService/academicContextService; personalAcademicService.schedule/localTime and its bounded context; accepted timetable publication and simulated override resolver; notificationService and its ticket/timetable/peer categories; existing widget message rendering and validated context.followup actions; programmeAdvisorState.createStore for bounded temporary confirmation drafts; DB adapter/transactions; guarded migration/inspection and logical recovery tooling.

## Brief source architecture

morningBriefService composes factual sections without Groq/RAG. It uses the supplied locked academic profile in chat, or loads the existing owner profile once for direct requests. notificationService accepts the already resolved context, avoiding duplicate own-profile loading or nested academic locks. No transcript, grades, CA/examination marks, student number or private contacts are echoed into the brief.

The structured brief includes owner display name/date/timezone, at most8 target-day weekly sessions,3 next listed candidates,5 unread generic updates,5 active personal reminders, publication ID, provenance and unavailable-source notices. Student-created reminders are not university deadlines. Private ticket histories/staff notes and tutor request messages/contact values are never used. Peer updates use the existing recipient-scoped generic inbox preview and can open authorized request detail via the existing peer widget module. Source receipts are not marked read by brief generation or rendering. Existing lifecycle settlement may materialize a legitimate due/expiry/override event once; it does not manufacture duplicate notifications just to make a brief.

The accepted publication and currently effective simulated venue override feed the existing Phase2 schedule resolver. Unknown group sessions retain possibleGroup and uncertainty; tied next candidates remain plural. BIT301 source-conflict exclusion and the BCS programme mismatch refusal remain in the existing resolver path. Tomorrow's next-candidate search starts at the requested Lusaka date. All schedule sections explicitly describe weekly candidates: unverified term dates, holidays, examinations and cancellations prevent treating them as confirmed dated appointments. No matching listing does not prove absence of a class.

There is no authoritative current dated/targeted announcement feed in the inspected existing architecture. The announcement component reports unavailable and no invented deadlines, scholarships or events are generated. If a timetable or inbox dependency fails, other verified sections still render with a bounded unavailability notice; no guessed schedule is substituted.

## Requested and automatic presentation

Supported prompts include Good morning; What's happening today; What's on today; Give me my morning brief; What should I know about today; Anything important I missed; What's coming up tomorrow. Manual requests always compose current data, regardless of an earlier automatic claim. Guest replies explain the feature and require sign-in for private contents.

Automatic briefing is OFF unless explicitly saved by the student. A short inline settings control is available through morning-brief settings prompts and each brief; it changes only that signed owner's preference. The fixed window is06:00 through11:59 Africa/Lusaka. It is an opening-triggered feature, not background delivery at06:00. Existing widget openChat dispatches one opening event; no new polling loop is added. The adapter requires signed-in, empty/idle conversation and no input draft both before fetching and before appending. It never expands the panel, replaces a draft or forces focus, and preserves the prior scroll position.

brief_deliveries has a unique owner/local_date key. After composition, an owner-locked transaction rechecks preference, date and window, then reserves the one daily claim. Concurrent tabs/instances and restarts cannot reserve it twice. The persisted row records a server claim, not proof a human saw the content. If the response is lost or discarded because the student starts typing/switches identity, the daily claim can be consumed without display; explicit manual requests remain available. This is an intentional at-most-once, non-intrusive tradeoff, not an exactly-once delivery guarantee. Reopening a conversation with existing messages is conservatively non-qualifying to avoid interruption.

## Reminder workflow and natural language

reminderService recognizes explicit personal reminder intents before general academic/RAG routing. It does not intercept Explain how reminder systems work, database triggers or generic timetable-notification explanations. All writes derive the stable owner from the signed token and require confirmation; no LLM performs writes or claims storage.

Examples:

- Remind me tomorrow to visit the Registrar → asks the exact time →9AM → review card → explicit confirmation saves.
- Remind me on Friday at2PM to submit my assignment → previews the resolved date/time and description.
- Remind me this evening to check my tuition balance → asks an exact time rather than choosing one.
- Show my reminders / Show my upcoming reminders → bounded owner list.
- Cancel my reminder about visiting Accounts / Mark my Registrar reminder as done → matching owner reminder controls; no change until selecting the explicit action.

The same existing bounded store factory holds owner/session-bound unsaved drafts for10 minutes, maximum500 entries. It does not persist another conversation history. A draft lost on expiry/restart must be reviewed again. Clicking Do not save clears the owned server draft as well as the UI. The pending confirmation is never reused to approve another owner's request. Ordinary unrelated messages clear the pending reminder draft.

References such as that venue reuse existing bounded personal timetable references only when owner/profile match and the current filtered schedule has exactly one usable venue. Ambiguous or absent references ask the student to name the venue. The reminder does not turn that weekly candidate into a verified appointment. Profile changes invalidate academic references but do not transfer or remove user reminders.

Direct APIs under /api/student-day provide brief/preferences/automatic and owned reminder creation/list/detail/edit/complete/cancel/draft-dismissal. The auth middleware is scoped to this prefix so Guest chat and staff workflows remain available. Private reminder bodies use these endpoints, never general chatbot prompts. The chat response forwards brief/reminder metadata for actual widget consumption; general persisted/model history contains only private-interaction placeholders.

## Dates and reminder lifecycle

briefTime delegates local date/weekday calculation to the established Lusaka utility and explicitly interprets local datetime inputs as+02:00. UTC timestamps are stored in canonical ISO form; an explicit ISO Z timestamp is unambiguous. It never uses the host OS timezone to interpret student input. Confirmation/edit controls display Africa/Lusaka explicitly and send a timezone-independent local datetime string or canonical UTC value.

Today/tomorrow, nearest upcoming weekday, month/year rollover and leap dates are supported. A weekday includes today if its supplied time is still future; an elapsed weekday time uses the next occurrence. Missing/ambiguous time, invalid date, out-of-range clock, past/equal-to-now time or more than366 days ahead is rejected/clarified. Recurring/every-day schedules are explicitly unsupported rather than silently claimed. One-time reminders are sufficient for this phase.

Statuses: active→completed or cancelled. Editing an active reminder requires its current revision and explicit confirmation; a changed due time/description advances revision and defines a new one-time occurrence. Stale edits fail. Identical completed/cancelled actions are idempotent; conflicting terminal actions cannot both succeed. Creation retries use a unique owner/operation ID plus immutable creation fingerprint, so even retries after editing or delivery cannot create a duplicate or alter another reminder. Quota is100 active reminders per owner, description240 characters, pages20 and bounded owner/title search. Existing API IP rate limits remain in force.

No automatic hard deletion is performed. Completed/cancelled records and original event timestamps remain retained for history/recovery. No new recurring-task system exists.

## Due-event and inbox integration

The existing notificationService reconciles the requesting owner's due reminders before its read-only inbox snapshot. There is no timer/worker or second bell. The current visibility/auth-aware polling lifecycle therefore picks up due events when the portal/backend is active again. Lazy settlement uses persisted due_at, owner locks and a unique reminder/revision event, not an in-memory timeout. Delayed delivery retains the original due timestamp and marks active overdue reminders accurately.

The reminder: category merges into existing unread totals/items/read acknowledgements. Generic preview says that a personal reminder reached its due time and asks the owner to review current status; it never exposes the title or contact details. Authenticated detail returns only the signed owner's current reminder. A historical due notification may remain after completion/cancellation/edit; current status is shown and reading never completes the underlying task. Cancellation/settlement share a per-owner lock: a cancellation that wins prevents a due event, while an already-settled event remains historical. Further settlement never duplicates it. Editing creates at most one event for each later revision.

## Privacy and account changes

All student-day routes reject guests/staff and all service methods enforce signed student ownership. Forged owner fields fail on writes and cross-owner IDs fail closed. Reminder values never enter public knowledge or general Groq context. Briefing contains no support notes, ticket reply body or tutor contacts. No Phase3 support contact file/default was read or reused.

The widget captures token/profile context, aborts account-bound fetches and clears registered brief/reminder controls on context change. Existing full-chat and notification-detail cleanup clears private rendered text. Both late automatic responses and detached controls are rejected after switching. The flexible account's new academic context changes its schedule; reminders remain attached to its stable owner, independent of transcript version. Luka and StudentA retain their original identities and academic histories.

## Additive schema and recovery

006_morning_brief.sql is local-only and adds:

- brief_preferences: unique owner preference, automatic flag, timestamp.
- brief_deliveries: immutable owner/local-day claim with unique owner/date.
- personal_reminders: stable owner, title, canonical due time, state, revision, operation/fingerprint and timestamps, owner/state/due index and status CHECK.
- reminder_events: reminder FK, owner/revision, original due timestamp, settlement time and read receipt; unique reminder/revision and owner index.

RLS is enabled and PUBLIC/anon/authenticated direct grants revoked. The existing non-owner unilus_backend role receives SELECT/INSERT/UPDATE where required; daily claims receive SELECT/INSERT only. No DELETE/DDL/schema privileges are added. Server predicates enforce per-student privacy for the shared backend role. morningSchemaCheck is wired into the guarded runner and verifies exact columns/types, keys/FK/uniqueness, status constraint, indexes, RLS, policies and effective grants. Migrations001–005 remain byte-identical to the Phase6 baseline.

Logical capture/restore includes the four tables after existing dependencies. The backup validator permits only the exact new reminder-status CHECK expression rather than allowing arbitrary unknown dependencies. Isolated migration/restore verifies27 tables, fingerprints, constraints/indexes, RLS/grants and receipt/claim/reminder persistence. A deliberately removed reminder_owner_due index causes guarded rollback before the valid bundle runs. Runtime deletion and daily-claim modification fail; uniqueness/status/FK errors are exercised. This is synthetic local recovery evidence, not proof of hosted disaster recovery. No existing backup was opened/overwritten and no production migration ran.

## Automated verification

- phase6-focused.txt:25/25 (24 service/real HTTP acceptance tests plus isolated guarded recovery).
- phase6-widget-focused.txt:11/11 DOM/transport/account-switch tests.
- phase6-peer-regression.txt:1/1 existing actual peer chat regression with deterministic profile-stage fixture.
- phase6-backend-full.txt:511/511, zero failures/skips.
- phase6-widget-full.txt:168/168, zero failures/skips.
- phase6-syntax.json:283/283 JavaScript syntax checks, including the generated bundle.
- phase6-build.txt: production build passed,20 modules; bundle161.33kB, gzip50.56kB.
- phase6-recovery.txt: isolated27-table migration/restore and negative guarded-index test passed.
- phase6-change-manifest.json / phase6-final-validation.json: exact source delta, immutable prior migrations, credential-pattern scan and consolidated final gates.

Focused tests use synthetic local storage and deterministic clocks, including actual signed Luka/StudentA identities in isolated fixtures. They cover weekly/group/calendar uncertainty, effective override/expiry, private support/peer previews, opt-in/out and06:00/11:59/12:00 boundaries, concurrent daily claims, manual briefs after automatic claim, slow dependencies crossing the window, reminder clarification/confirmation/edit/complete/cancel, cross-account and expired-token denial, persistent retries, due/revision events, cancellation races, pagination/quota, reference clarification, no external inference/history leakage and restart persistence.

Initial development test setup used a timetable period outside the existing validated format; that fixture was corrected. A search-edit syntax error was caught and corrected before regression. The first full backend run exposed an existing Phase5 randomized fixture: renewal could choose Year1 Semester1, causing assert.ok(courses.length) to fail. The isolated test now controls random seeds for3.2 registration and1.1 invalidation, while retaining the existing generator/grading policy and all assertions. No real grades were changed and no test assertion was weakened. Final logs supersede intermediate failed runs.

## Performance and unresolved acceptance

No factual briefing calls Groq, embeddings or corpus search. One academic context is reused; schedule calls share the accepted effective resolver. Queries are owner-indexed and bounded, and source receipts remain unchanged. Concurrent first openings may assemble independently before the unique claim resolves; only the winner returns a brief. This trades some bounded duplicate read work for a short atomic claim transaction and no DB lock held during source loading.

No manual browser, mobile, accessibility or visual acceptance was performed; the owner deliberately deferred that consolidated stage. DOM tests and CSS/source checks do not prove visual acceptance. Hosted cold wake-up latency, multi-device visual behavior, actual production migration and real university calendar/announcement availability remain unverified. In-memory unsaved drafts expire; saved reminders and daily claims survive restart. Sleep/offline periods preclude guaranteed exact-time delivery. Lost/suppressed automatic responses may consume a claim as described above.

## Exact Phase6 source changes

- backend/app.js
- dummy-environment/js/ticket-notifications.js
- backend/migrations/006_morning_brief.sql
- dummy-environment/chatbot-widget/app.js
- backend/services/briefTime.js
- backend/services/chatService.js
- backend/tests/morningBriefRecovery.test.js
- backend/tests/morningBrief.test.js
- backend/routes/morningBriefRoutes.js
- backend/routes/chatRoutes.js
- dummy-environment/chatbot-widget/morning-brief.js
- dummy-environment/chatbot-widget/main.js
- backend/services/notificationService.js
- backend/services/morningSchemaCheck.js
- backend/services/morningSchema.js
- backend/services/morningBriefService.js
- backend/services/migrationService.js
- backend/services/logicalBackup.js
- backend/services/postgresOperations.js
- backend/services/personalAcademicService.js
- backend/services/reminderService.js
- dummy-environment/chatbot-widget/widget.js
- dummy-environment/chatbot-widget/widget.css
- dummy-environment/chatbot-widget/dist/chatbot-widget.js
- dummy-environment/chatbot-widget/tests/morning-brief.test.cjs
- backend/tests/peerTutorChat.test.js

Documentation additionally updates00,03,09,11,12,13,14,15 and creates this21 plus Phase6 evidence artifacts. Source preservation is compared against phase6-baseline.json, not Git HEAD alone, because Phases1–5 were already uncommitted. No baseline source file was removed.

## Future production requirements and Phase7 handoff

This is not production release approval. A future consolidated release needs reviewed006 and the full guarded migration bundle, fresh compatible backup/recovery coverage, explicit owner authorization and the existing restricted PostgreSQL/TLS/private Storage/auth setup. Do not edit/reapply001–005. No new paid resource, external credential, push key or scheduler is required. Automatic morning preference is per-account and defaults off; no production preference was set.

Complete consolidated visual/accessibility/mobile and hosted owner/privacy/restart acceptance before a later release. A trustworthy date-specific academic calendar/announcement feed is still required before representing university events as confirmed. No institution feed was invented here.

Phase6 is locally complete. Preserve all uncommitted prior work, this source and evidence. Phase4 remains deferred. Do not start Phase7, commit, push, migrate or deploy without the owner's next instruction.
