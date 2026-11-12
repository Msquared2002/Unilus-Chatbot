# Phase 2 — personalized Student Mode implementation

Completed locally: **2026-11-11, Africa/Lusaka**. HEAD remains **9cbdeb0517da8820b94a623d9b8facbef50ae1ee** on codex/production-integration, with pre-existing Phase1 work preserved.

## Outcome and definition of done

**Phase2 is locally complete under the automated acceptance agreement.** Signed students with enabled stored simulated profiles can retrieve their own courses, timetable candidates, results, future curriculum, progress and eligible updates through existing chat. Relevant academic follow-ups preserve bounded context. Missing data and ambiguous identity/group/source information are qualified or refused.

Fresh checks: **440 backend tests passed;146 widget tests passed;250 JavaScript syntax checks passed;0 failures/skips in final full suites.** Production build passed,144.85kB / gzip45.10kB. Manual browser/mobile/visual acceptance is intentionally deferred until the consolidated seven-phase testing stage, per the owner's updated agreement. No visual pass is claimed.

No commit/push, production database write, migration, hosted deployment, credential/account change, new dependency or paid infrastructure. No Phase3 work begun. Phase1 auth/profile/curriculum/three SQL migration files are byte-for-byte unchanged from Phase2 baseline.

## Completed checkpoints

| Checkpoint | Result |
|---|---|
|A Context/routing|Extend existing academicContextService; reuse server profile already loaded by chatRoutes.withChat; no second profile/auth system|
|B Timetable/current courses|Today/tomorrow/week/weekday/next listing/time/venue/lecturer; indexed registered-course/cohort/mode filtering; effective publication/overlay reused; five current Luka courses|
|C Curriculum/results|Historical courses, future8 Year4 courses, fixed stored results/CA/exam, highest/lowest ties, available-mark averages, semester/year comparisons and honest progression summaries|
|D Follow-ups|Period/course/results-vs-CA/timetable references, clarification after topic/context loss; owned session/profile/model isolation; widget stale-account cleanup|
|E Notifications|Read owner-safe ticket/timetable events/counts, distinguish recent/read/unread; no event creation or mark-read caused by a chat query|
|F Acceptance|Full backend440/440, widget146/146, syntax250/250 and build; local real chat API fixtures with external requests prohibited|
|G Documentation|This report plus incremental updates to the eight requested roadmap references|

## Exact source changes since Phase2 baseline

| File | Why |
|---|---|
| backend/services/academicContextService.js | Extend the Phase1 projection with server owner/name/student number, profile/curriculum versions, historical period references, provenance and optional publication ID; existing profile loading reused. |
| backend/services/personalAcademicService.js | New deterministic academic orchestration/helper: Lusaka schedule candidates, curriculum/history/results, numeric comparisons, existing notification reads, ambiguity checks and bounded owned follow-up references. |
| backend/tests/personalAcademic.test.js | 36 isolated local API/helper acceptance cases covering Phase2 data, date, privacy, conversations, notifications, overrides and routing. |
| backend/services/chatService.js | Integrate structured personalized retrieval before legacy academic/general RAG; retain tuition/support/Advisor routing; redact academic assistant history; retain legacy CA/final-result follow-up references. |
| backend/services/sessionService.js | Exclude older stored academic tables/identity from history passed to general generation; no existing records rewritten. |
| dummy-environment/chatbot-widget/app.js | Immediate account/profile/logout cleanup, abort and token/profile identity checks on delayed success/error paths; existing chat UI retained. |
| dummy-environment/chatbot-widget/dist/chatbot-widget.js | Rebuilt production widget bundle from reviewed local source. |
| dummy-environment/chatbot-widget/tests/chat-actions.test.cjs | Two new account-switch/stale-token response tests and a realistic clearing method in the DOM fixture. |

See [machine-readable change manifest](phase2-change-manifest.json) and [baseline hashes](phase2-baseline.json). Only8 application/test/build files changed or added during Phase2. Existing other working-tree differences belong to Phase1 and remain intact. Documentation/evidence changes are within docs/roadmap-audit.

## Shared academic context and ownership

Reuse academicContextService.fromProfile with the already-loaded server profile: owner identity, name/student number, programme/stage/mode, profileId/profile version, curriculum version, current course codes, historical period keys, group/null and provenance flags. The optional timetable publication reference is populated when the effective timetable is read. No client-supplied owner/username/number authorizes retrieval.

chatRoutes retains signed attachUser, owned session resolution and demoAcademicService.withChat expected profile/session/model guards. New service independently checks sessionOwnershipService.owns before academic retrieval. Requests without an enabled stored academic profile retain the established guest/real-record-unavailable or JWT-based timetable behavior rather than masquerading as the fixed student.

The demo alias still resolves to stable StudentB unilus-demo-student-b; no ownership migration, hash change or Storage-path change. StudentA remains flexible. New queries use their actual current stored profile. No private profile cache was added: chat reuses one request profile projection. Programme/curriculum identity conflicts are not silently resolved.

## Intent/orchestration boundaries

Tuition remains first. Deterministic personalized retrieval then handles relevant own-academic intents, followed by legacy CA/academic handlers and unchanged support/Advisor/general RAG/Groq chain. Admissions/ECZ/qualification, programme choice/recommendation and explicit support issues bypass personalized retrieval. Public/unenrolled accounts retain established fallbacks.

Personalized numeric/course/timetable/event answers make no external inference requests. No transcript is sent for natural-language rewriting. Existing planner/generation remains available for unrelated grounded university information. Response fields remain compatible; queryType keeps entities.programme/year/semester and adds isPersonalizedAcademic, while academic adds kind and source-specific data. Existing isSimulatedAcademic triggers the current compact academic table styling. Suggested actions stay empty when no supported action is necessary; no arbitrary action IDs/URLs or extra bell/poller were added.

## Timetable behavior

Reuse timetableService.getByProgrammeStage indexes, timetablePresentationService cleaning and the Phase1 effective overlay, not another schedule engine. Each personalized timetable request refreshes the accepted head before reading; full snapshot hydration still only happens on publication changes. Current registrations filter shared BBA/AFIN courses by identity, not a BIT prefix. Full-time excludes explicit PT rows. Unrecorded study mode is qualified; profile year/semester remain server-controlled.

Africa/Lusaka Intl date parts determine today/tomorrow/local clock, next occurrence and weekend/week rollover, independent of host timezone. Next listing includes tied earliest candidates rather than inventing one definitive class. Calendar dates shown are calculated recurrences, not verified attendance. Term dates, holidays, cancellations and exam periods remain unverified and every listing says so.

Unknown group-specific rows are clearly possible, not verified individual enrolment; known unrelated groups are excluded. Missing matching sessions do not prove no class/cancellation. Generic course shorthand is matched against the stored catalogue; tied names ask for a course code and the follow-up retains the pending day/next-query context. Explicit different historical/future timetable stages are not silently answered using current registrations. BIT301 Decision Support Systems source rows are excluded instead of equated with the registered E-Business course.

Active simulated venue overlays appear in personalized rows with simulation/expiry metadata and return to base after expiry. The query does not generate restoration events itself; Phase1's notification lifecycle remains separate. BCS personal timetable matching fails safely with an unresolved CyberSecurity/ComputerScience identity explanation; it is not a catalogue rewrite.

## Curriculum, results and calculations

The versioned35-course BIT catalogue and fixed transcript are unchanged. Luka has22 historical records,5 current references and8 future curriculum courses. Current-course answers list exactly BBA360/BIT301/BIT320/BIT326/BIT346. Historical queries use stored profile periods; planned Year4/next-semester answers use the catalogue and explicitly do not confirm future registration. Flexible profiles do not acquire Luka's transcript or full future catalogue; unavailable curriculum stays unavailable.

All marks come from the existing profile. CA30/exam70, component weights, letter thresholds and courseResults are unchanged. Final exam retrieval returns stored component points; future/current unreleased finals do not acquire fabricated marks. Completed/history status is distinguished from pass status and no graduation/GPA/credit-weighted progression rule is introduced.

Aggregate means reuse demoAcademicChatService.mean: simple unweighted arithmetic mean of available final marks, rounded to one decimal, explicitly not GPA or an official credit-weighted mean. Semester/year comparisons expose their actual available records. CA follow-ups retain CA meaning and exclude incomplete totals rather than averaging zeros/missing data or switching silently to final marks. Highest/lowest ties are retained.

## Conversational state and privacy

Reuse programmeAdvisorState.createStore utility with a separate bounded academic reference store: max500 session entries,30-minute TTL. Stored values are owner/profile/model identifiers, kind, period keys/selection, course code and pending timetable references—not transcript copies or another persistent-memory platform. Every lookup rechecks owner/profile/model. New session/renewal cannot inherit another profile's references. Unrelated topics clear academic references; explicit new period/course overrides prior context. An orphan follow-up asks for a period. Backend restart expires references while facts remain in the existing stored profile; no durable long-term memory claim.

New academic assistant log entries contain a private-response placeholder (plus safe pending-assessment prompt where needed), not full numeric tables. Historical DB contents are not rewritten; getRecentHistory redacts older table/StudentID-shaped academic responses before general model use. This deliberately means detailed academic responses are re-retrieved from the profile rather than replayed as model memory. Normal conversation persistence continues.

Natural-language requests for another student's records are refused, forged body identities ignored, wrong profile/session gets409/ownership rejection, expired sessions get refreshed through existing guards. Notification questions retrieve generic student-visible event messages only, not internal notes or private ticket bodies. They do not mark events read or insert notifications.

Frontend now aborts/clears private chat, session pointer and input on actual token/profile change/logout; late success/error paths compare both request generation and current token/profile identity. Same-context refresh does not erase history. No new frontend application, dashboard, navigation page, poller or dependency.

## Automated acceptance and failures resolved

| Evidence | Fresh final result |
|---|---|
|[Full backend](phase2-backend-full.txt)|440 tests;440 passed;0 failed/skipped|
|[Full widget](phase2-widget-full.txt)|146 tests;146 passed;0 failed/skipped|
|[Syntax](phase2-syntax.json)|250 JavaScript/CJS sources;250 passed|
|[Production build](phase2-build.txt)|Passed;144.85kB/gzip45.10kB; existing Vite config-loader warning nonfatal|
|[Focused routing regressions](phase2-routing-regressions.txt)|93/93 at the routing checkpoint; final full suite includes all later tests|
|[Privacy/change scan](phase2-change-manifest.json)|Zero credential-pattern hits in changed files; Phase1 identity/curriculum/migrations unchanged|

New backend test file contributes36 cases through actual local /api/chat and pure date/index helpers; widget adds2 account-switch/stale-token cases. Tests prohibit external HTTP and use synthetic SQLite/profile fixtures. Real project timetable data is used for integration; clearly labelled synthetic rows are used only for clock/group boundary tests.

Initial focused verification exposed and fixed ordinal stage parsing and an unsupported LLB test fixture (BSPH used for actual supported flexible-profile coverage). Full regression initially found6 failures: support draft interception, no-profile fallback changes, programme-choice interception and explicit-last-semester precedence. These were corrected in production code; existing regression expectations were preserved. A widget syntax/partial identity-check editing defect was caught and fixed before final build. Final failure count is zero. Sandbox localhost EACCES was resolved using permitted host execution, not a browser/security bypass.

## Remaining limitations and external dependencies

- Manual browser/mobile/avatar/map/visual acceptance intentionally deferred to the final consolidated stage, not claimed passed or required now. Automated existing widget/map/avatar regressions pass.
- Recurring source data lacks verified term/holiday/cancellation dates; schedule answers are qualified listings. Luka's class group remains unknown.
- External Python extractor/complete-source adapter remains unavailable; Phase1 local ingestion and effective snapshot infrastructure are reused, not claimed live upstream automation.
- Course/source-name conflict flags remain in the catalogue. BCS identity ambiguity is explicitly blocked for personal timetable, not equated to another programme. LLB currently lacks a supported simulator mapping; no fabricated flexible history is substituted.
- Flexible profiles lack a full approved future curriculum/verified registration; functions use available records or explain unavailable data.
- Academic context is bounded conversation state, not durable applicant/student memory. No official SIS connection, credit weighting, GPA or certification guarantee.
- Existing production-only questions from Phase1 (unapplied003, unexpected notifications table/RLS, whole-project backup scope) remain unchanged; this phase did not inspect or alter production.

## Future release and handoff

No new table or migration is required by Phase2. Existing Phase1 migration003 is still only a local candidate and requires its own production review/backup/guards/authorization. Preserve001/002 and current private stable-owner alias settings. No deployment occurs under this instruction.

Later authorized release: validate the combined Phase1/2 diff, existing guarded migration prerequisites, private runtime configuration and published API origin/CORS; keep K0 services and main intact; rerun only checks affected by subsequent changes; deploy compatible backend/frontend only after explicit authorization, then consolidated two-account guest/student/support/advisor/timetable/notification/map/avatar/manual acceptance. Do not recreate knowledge/Storage or reapply migrations.

Read this report and the updated Phase2 blueprint before resuming. **Stop here; Phase3 needs a separate instruction.**
