# Academic CA 30 / examination 70 correction

Completed against the existing uncommitted working tree, preserving the earlier simulator, conversational hotfix and correction commits. This is a local academic correction only. Nothing was pushed, deployed, migrated or written to shared Supabase resources. Silverest map verification is deferred to the separately requested task.

## Model and display

The owner-selected fictional assessment configuration is Assignment 1 maximum 10, Midexam 1 maximum 20, Practical recorded 0 and Project 1 recorded 0. CA maximum is 30, examination maximum is 70 and the internal course total is at most 100. This is explicitly distinguished in backend policy metadata from the handbook distribution; it is not described as a universally verified university policy.

Scores are actual integer points. There is no percentage conversion, hidden contribution, class test, adjustment or rescaling. `assessmentRecord` validates every recorded score against its component maximum. `courseResults` validates the full CA maximum, requires complete CA before producing finals and rejects examination points outside 0–70. The unchanged centralized undergraduate converter determines the letter grade. For example, CA 24 plus examination 50 produces internal mark 74 and grade B+.

| Assignment 1 | Midexam 1 | Practical | Project 1 | Total CA |
|---|---|---|---|---|
| 8 | 16 | 0 | 0 | 24 |
| 6 | 12 | 0 | 0 | 18 |
| 10 | 19 | 0 | 0 | 29 |
| 0 | 0 | 0 | 0 | 0 |
| 0 | — | 0 | 0 | — |

The first four examples are complete records, including the all-zero record. The final example has a genuinely missing Midexam: its score/contribution remain null with a separate pending status, and the total is not published. Practical and Project are available recorded zeros, not N/A or missing results. Complete totals always equal the sum of their components. Available subtotals are retained internally for compatibility but are not substituted for complete totals in the UI.

The CA portal retains its layout and status column, with plain number cells and dashes for unavailable values. It removes denominator subheadings, Class tests, N/A, Partial labels and assessment-weight explanations. Final Results retains exactly Course Name, Course Code and Grade, plus the existing semester comment and print control. Numerical examination/final marks stay internal. The semester-comment safeguards are unchanged.

Typical structured reply:

> Here are your CA marks for Year 2, Semester 2:

| Course | CA |
|---|---|
| BIT214 | 24 |
| BIT256 | 28 |
| BIT242 | 19 |

> All coursework marks are available.

Missing totals instead appear as dashes with a brief awaiting-upload follow-up. Highest/lowest comparisons use complete totals, including legitimate zero totals. These replies read the same active server-owned records as the portal and require no Groq call. Existing explicit ticket consent and the pending-assessment follow-up remain covered by regression tests.

## Stored-profile compatibility and isolation

The finished model is version **4**. Version 3 had already been allocated by the unfinished working-tree implementation; reusing it could misinterpret partially generated records. Profiles with missing versions or versions 1, 2 or 3 are retained intact, have their incompatible periods hidden from the API response and cannot enter academic chat. The UI asks the authenticated student to choose New Profile. No marks or seed are silently converted on GET/refresh.

Explicit regeneration creates a new fictional profile and owned chat session, clears the old contextual state and preserves the JWT/account identity. Foreign IDs and sessions remain rejected. No schema migration or Storage resource change is required. Version-4 profile marks remain stable across reads, page-state reloads and process restarts. Two separate synthetic account identities verify both sides of this isolation.

## Verification results

| Check | Result |
|---|---|
| Full supported backend suite, `npm test` | 345 passed, 0 failed/skipped/cancelled |
| Full widget suite, `node --test tests/*.test.cjs` | 133 passed, 0 failed/skipped/cancelled |
| JavaScript syntax checks | 216 passed, 0 failures |
| Production widget build | Passed, 139.21 kB / gzip 43.41 kB |
| Production public API configuration generation | Passed; existing HTTPS backend endpoint retained |
| Local HTTP preview asset/API checks | Passed before and after an actual backend process restart |
| Diff whitespace check | Passed |
| Credential scan | 526 tracked files, zero private-value matches |

The existing Vite future native-config-loader warning remains nonfatal. The frontend uses the repository's existing static Netlify publication workflow and production widget build; there is no additional portal bundler.

Tests verify component and examination bounds, all-zero complete CA, missing-vs-zero distinction, exact arithmetic, all existing grade boundaries, old model compatibility, unchanged authentication identity, profile regeneration, session fencing, two-account restart persistence, portal/API/chat record equality, support consent and existing timetable/Advisor/conversational behaviour.

The new portal tests execute the actual `demo-academics.js` initialization/render/event code in a local JavaScript test harness and parse its resulting HTML with the existing Cheerio dependency. They assert exact numeric/dash cells, status labels, absence of denominators/partial/N/A/Class tests, the three-column letter-only finals table, and explicit old-profile regeneration. They are rendering regression tests, not visual browser tests.

The synthetic localhost preview loaded the portal HTML, renderer JavaScript, stylesheet, production widget bundle and crest successfully. Its runtime-config endpoint points only to the local API. API results and academic-chat records remained identical after repeated reads and an actual stop/restart using the same temporary database/profile files. No private real account configuration or cloud credential was used by this preview.

### Browser limitation

Actual local browser interaction was attempted through the available Windows computer-use tool. The platform stopped it because URL-policy enforcement is unsupported for that Windows browser. No visual browser checks or new screenshots are claimed. The unsupported method was not retried and no security controls were bypassed. The earlier phase's screenshots do not verify this new assessment model.

When browser access is available, the remaining manual check is:

1. In this local checkout, run `node deployment/ca30-preview.txt` using Node 24. This local-only helper is retained as an ignored review artifact and uses a temporary synthetic account/data store. Add `--resume` to reuse that synthetic store.
2. Open `http://127.0.0.1:8790/portal-login.html` and sign in with preview-only username `preview-student`, password `Synthetic-Preview-Only`. These are disposable synthetic test credentials, not university or deployed demonstration credentials.
3. Open CA Marks on desktop/mobile. Check numeric Assignment/Midexam/Practical/Project/Total cells, recorded zeros, unavailable dashes and the separate upload-status column. There should be no Class tests, N/A, Partial or denominator labels.
4. Ask the widget for CA marks and compare complete totals; select a completed period and check letter-only Final Results. Refresh, regenerate explicitly and confirm context updates. Do not use real university credentials or create support tickets for this check.

This visual check is still pending. Automated correctness/build/security checks are complete; browser appearance should be reviewed before deployment. No deployment authorization is implied by this local commit.

## Files and functions changed

| File | Change |
|---|---|
| `backend/services/undergraduateAcademicPolicy.js` | model version/constants, demo-only configuration, `assessmentRecord`, `courseResults`; grade/progression rules preserved |
| `backend/services/demoAcademicService.js` | actual-point generation, default recorded zeros, 70-point examination, version-4 compatibility |
| `backend/services/demoAcademicChatService.js` | compact course-code/CA tables with plain totals and missing dashes |
| `dummy-environment/js/demo-academics.js` | numeric CA rendering and removal of obsolete labels/configuration explanations |
| `backend/tests/undergraduateAcademicPolicy.test.js` | 30/70 model, validation, zero/missing and total/grade assertions |
| `backend/tests/demoAcademic.test.js` | API/chat equality, model versions, two-account restart and consent regressions |
| `dummy-environment/chatbot-widget/tests/demo-academic-presentation.test.cjs` | executable portal rendering and compatibility tests |
| `docs/ACADEMIC_SIMULATOR_CORRECTIONS.md` | mark old assessment assumptions historical |
| `docs/ACADEMIC_CA30_RELEASE.md` | this release record and remaining manual browser check |

Existing preview scripts, test logs and JSON reports under `deployment/ca30-*` remain ignored local artifacts. No widget implementation, campus source/data/photo, authentication, knowledge corpus, migration, private credential or shared record was changed. The production widget was rebuilt successfully; its bundle contents did not change because the academic portal renderer is a separate static script.
