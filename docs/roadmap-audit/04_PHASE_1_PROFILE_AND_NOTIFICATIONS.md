# Phase 1 — fixed profile and unified notifications

> **Phase 1 implementation update (2026-11-10):** Read [the implementation delta, fresh tests and remaining acceptance gates](16_PHASE_1_IMPLEMENTATION.md) before using this historical audit snapshot. Fixed profile, automatic import adapter, persisted override and widget inbox are now implemented locally; no production release or browser acceptance is claimed.


Audit: **2026-11-10, Africa/Lusaka**. Local HEAD `9cbdeb0517da8820b94a623d9b8facbef50ae1ee`, branch `codex/production-integration`, **with pre-existing uncommitted unified-notification work**. Source findings describe that working tree unless explicitly marked production. Documentation only; no implementation/release authorized. [Master](00_MASTER_AUDIT.md) · [Evidence freshness](14_DECISIONS_AND_ASSUMPTIONS.md)

## State and account reconciliation
**PARTIALLY IMPLEMENTED overall.** Reuse existing signed account/owned session, simulator version4, private profile Storage, ticket events/receipts and local timetable diff/publication/inbox. No competing auth/session/notification system.

Fixed target: Luka Hamududu, BIT24240001, BSc Information Systems and Technology (BIT), Year3 Semester2, username demo. Password remains private/hashed, never in frontend/docs. Metadata-only local private account check found two BIT3.2 students, **neither named demo**. File order is not durable Account1/2 identity. Confirm designated fictional Account2 mapping before changing username/owner paths; hosted secret-file identity was not inspected. Do not copy another user's tickets/profile silently.

Propose server-only account policy flexible/fixed. Fixed policy pins identity/stage and a versioned fixed simulated transcript; renew cannot randomize it. Flexible account retains generate/renew. Preserve allowed feature/user gates, scrypt/JWT, expectedProfileId/session conflict checks and owner-hashed Storage paths. Updating usernames changes ticket/session/profile ownership; plan explicit authorized fictional account reconciliation and refresh tokens. Browser labels are not authentication.

## Existing simulator mechanics
demoAcademicService.js allowed/mappings/generate/load/renew/publicProfile/withChat are exact modification points. mappings takes timetable stage codes matching BIT/BCS/BSPH/LLB, excludes project/research/practical/seminar names and unresolved embedded codes, drops periods<3 courses and omits suffixed curriculum/PT codes. generate uses random seed/name/number/marks/active stage; renew randomizes stage. load can create/persist profile on GET; publicProfile removes seed and handles incompatible model. withChat validates owner/profile/session. Storage lock is process-local, not multi-instance CAS.

undergraduateAcademicPolicy model4 centralizes CA30/exam70 and Assignment10/Midexam20/Practical0/Project0. Preserve academic corrections and numeric presentation. Results/outcomes remain simulated and course-load completeness unverified.

## Complete 35-course reconciliation
Authority is the owner-transcribed portal checklist, not an independently fetched current university curriculum. Raw scheduled course-code matches below preserve source titles; BIT columns list actual matching programme stages, not inferred enrolment. Simulator period column exposes where retained mappings currently place the code. Normalized exact match removes case/punctuation only; differing names need alias/version review, not automatic equivalence.

| Owner period | Owner code/title | Existing raw timetable title(s) | BIT coverage | Retained simulator period | Finding |
|---|---|---|---|---|---|
| 1.1 | BBA141 — Communication Skills | Business Communication Skills Group D; D_ Business Communication Skills Group D; Business Communication Skills GROUP A; Business Communication Skills Group A TUTORIAL; B* Business Communication Skills GROUP B; COMMUNICATION SKILLS GROUP C; Business Communication Skills Group TUTORIAL; Business Communication Skills Group B TUTORIAL; BSPH COMMUNICATION SKILLS GROUP D; BSPHb COMMUNICATION SKILLS GROUP D; Business Communication Skills EDUCATION GROUP#Virtual; FT_ED Business Communication Skills EDUCATION GROUP#115 | BIT11, BIT11- PT | 1.1 | Title variant: review alias/version |
| 1.1 | BIT101 — Introduction to Business Information Systems | Introduction to Business Information Systems; PT#5 Introduction to Business Information Systems | BIT11, BIT11- PT | 1.1 | Exact normalized title present |
| 1.1 | BIT102 — Computer Mathematics | BSC 111 Mathematics#70; TT#90 Computer Mathematics TUTORIAL Group A; TT# Computer Mathematics TUTORIAL Group C; TT## Computer Mathematics TUTORIAL Group B; Computer Mathematics PT#5; \BSC111TT Computer Mathematics Tutorial Group A | BIT11, BIT11- PT | 1.1 | Title variant: review alias/version |
| 1.1 | BIT110 — Computer Systems Architecture | No scheduled title | None | Absent | No scheduled row |
| 1.2 | BBA140 — Business Environment | Business Environment GROUP C; " Business Environment Tutorial Group-BSPH; Business Environment Tutorial Group C - LLB; B_LAW Business Environment Tutorial Group B - LLB; Business Environment Tutorial Group-AFIN; BUSINESS ENVIRONMENT GROUP A; Business Environment Tutorial Group-BFIN; ' Business Environment Tutorial Group-ECF; Business Environment PT\DL#25; TT_E_ Business Environment Tutorial Group E and F -LLB; TT_D Business Environment Tutorial Group D-LLB; *LAW#230 Business Environment LAW; TT_A Business Environment Tutorial Group A-LLB; *LAW#230b Business Environment LAW; Business Environment GROUP B; B_ Business Environment GROUP B; TT_A Business Environment Tutorial Group-BACT/BSM/BLTM; TT_B Business Environment Tutorial Group B-BBA; TT_H Business Environment Tutorial Group H-BBA; TT_G Business Environment Tutorial Group G-ECA/BIP/BPS; TT_E Business Environment Tutorial Group E-HRM; TT_C Business Environment Tutorial Group C-ED; ,TT Business Environment Tutorial Group B-ED | BIT12, BIT12- PT | 1.2 | Title variant: review alias/version |
| 1.2 | BIT107 — Operating System Operations and Services | Operating Systems Operations and Services Group A#60; Operating Systems Operations and Services PT/DL#9 | BIT12, BIT12- PT | 1.2 | Title variant: review alias/version |
| 1.2 | BIT112 — Pseudocode and Programming Logic | Pseudo Code and Programming Logic; Introduction to Programing/Programing Concepts Computer Lab Tutorial; FT Pseudo Code and Programming Logic; PT#10 Pseudo Code and Programming Logic PT#10 | BIT12, BIT12- PT | 1.2 | Exact normalized title present |
| 1.2 | BIT121 — Data and Information Management | No scheduled title | None | Absent | No scheduled row |
| 2.1 | AFIN102 — Financial Accounting | Financial Accounting GROUP A; Financial Accounting GROUP B#350; E_TTd Financial Accounting Tutorial Group E#128; PT/DL Financial Accounting PT#128; B-#120 Financial Accounting Group B#128; B_TTb Financial Accounting Tutorial Group B#128 | BIT21, BIT21- PT | Absent | Title variant: review alias/version |
| 2.1 | BIT213 — Introduction to Programming - JAVA | PT#5 Java Programming For Beginners#5 | BIT21- PT | Absent | Title variant: review alias/version |
| 2.1 | BIT222 — Database Design and Management | Database Design and Management | BIT21 | Absent | Exact normalized title present |
| 2.1 | BIT241 — Network and Telecom Systems | No scheduled title | None | Absent | No scheduled row |
| 2.2 | BBA240 — Quantitative Methods | BUS#2_A Quantitave Methods Business Students GROUP A#250; C_TT#Z.CA Quantitave Methods Group C TUTORIAL#100; PT\DL# Quantitave Methods PT\DL; A_TT#1 Quantitave Methods TUTORIAL Group A#100; BUS#B. Quantitave Methods Business Students GROUP B#250; BUS#B Quantitave Methods Business Students GROUP B#250; B_TT#B Quantitave Methods Group B#100; ED#50 Quantitave Methods Education Students#50; ED_TT Quantitave Methods Education Students TUTORIAL | BIT22, BIT22- PT | 2.2 | Title variant: review alias/version |
| 2.2 | BIT214 — Advanced Programming | Advanced Java Programming TUTORIAL; \BSC221 Advanced Java Programming; PT#2 Advanced Programming -Java PT | BIT22, BIT22- PT | 2.2 | Title variant: review alias/version |
| 2.2 | BIT242 — Network Design and Management (Enterprise Network) | Network Design and Management; Network Design and Management PT; FT#20. Network Design and Management#20 | BIT22, BIT22- PT | 2.2 | Title variant: review alias/version |
| 2.2 | BIT254 — Multimedia Systems and Applications | No scheduled title | None | Absent | No scheduled row |
| 2.2 | BIT256 — Data Structures and Algorithms | Data Structures and Algorithms#15; Data Structures and Algorithms_PT | BIT22, BIT22- PT | 2.2 | Title variant: review alias/version |
| 3.1 | BBA361 — Research Methods in Business and Social Science | No scheduled title | None | Absent | No scheduled row |
| 3.1 | BIT315 — Business Web Application Development - Client Side | PT\DL Business Web ApplicationDevelopment- Client Side | BIT31- PT | Absent | Title variant: review alias/version |
| 3.1 | BIT316 — Project Management | Project Management; Project Management TUTORIAL; PT\DL Project Management PT\DL | BIT31, BIT31- PT | Absent | Exact normalized title present |
| 3.1 | BIT325 — Systems Analysis and Design | No scheduled title | None | Absent | No scheduled row |
| 3.1 | BIT353 — Big Data and Data Warehousing | No scheduled title | None | Absent | No scheduled row |
| 3.2 | BBA360 — Entrepreneurship and Innovation | Entrepreneurship & Innovation; PT_ Entrepreneurship & Innovation PT; PNRb Entrepreneurship & Innovation; PNR Entrepreneurship & Innovation; Entrepreneurship & Innovation TUTORIAL GROUP E; Entrepreneurship & Innovation TUTORIAL GROUP F; Entrepreneurship & Innovation TUTORIAL GROUP B | BIT32, BIT32- PT | 3.2 | Title variant: review alias/version |
| 3.2 | BIT301 — E-Business and Enterprise Information System | E-Business and Enterprise Information Sysystems; PT/DL_VT Decision Support Systems PT VIRTUAL CLASS | BIT32, BIT32- PT | 3.2 | Title variant: review alias/version |
| 3.2 | BIT320 — Group Studio ICT Projects | Group Studio ICT Projects; TT Group Studio ICT Projects; PT\DL Group Studio ICT Projects | BIT32, BIT32- PT | Absent | Exact normalized title present |
| 3.2 | BIT326 — Systems Development and Implementation | Systems Development and Implementation; PT\DL Systems Development and Implementation | BIT32, BIT32- PT | 3.2 | Exact normalized title present |
| 3.2 | BIT346 — Business Web Development - Server Side | Business Web Development -Server Side with Visual Studio and C#; Business Web Development -Server Side with Visual Studio and C TUTORIAL; PT\DL Business Web Development -Server Side with Visual Studio and C# | BIT32, BIT32- PT | 3.2 | Title variant: review alias/version |
| 4.1 | BIT402 — ICT Project/Research | IS Project /Research | BIT41, BIT42, BITED42 | Absent | Title variant: review alias/version |
| 4.1 | BIT405 — Information Technology Law | Information Technology Law For IT TUTORIAL; Information Technology Law For IT; PT\DL Information Technology Law For IT | BIT41, BIT41- PT, BITED41, BITED41- PT | 4.1 | Title variant: review alias/version |
| 4.1 | BIT442 — Information Systems and Society | Information Sytems and Society#5; PT\DL Information Systems Project Management#10 | BIT41, BIT41- PT | 4.1 | Title variant: review alias/version |
| 4.1 | BIT446 — Strategic Information Systems and Business Policy | Strategic Information Systems and Business Policies#12; Strategic Information Systems and Business Policy | BIT41, BIT42 | 4.1, 4.2 | Exact normalized title present |
| 4.2 | BIT416 — Current Trends in ICT | Current Trends in ICT; PT\DL Current Trends in ICT | BIT42, BIT42- PT | 4.2 | Exact normalized title present |
| 4.2 | BIT423 — ICT Project/Research | No scheduled title | None | Absent | No scheduled row |
| 4.2 | BIT434 — Information Technology Security | PT\DL Information Technology Security | BIT42- PT | Absent | Title variant: review alias/version |
| 4.2 | BIT443 — System Administration (Linux) | System Administration(Linux); TT System Administration(Linux) TUTORIAL; PT\DL System Administration(Linux) | BIT42, BIT42- PT | 4.2 | Exact normalized title present |

Summary:35 courses; 27 have raw scheduled code matches, 8 have none; 19 appear anywhere in retained BIT mappings, 19 in the owner-specified period. See [machine reconciliation](course-reconciliation.json). Missing schedule row does not establish a missing university course. Retained BIT mappings lack entire2.1/3.1; include BSC111 outside owner1.1 and BIT446 in4.2 as well as4.1. Legitimate project courses are excluded by the simulator heuristic.

### Data strategy
Keep four concepts separate: canonical35-course curriculum with source/version/aliases; current registration of five3.2 courses BBA360/BIT301/BIT320/BIT326/BIT346; first five completed semesters22 courses with **fixed clearly simulated** marks; fourth-year8 future curriculum courses with no results. Do not invent official historical marks. Freeze an owner-approved fictional fixture once, or leave unknown marks null until approved. Retain existing CA/exam policy, model/version and source labels.

Shared academicContextService proposal returns signed owner/profileId/version, canonical programme/stage, registration, known group with confidence, history reference and freshness/simulation flags. Reuse phases2/5/6. Luka's group is not supplied: null class_group and programme-name A1 do not prove his membership. Include BBA/AFIN registered courses, not just BIT-prefixed codes. Alias conflicts require review, not duplicate catalogue entries.

## Automatic authoritative timetable updates
Current local timetableNotificationService.publish is explicit accepted publication plus manual subscription; that is superseded. Add a small coordinator called after a successful authoritative import, with complete-source manifest/period/hash/errors/coverage validation, then normalize/deduplicate/diff and transactionally publish immutable snapshot/head/events. **No extra operator approval or own-programme subscription is required.** Automatic validation remains mandatory. Python source is unavailable; source-completeness contract must be obtained before release.

Reuse timetableChangeService stable keys and reorder/whitespace/duplicate suppression, meaningful time/day/venue/lecturer changes and additions/removals. Keep expected-head/advisory-lock/idempotency checks. Failed/partial/shrunken extraction retains previous head; initial new period establishes silent baseline. A removed published session is not automatically a cancelled class. Lecturer-only changes must not broadcast to guessed cohorts. DB accepted head becomes runtime authority; JSON stages imports/cache, not independent divergent truth.

Replace subscription eligibility with server profile/registration/programme-stage/group association. Exclude unrelated levels/programmes/groups; shared BBA/AFIN code needs reliable cohort association. Unknown group-specific eligibility must be qualified/withheld, never guessed. Existing inbox/receipt semantics remain reusable; client cannot select owner.

## Two-minute database demonstration
Propose additive timetable_demo_overrides: id, base publication/version hash, stable real session key, permitted temporary field/value, fictional target/profile, starts_at/expires_at absolute timestamp, simulated flag and creator. Base remains immutable. Effective resolver overlays only while starts_at<=DBnow<expires_at and version matches; all timetable/detail/personalized reads use it. Expiry restores base even when backend crashes/sleeps.

Transaction + per-session lock reject overlap/stale base/non-demo targets. Unique lifecycle event keys(overrideId,applied/restored) deduplicate across instances. Persist override/event atomically; lazy reconcile expired restoration event on startup/read. Worker optional for timeliness, not correctness. **Data expiry punctual; notification delivery may be delayed by Render suspension.** Say simulated override ended, never official timetable change. Select an actual validated BIT3.2 row at execution; no fabricated record or permanent base edit.

## Chatbot-only notification presentation
Current js/ticket-notifications.js prepends details to portal main. Reuse owner-aware client/poll lifecycle, replace presentation. Add one bell between #map-btn and #settings-btn; unread badge and inbox/detail views via widget.js init/goToView. Widget mount markup/styles, portal.html and current script must change together to remove duplicate portal UI/poller.

Preserve chat DOM/history/draft/scroll; Back restores prior conversation. Preserve avatar/typing/map/settings/maximize/close. Keep singleton mount, visibility pause, auth-bound30sec polling, safe textContent, owned read/detail APIs. Abort stale requests/reset private state on logout/account/profile switch;401 stops polling. Accessible focus/ARIA and mobile/dark styles. No separate page, push prompt, second notification ownership/session store or internal staff-note previews.

## Fifteen-item implementation contract
| Item | Plan |
|---|---|
|1 Reuse|authService/sessionOwnershipService; demoAcademicService/policy4; timetableService/Presentation/Change/NotificationService; ticketNotificationService/notificationService|
|2 Modify|demoAcademicService; chatRoutes context; notificationRoutes; timetableUpdater/publication coordinator; widget.js/markup/styles; portal.html/ticket-notifications presentation|
|3 New modules|Versioned curriculum/fixed fictional fixture; academicContextService; authoritative import coordinator; effective override resolver; shared widget inbox client/view only where needed|
|4 Existing tables|chat_sessions, ticket_events, ticket_notification_reads; local003 head/snapshot/change/read structures|
|5 Additive migration|Review unpublished003 for automatic targeting; override/idempotency/recipient relations as needed; immutable001/002|
|6 Frontend|One widget bell/goToView/back flow; one auth-bound poll; remove portal duplicate|
|7 Backend|Validated import→snapshot/diff→server eligible profiles→combined inbox; one effective timetable resolver|
|8 External dependencies|Extractor/completeness manifest; account mapping; group confidence; approved fictional-history strategy|
|9 Security|Signed owner, demo override gate, restricted role/RLS, no private notes/credentials, no arbitrary target|
|10 Acceptance|Fixed Luka stable, flexible renewal intact,35 split22/5/8; automatic relevant-only alerts;120sec base-restoring expiry; one accessible bell|
|11 Existing tests|timetableNotifications, ticketNotifications, unifiedNotificationIntegration, timetableNotificationMigration; widget unified-notifications/demo-academic-presentation|
|12 New tests|Fixed/flexible account switch/version; all35; partial/reordered imports; group/shared-course filtering; overlap/crash/restart/multi-instance expiry; one poll/theme/mobile/focus|
|13 Risks|Incomplete source, unknown group, curriculum versions/BCS identity, backup scope, process-local profile lock|
|14 Order|Identifiers/account→catalogue/context/fixed history→automatic source targeting→overlay→widget inbox→full local regression→separately reviewed cloud release|
|15 Complexity|High combined; split into local reviewable checkpoints without replacing ticket system|

## Reconciliation cautions and confirmed conflicts

The table counts exact course_code field matches. Compound course-code fields are separate evidence, not missing-course proof: BIT102 (3 compound rows), BIT110 (7 compound rows), BIT107 (7 compound rows), BIT121 (3 compound rows), BIT213 (6 compound rows), BIT222 (2 compound rows), BIT241 (3 compound rows), BIT214 (3 compound rows), BIT254 (6 compound rows), BIT256 (4 compound rows), BIT315 (3 compound rows). Review these through timetablePresentationService before assigning aliases or registrations. BIT301 includes both E-Business and Decision Support Systems titles in the raw data: this is a material conflict, not merely spelling. BIT214 includes JAVA specificity; BIT346 includes Visual Studio/C# specificity; retain source/curriculum version until reviewed. Missing exact rows must not be reported as programmes/courses absent from the entire knowledge corpus. This audit reconciles timetable and simulator availability, not official enrolment verification.
