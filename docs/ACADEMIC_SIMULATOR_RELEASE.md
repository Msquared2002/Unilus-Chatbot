# Combined conversational hotfix and academic simulator — local review

Historical implementation report for `626a869`. The grading, course coverage, assessment presentation and latest verification below are superseded by [the focused corrections report](ACADEMIC_SIMULATOR_CORRECTIONS.md).

Status: implemented and verified locally. No push, deployment, cloud build, migration, knowledge bootstrap, bucket change or remote test write was performed for this feature. This commit descends from conversational hotfix `eba44d5cfbde12519667ab380e09bfd04f3e84c1`; release both together. The public release remains outside this local change.

## Behaviour and security

The two existing private student logins remain unchanged. Read-only inspection confirmed two student accounts and two other accounts; no passwords, JWT identities, staff accounts or administrator records were changed. The simulator is disabled unless `DEMO_ACADEMIC_ENABLED=yes` and the verified student username appears in `DEMO_ACADEMIC_USERS`. Guest, staff and other student requests receive 403. Browser programme/profile values never establish account ownership.

`demoAcademicService.generate` uses a fresh cryptographic 32-byte seed and UUID. Labelled SHA256 samples generate the fictional name, synthetic DEMO number, academic stage and assessments once. The seed is excluded from API responses. All supported periods up to the selected current stage are generated together. Reading a page, asking a question or refreshing does not generate new marks. `get` reloads the same object; an expired chat session can rotate without changing academic records.

Production persistence uses the existing private Supabase document bucket and existing server-only Storage credential. One JSON-encoded **text/plain** object per authenticated username is stored at `demo-academics/v1/<SHA256(username)>/active.txt`. This uses the bucket's existing accepted MIME type; no bucket, policy or SQL migration is required. Objects are not knowledge records or managed documents and do not enter the RAG corpus. GET 404 (including Supabase's structured not-found 400) creates an initial profile; other Storage errors fail closed. No ephemeral-disk fallback is allowed in production. `DEMO_ACADEMIC_STORE_DIR` is solely for isolated development/test fixtures.

`renew` requires the current profile version, keeps the programme by default, chooses a supported stage, persists the replacement, rotates the existing owned chat session and clears prior Advisor state and pending support consent. It does not change JWT identity, existing tickets or account ownership. `withChat` rejects old/foreign profile IDs and session IDs with 409. Per-account serialization includes in-flight backend chat completion, preventing a confirmation from being executed under the next persona. The widget aborts obsolete client requests, clears old visible chat/actions and ignores stale responses/finalizers. It never silently retries a conflicting POST.

The lock is process-local, appropriate for the current single-instance Render Free deployment. Multiple backend instances would require a distributed version/locking mechanism before scaling. Storage write/network outcome ambiguity can require refreshing the active profile; the client refreshes server context after failed regeneration and never fabricates replacement records.

## Course coverage and simulation rules

Official programme names come from the existing ingested prospectus catalogue. Courses come only from exact canonical cohort codes in the existing timetable index: BIT, BCS, BSPH and LLB. Single unambiguous course codes are accepted; combined course codes, PT/NEW cohort variants and ambiguous programme mappings are excluded. These are observed timetable courses, **not a verified complete curriculum**.

- BIT: Years 1–4, semesters 1–2; 27 observed course-period records.
- BCS: Year 1 semesters 1–2 and Year 2 semester 1; 11 records.
- BSPH: Year 1 semester 2 and Years 2–4 semesters 1–2; 36 records.
- LLB: Year 1 semester 1 only; one record. No previous-period performance can be inferred.

Nursing degree/diploma course mapping is not sufficiently unambiguous to expose as an academic scenario. Existing nursing avatar assets and entitlements remain supported and tested; no curriculum was invented to make them selectable here. Unmapped periods return an explicit limitation.

**Unverified, explicitly simulated grading:** Assignment 1, Midexam 1, Practical and Project 1 each contribute up to 10 points, totaling CA /40. Scores contribute score/10. Current courses contain available, pending or locked assessments; partial CA is distinguished from a full total and excluded from lowest/full-average rankings. Completed periods contain all four contributions and a fictional exam weighted /60. Final mark is the rounded sum. Fictional letters: A 75+, B 65+, C 55+, D 45+, E below 45. These are not claims about UNILUS policy. No official GPA, pass/fail, supplementary, graduation or progression decision is calculated. Unfinished periods never publish final marks.

## Frontend and structured chat

The login retains username/password/sign-in and existing branding, removes programme selection and visibly warns against real university passwords. New Profile sits immediately before Apply Now, with a compact keep/random/specific settings menu; mobile uses the refresh icon with an accessible name. The page preserves the existing green header/sidebar and dashboard architecture. CA uses the reference gradient overview, four cards and weighted assessment matrix. Finals use the reference crest/identity/period/table/print composition, replacing any verification QR with a conspicuous fictional stamp. No personal screenshot identity, student number, grade set or QR was used as data.

Portal rendering reads only the authenticated backend profile. The same structured records are passed internally to `demoAcademicChatService.tryAnswer`; Groq does not generate marks. Identity, CA, current performance, lowest fully available CA, previous best course, final results, pending assessments and completed-year comparisons are deterministic. Timetable queries use the active server-owned programme/year/semester. Nonacademic questions retain the conversational hotfix, Groq planning/generation, MiniLM/hybrid retrieval, Advisor, navigation and support routing. Existing API fields remain; `academic` and `demoProfileId` are additive.

Examples (values vary once per new scenario):

- “What are my CA marks?” → same course contributions as CA Marks, with partial/pending states.
- “What was my best course last semester?” → maximum structured final mark in the immediate previous mapped period, or an explicit missing-data statement.
- “Show me my final results” → unpublished for the current unfinished semester.
- “Compare my Year 2 and Year 3 performance” → means of available completed mapped course records only; missing periods are not inferred.
- “What's my timetable?” → existing timetable retrieval using the active fictional academic stage.

Initial appearance uses existing technology/law/health/nursing/business assets where supported, otherwise default. Saved manual choices take precedence, including explicit default. Appearance preferences are keyed by authenticated account plus programme, independent of temporary persona IDs. Switching programme updates entitlements/initial outfit without mixing the two accounts' preferences.

## Files and functions

| File | Change |
|---|---|
| `backend/services/demoAcademicService.js` | `allowed`, `mappings`, `generate`, private object persistence, `get`, `renew`, `withChat` |
| `backend/services/demoAcademicChatService.js` | deterministic `tryAnswer` and means |
| `backend/routes/demoAcademicRoutes.js` | guarded own-profile GET/POST, supported-programmes GET, JSON 404 |
| `backend/app.js` | mount academic routes behind existing authentication/readiness/rate limits |
| `backend/routes/chatRoutes.js` | server-owned demo context wrapper, additive response fields |
| `backend/services/chatService.js` | structured academic branch, existing session history |
| `backend/services/supportConversationService.js` | targeted pending-consent reset |
| `backend/tests/demoAcademic.test.js` | 12 isolated integration/security/persistence tests |
| `backend/.env.example`, `render.yaml` | opt-in/configuration declarations, no credentials |
| `dummy-environment/js/demo-academics.js` | profile loading/regeneration, identity/period/CA/final rendering |
| `dummy-environment/css/demo-academics.css` | reference layout, mobile, focus and fictional print styling |
| `dummy-environment/portal.html`, `portal-login.html` | compact controls/views and login appearance |
| `dummy-environment/js/demo-session.js`, `portal-login.js` | isolated appearance cache, sign-in/logout cache reset |
| `dummy-environment/chatbot-widget/app.js` | profile payload, request fencing, 409 handling |
| `dummy-environment/chatbot-widget/avatar-entitlements.js` | initial programme outfit and manual precedence |
| `dummy-environment/chatbot-widget/tests/avatar-entitlements.test.cjs` | login/appearance/ownership regression coverage |
| `dummy-environment/chatbot-widget/tests/chat-actions.test.cjs` | old response fencing and conflict handling |
| `dummy-environment/chatbot-widget/dist/chatbot-widget.js` | rebuilt production bundle |
| `docs/ACADEMIC_SIMULATOR_RELEASE.md` | this review and release procedure |
| `.gitignore` | exclude local fictional browser screenshot artifacts |

## Verification

- Full supported backend `npm test`: **317/317 passed**, zero skipped/cancelled.
- Widget `node --test tests/*.test.cjs`: **129/129 passed**, zero skipped/cancelled.
- JavaScript syntax: **213/213 passed** across tracked/new JS/CJS/MJS.
- Widget `npm run build`: passed; 139.14 kB, gzip 43.38 kB. Existing Vite warning about future native config loading remains nonfatal.
- `git diff --check`: clean after removing one login whitespace defect.
- Known-private-value scan: 521 tracked/staged files checked, zero credential matches. Private account and environment files were read only and remain outside the repository.
- New integration tests use two synthetic JWT identities, temporary SQLite and profile files, and deny real network requests. They verify restart persistence in a second Node process, ownership/version/session forgery, mathematical consistency, consent reset, programme selection, existing timetable/Advisor and guest behaviour. A mocked private Storage REST test verifies server-only secret headers, private path, accepted MIME/upsert, stable reads and failure handling. It does **not** establish real-cloud simulator durability.
- The first targeted run in the sandbox could not connect to its loopback server (EACCES). The permitted host run passed all 12; the full host suite passed all 317. An earlier HTML 404 parsing failure was corrected with a JSON fallback route. No unresolved assertion failure remains.

Browser testing used an isolated localhost app with a preview-only synthetic login/database/profile store, no cloud credentials and no AI key. Confirmed login appearance; desktop CA; available/partial/locked columns; current-finals unavailable; completed fictional finals with no QR/GPA; New Profile identity and programme changes; existing technology/law outfit changes; structured chat values matching the portal; mobile 390×844 layout and sidebar navigation. The initial preview was serving older cached backend code; final-code checks used a fresh preview on port 8777, confirming combined course codes were absent. Local screenshot artifacts are in `deployment/simulator-*.jpg` and are not needed by the application.

Browser refresh also reproduced identical completed-period records. Keyboard Tab reached the profile-settings disclosure with a native focus outline and Enter opened it. Real hosted simulator writes, cloud restart behaviour, print-dialog output and a full cross-browser/screen-reader sweep remain post-authorization acceptance checks. Automated tests cover in-flight races, duplicate suppression, profile conflicts and restart records; those are not claimed as manually observed browser races.

## Exact combined deployment changes — authorization still required

1. Review this local commit together with parent hotfix `eba44d5`. Do not publish either separately. Push only the approved combined `codex/production-integration` branch after new explicit authorization; preserve main and keep auto-deploy disabled until coordinated release.
2. On the existing single Free Render service retain current PostgreSQL runtime role/TLS, Groq, MiniLM settings, secret files, CORS and existing private Storage credential/bucket. Add `DEMO_ACADEMIC_ENABLED=yes` and `DEMO_ACADEMIC_USERS` containing **only the exact two existing student usernames** from the private account file, comma-separated. Do not put account/password files or keys into source. No account recreation or password/JWT change is needed. No new dependency, SQL migration, bucket, MIME/policy change or knowledge bootstrap is needed. `DEMO_ACADEMIC_STORE_DIR` must be unset in production.
3. Deploy the approved combined commit to the existing Render Free service, wait for `/readyz`, then test both existing students against the new authenticated profile API. The first authorized profile visit will create its private fictional Storage object and owned chat session using existing infrastructure; all original university records remain separate.
4. Deploy the matching Netlify frontend/built widget to the existing site, retaining its verified Render HTTPS API configuration and exact existing CORS origin. Avoid a prolonged mixed frontend/backend version: the profile-version requirement intentionally rejects enabled demo chat from old clients. Ask active demo users to refresh after release. If necessary, enable the simulator variables only once both matching artifacts are ready.
5. Verify both accounts' private profile persistence across refresh and Render restart, cross-account denials, chat/portal values, New Profile and consent reset, timetable/Advisor/RAG/campus, support workflows and mobile/avatar behaviour. Use only fictional records. Do not create shared-data test tickets without separate authorization.
6. Revert both frontend/backend to the previous approved release and disable the simulator opt-in if acceptance fails. Existing private profile objects can remain inert; rollback requires no schema reversal or record deletion.

This preparation preserves the K0 architecture. It does not claim a production rollout for genuine student data or independently recoverable backups; previously accepted recovery limitations remain unchanged.
