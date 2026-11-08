# Academic simulator accuracy and UX corrections

Historical report for `3b40b14`. Its assessment distribution and verification counts are superseded by [the CA 30 / examination 70 correction](ACADEMIC_CA30_RELEASE.md). Grade boundaries and progression safeguards remain unchanged.

Local correction of `626a869`, retaining conversational hotfix `eba44d5`. No push, deployment, migration, shared database write, Storage operation or remote build was performed. The original workspaces and public deployment remain unchanged. This report supersedes the original simulator's grading and assessment assumptions.

## Before and after

| Area | Before | Corrected implementation |
|---|---|---|
| CA | Four equally weighted positive assessments; repeated technical warnings | Assignment /10, Midexam /20, explicit Class tests /10; Practical/Project N/A unless a verified configuration applies; concise help disclosure |
| Finals | Numeric marks plus incorrect letters; large warning stamp and several explanations | Course Name, Course Code, Grade only; compact identity/crest/period, consistent comment and Print Results |
| Provenance | Repeated disclaimers throughout ordinary responses/pages | One discreet persistent independent-demo notice; optional calculation help; small printed indication |
| Chat | Repeated rules and long per-course prose | Two-column Markdown results, short pending note, deterministic focused responses; mobile course titles wrap |
| Profile settings | Loose labels/controls and poor anchoring | Anchored 320px desktop / maximum 340px mobile panel, 40px controls, labelled disclosure, focus/keyboard/dismissal handling |
| Course selection | Sparse semesters, group suffixes, ambiguous cross-listing and special assessment courses | Minimum three clean, distinct course identities; unsupported stages omitted; timetable source unchanged |

The supplied official CA and Final Results screenshots were directly reviewed against local browser screenshots. Existing header/sidebar proportions and dashboard architecture were retained. Finals intentionally omit the reference's personal identifiers, verification QR and GPA. The extra Class tests CA column is deliberate: hiding the unaccounted 10% would be misleading. A complete official curriculum was not inferred from a timetable.

## Verified regulations and sources

Sources reviewed on 9 November 2026:

- [Official UNILUS grading page](https://web.unilus.ac.zm/research-2-2/), undergraduate table.
- [Student Handbook](https://web.unilus.ac.zm/wp-content/uploads/2025/09/University-of-Lusaka-Student-Handbook.pdf), §§9.8, 9.10–9.14 and 9.17; printed pages 34–39, PDF pages 43–48.
- [2026 prospectus](https://web.unilus.ac.zm/wp-content/uploads/2026/04/UNILUS-PROSPECTUS-2026-11.pdf), printed pages 7 and 21, PDF pages 8 and 22.

The grading webpage was fetched live. The web reader could not load the large handbook and timed out on the prospectus; their existing repository PDF copies were parsed directly using PDF tools. Their extracted text agrees with the supplied section references. No claim is made that these local PDF bytes were newly hash-matched to the remote files.

`undergraduateAcademicPolicy.undergraduateGrade` is the single grade converter:

| Integer mark | Grade |
|---|---|
| 86–100 | A+ |
| 76–85 | A |
| 66–75 | B+ |
| 61–65 | B |
| 56–60 | C+ |
| 50–55 | C |
| 0–49 | D |

Thus 74 and 68 produce B+, and 53 produces C. The prospectus lists A+ from 85 while also including 85 in A. The implementation follows the unambiguous grading webpage and handbook boundary of 86. Invalid/noninteger marks are rejected by the converter; rounding of internally generated totals remains an explicitly chosen simulator rule, not a newly verified university rounding policy.

### Comments and progression

`semesterOutcome` distinguishes incomplete/unpublished results from an explicitly not-examined course. With a verified complete course load, every completed course must meet the published passing band for Clear Pass. The four-course/two-failure and five-course/three-failure repetition rules are tested separately; a blanket “half the courses” formula is not substituted.

The handbook's formal Repeat term corresponds to the prospectus's more specific Repeat Course / Repeat Semester labels. Proceed and Repeat and Proceed involve institutional discretion and prerequisite conditions. Exclude School and Exclude University are distinct formal decisions. The function only recognizes those discretionary outcomes when explicit supporting decision/condition metadata is supplied; no generated profile fabricates that metadata or repeat-history evidence.

The prospectus's common-comments list appears in its Medicine and Health Sciences section. It supplies terminology, not proof of a universal automatic progression algorithm; the detailed handbook conditions govern the implementation.

Current source mappings do **not** establish the full registered course load, prerequisites or attendance. Generated periods therefore keep `completeCourseLoadVerified=false`. The displayed deterministic comment is limited to available results: “All available courses passed” or the count of courses needing attention. It is not presented as official semester clearance. The comment's contextual detail explains the limitation, without another large warning panel.

### CA uncertainties and configuration

Handbook §9.11.4 establishes full-time/evening components: mid-semester exam 20, assignments 10, class tests 10, final exam 60. Section 9.11.5 describes a different distance-learning split. Both schemes are centralized and validated to total CA /40. Course-specific component configurations are accepted by the academic model only with valid weights; nonzero practical/project weights additionally require a verified-source annotation. No such course-specific evidence is currently configured.

The supplied CA screenshot shows empty records and four named columns. It cannot establish whether class tests are separately represented, combined into another portal field or absent from that displayed configuration. Existing backend models provide no authoritative portal mapping either. The simulator therefore uses the handbook's full-time/evening scheme and exposes Class tests as an extra column, with this uncertainty available in optional help. It does not hide 10 points, rescale 30 into 40 or assign the missing component to Practical/Project.

Available recorded zero is `score=0`, `status=available`, displayed 0.0. Pending/locked contributions remain null and are excluded from partial sums. Not-applicable components have weight/contribution zero, no score, and display N/A. Complete CA is the sum of all applicable contributions, with each displayed contribution rounded consistently to one decimal. Partial CA is never ranked against complete totals. All portal/chat calculations use the same stored records. Unknown practical/attachment/project/research assessment structures are excluded from these default academic scenarios instead of receiving invented positive marks.

## Course coverage

Academic identity cleanup is separate from timetable presentation, which deliberately retains legitimate cohort information. It strips trailing group/cohort suffixes and known scheduling noise only for academic records; preserves meaningful text such as C#; rejects combined/embedded conflicting codes and duplicate identities; and excludes unverified special-assessment courses. A stage needs at least three usable courses before it can become a scenario.

- BIT: 1/1, 1/2, 2/2, 3/2, 4/1, 4/2.
- BCS: 1/1 and 2/1.
- BSPH: 1/2, 2/1, 2/2, 3/1, 3/2, 4/1.
- LLB's single-course stage, sparse BIT/BCS stages and unsupported nursing mappings are not offered. Existing outfit assets and general catalogue entries remain intact.

A missing immediate previous semester is reported as unavailable; the chatbot never silently substitutes an older period. Existing timetable retrieval remains unchanged and uses the active server-owned programme/year/semester.

## Chat behaviour

Examples, with actual values supplied by the active authorized profile:

- **What are my CA marks?** → year/semester once, Course and CA /40 table, partial totals flagged, brief pending-assessment follow-up.
- **What's my lowest/highest CA?** → one ranked complete CA result; pending totals excluded.
- **Which assessments are pending?** → course and actual pending/locked component names; N/A Practical/Project are not reported as pending.
- **Show my final results** → current finals unpublished, or a letter-only grade table for an explicitly requested completed period.
- **Did I clear the semester? / Which subjects require attention?** → outcome computed from the same course records, with limited-data qualification where needed.
- **Compare my results across semesters** → completed-period pass counts; missing periods excluded, no invented GPA or numerical final-mark table.

No extra Groq call retrieves marks. “Yes please” to the specific pending-assessment offer uses the existing owned session's last message, not a new memory system. Switching into academic results clears stale support consent. A synthetic regression verifies this follow-up cannot submit an earlier proposed ticket. Ordinary explicit support confirmation and all conversational-hotfix tests remain intact.

## Security and stored-profile compatibility

JWT account ownership, the two private student logins, staff/admin identities, restricted server Storage access, per-account persistence, session/version checks, request fencing and manual outfit precedence are preserved. Existing integration tests continue to reject foreign profile IDs and session reuse. No private account file or credential was changed.

New profiles carry assessment model version 2. An older model's marks are neither silently reinterpreted nor regenerated on refresh. Its API response hides the incompatible periods, indicates that New Profile is needed, and rejects academic chat until the authenticated student explicitly regenerates. This is local data-model compatibility, not a SQL migration. Existing private Storage object paths remain unchanged. Valid version-2 records retain their seed, ID and marks across refresh/restart.

## Browser verification

Actual in-app browser tests used only a localhost synthetic account, temporary SQLite/profile files, and no cloud/AI credentials:

- Login still accepts only demonstration username/password; redundant footer warning removed while the prominent real-password warning remains.
- Desktop CA: weighted /10, /20 and Class tests /10 columns; N/A vs pending/locked; partial and complete totals.
- Desktop finals: precisely three table columns; fictional identity/period; consistent limited comment; no numerical final marks, oversized stamp or QR.
- Popover: desktop anchoring; mobile 340px bounds within 390px viewport; identical 40px select heights; no period-selector overlap; Escape closes and restores trigger focus; outside click closes; preference changes do not regenerate.
- Mobile academic chat: normal wrapping course names in a 246px table; no page overflow from the result table. The existing safe Markdown renderer and sanitizer are reused.
- Explicit programme regeneration changed identity and academic context from BIT to BSPH; the existing technology outfit changed to the default outfit for Public Health.
- Completed results were identical after browser refresh. Portal and chat letter-grade results were checked for the same account/profile/period.
- Viewport override was reset after mobile checks.

The Print Results action was invoked, but native printing blocked browser automation and exposed no inspectable print preview. That tab was closed. Print CSS was inspected (only results, no navigation/widget, and a small independent-demo footer), but printed-page rendering remains a manual acceptance check. No print job was submitted. Full screen-reader/cross-browser and hosted restart checks are likewise not claimed.

Local artifacts: `deployment/simulator-corrected-ca.jpg`, `simulator-corrected-finals.jpg`, `simulator-corrected-popover.jpg`, `simulator-corrected-popover-mobile.jpg`, and `simulator-corrected-chat-mobile.jpg`. These contain only synthetic data and are ignored by Git.

## Tests and changed files

- Full backend: **342/342 passed**, zero skipped/cancelled.
- Full widget: **130/130 passed**, zero skipped/cancelled.
- Syntax checks: **215/215 passed**.
- Production widget build: passed, 139.21 kB / gzip 43.41 kB. The existing nonfatal future Vite native-config-loader warning remains.
- Diff whitespace check passed. The known-private-value scan checked 524 tracked/staged files and found zero credential matches.
- Grade boundary tests include both ends of every band, the three reported examples and invalid marks. Policy tests cover configuration totals/evidence, full vs incomplete loads, repetition thresholds, discretionary metadata, and explicit not-examined status.
- Synthetic integration tests cover weighted CA, final conversion, portal/chat equality, unsupported periods, concise focused queries, explicit old-model reset, consent-safe follow-up, account isolation, profile/session forgery, restart persistence, Storage headers/failure handling and existing timetable/Advisor routing.

| File | Functions / purpose |
|---|---|
| `backend/services/undergraduateAcademicPolicy.js` | centralized grade, assessment configuration and semester outcome |
| `backend/services/demoAcademicService.js` | `mappings`, `generate`, `publicProfile`, `withChat`; clean coverage and version-2 model |
| `backend/services/demoAcademicChatService.js` | concise deterministic `tryAnswer`, focused rankings/results/comparisons |
| `backend/services/chatService.js` | existing-session academic follow-up and stale-consent clearing |
| `backend/tests/undergraduateAcademicPolicy.test.js` | grade/configuration/outcome tests |
| `backend/tests/demoAcademic.test.js` | expanded integration and safety checks |
| `dummy-environment/js/demo-academics.js` | compact render, disclosure focus/dismissal, explicit regeneration |
| `dummy-environment/css/demo-academics.css` | reference-style results, responsive popover and print rules |
| `dummy-environment/portal.html`, `portal-login.html` | accessible settings labels and consolidated notice |
| `dummy-environment/chatbot-widget/app.js`, `widget.css` | academic response class and compact wrapping tables |
| `dummy-environment/chatbot-widget/tests/chat-actions.test.cjs` | table-layout response handling |
| `dummy-environment/chatbot-widget/dist/chatbot-widget.js` | rebuilt bundle |
| `docs/ACADEMIC_SIMULATOR_RELEASE.md` | mark previous assumptions historical |
| `docs/ACADEMIC_SIMULATOR_CORRECTIONS.md` | this review |

## Remaining release conditions

Review this correction together with `626a869` and parent `eba44d5` for **one combined release**. Explicit new authorization is required to push or deploy. Existing Free Render/Netlify/Supabase configuration and the two simulator enable/allowlist settings remain the release prerequisites; no new dependency, migration, project, bucket or knowledge bootstrap is required. Complete the manual print check and post-release real-cloud Storage/restart acceptance. Obtain an authoritative populated assessment configuration before claiming exact fidelity to the live portal's class-test representation, or enable further programme/course schemes only after verification.
