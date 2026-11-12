# Stage A consolidated defect remediation

Date:2026-11-12, Africa/Lusaka. All work is local. This supplements, rather than replaces, reports23–25 and the owner's subsequent Firefox findings. Earlier automated acceptance did not cover all the defects later observed manually. **Implemented and locally verified; not fully accepted for release.** Live Groq quality, Firefox/physical-device confirmation and hosted integration remain pending.

## Baseline and preservation

HEAD remains9cbdeb0517da8820b94a623d9b8facbef50ae1ee on codex/production-integration. No commit/push/merge/deployment/production write/migration/credential change occurred. Previous uncommitted phases and StageA bell/map fixes remain. No backups or university source documents were changed. Phase4 remains deferred.

`remediation-baseline.json` captures pre-change hashes. `remediation-change-manifest.json` identifies this task's delta and unchanged hosting configuration. `remediation-since-phase7.json` reconciles accumulated changes against the Phase7 input baseline; that comparison includes Phase7 itself and earlier StageA work, not just this task. The current entry state lacked explicit profile recognition in personalAcademicService and still allowed generic academic tokens to select a campus place; F01 was not assumed already fixed. Existing academic/ownership/context tests were preserved.

All001–007 migrations remain byte-for-byte unchanged. Dockerfile,render.yaml,netlify.toml and source/GIS/academic-model data remain unchanged. No competing authentication/session/notification application was introduced.

## Defect disposition and exact retests

Each corrected item is exercised by `stageARemediation.test.js`, existing regression suites and/or the real-browser scripts named below. Browser validation uses installed Playwright plus installed Edge with isolated synthetic storage; it is not a claim of fresh manual Firefox acceptance.

|ID|Classification / original reproduction|Established cause, implementation and final local status|Firefox retest|
|---|---|---|---|
|F01|Confirmed: academic profile mapped to Knowledge Field1|CORRECTED. Added profile intent before navigation; generic academic/student aliases are excluded, and a primary-index bonus cannot create a match without an alias. Named campus requests retained. Academic BuildingA is not a verified catalogue name: ask for clarification rather than inventing a mapping. Files:personalAcademicService,locationSearchService,navigationService,navigationIntentDetector. New API/pure regressions pass.|Ask all5 profile paraphrases, then library/academic facilities. Verify own profile, and no arbitrary map for generic academic information.|
|F02|Confirmed: Semester2 component-course request became all-history average|CORRECTED. Semester-only reference resolves the unique year in prior owned period keys. Explicit individual-course output takes precedence over the word average. Subsequent ranking retains the selected period. New exact comparison/detail/rank sequence passes for both stored synthetic accounts. File:personalAcademicService.|Compare Year2 Semester1/2; ask individual courses/marks for Semester2; ask best among those. Repeat under A, verify its own stored marks.|
|F03|Confirmed: brief for today missed handler|CORRECTED. Natural briefing variants map to deterministic compose; no Groq needed. Existing distinction from reminder/timetable requests retained. File:morningBriefService. Six variants pass; real browser for-today passes.|Ask the6 supplied variants; verify brief cards and uncertainty qualification.|
|F04|Confirmed: natural unreflected payment problem fell through|CORRECTED. Payment-assistance intent precedes fee/tutor interception, offers Finance preparation, and accepts Yes,please into quoted review only. Separate submission confirmation is still required. Frustration alone does not enter the workflow. Files:chatService,supportConversationService. Offer→review→cancel/no-write and existing submission/ownership tests pass.|Describe missing payment; answer Yes,please; inspect exact quote; cancel. Repeat and explicitly confirm; only then expect a ticket.|
|F05|Confirmed: combined hospital services/hours omitted services|CORRECTED. Observation selection no longer treats visiting-hours and services as mutually exclusive in a multipart request. Both existing files/provenance are returned, with one shared freshness qualification. No dataset edits. File:facilityInfoService. API regression passes.|Ask combined hospital services/visiting hours; verify both source observations and dates.|
|U01|Confirmed: stacked headers/tall academic rows|CORRECTED. A fixed-layout rule gave first2 columns67%/33% of every academic table. Replaced with auto layout, readable column minimums, normal word wrapping and contained horizontal scrolling. No font shrinking/body clipping. File:widget.css; existing semantic wrapper retained. Five real viewport geometry checks pass, including expanded desktop; screenshots reviewed.|320×568,390×844,768×1024,1366×768,1920×1080: inspect period/code/title/mark/grade, horizontal scroll inside wrapper, compact/fullscreen.|
|U02|Confirmed usability: repeated nested borders|IMPROVED. Nested support-form sections use spacing rather than repeated frames; tutor articles retain their own hierarchy. Existing actions/data unchanged. Files:widget.css,front-desk,peer-tutors,morning-brief. Widget regressions and real workflows pass.|Open tutor/request/accepted detail, reminder edit and notice detail; inspect nesting and spacing.|
|U03|Confirmed usability: confirmation wording beside transitioned reminder|CORRECTED CURRENT CARD. Interactive states explicitly display Reminder saved/completed/cancelled. Historical chat text is retained rather than rewritten. File:morning-brief.js. Real save→complete UI passes; existing edit/cancel tests pass.|Save,complete,cancel a reminder; distinguish historical request from current status card.|
|U04|Confirmed usability: long content near composer|CORRECTED LOCALLY. Scroll area has min-height0,contained scrolling,clearance/focus margins; mobile panel uses visualViewport height with dynamic-viewport fallback/safe-area padding. Tablet host-table overflow also contained. Files:widget.css,app.js,portal.css. Geometry checks pass.|Scroll to last control; Tab into edit inputs; test actual phone soft keyboard. Physical keyboard behavior remains pending.|
|U05|Confirmed usability: inconsistent controls|IMPROVED. Widget-scoped shared button tokens, explicit primary/danger/secondary attributes, loading and visible focus styles. Host-page buttons unaffected. Files:widget.css,front-desk,peer-tutors,morning-brief.183 widget tests and browser workflows pass.|Compare confirm/save/upload,secondary and cancel/remove controls in both themes.|
|U06|Confirmed usability: sparse fullscreen inbox|IMPROVED. Inbox stays in widget, bounded1040px content, adaptive card grid and consistent detail spacing. Same bell/poller/receipts/authorization. File:widget.css. Actual bell/notice/workflow regressions pass.|Expand inbox with several synthetic events; open/close details, mark read and verify counts.|
|U07|Confirmed: crest/navigation overlap|CORRECTED. Accounted for the actual injected global-brand wrapper, moved desktop crest into flex flow and wrapped navigation. Files:website.css; portal.css also contains host tables. Real1366px geometry passes.|Check public header at desktop/tablet/mobile, dropdowns and keyboard focus.|
|S01|High-priority investigation confirmed as display default, not server escalation|CORRECTED UI. Initial identity-verification placeholder replaces SuperAdmin default; /auth/me supplies actual signed role/department. Staff selector is locked to its own queue; admin filters remain presentation only. Unknown departments fail closed. Files:admin.js,admin-ticket-service.js. Finance browser identity check passes; staff global-publication/knowledge attempts return403 in isolated API tests.|Use /stage-a/staff; inspect Finance label/locked selector. Manipulating browser controls must not alter signed API authority.|
|S02|Confirmed: list said Guest; details had student owner|CORRECTED. Authorized list projection now joins existing ticket_support_details as details already did. Department filtering remains server-side before projection. File:supportService. API regression verifies stable StudentB username in Finance queue.|Create as B,open Finance queue and detail; compare owner label, then verify unrelated department denial.|
|S03|Investigation: Open/New and Medium/Normal|LEGITIMATE OLD DISPLAY MAPPING, now aligned. Frontend displays Open/Medium consistently with persisted API values; persistence/state transitions unchanged. Files:admin-ticket-service,admin.js.|Compare student ticket status/priority with staff list/detail/filter.|
|S04|Investigation: Finance department but no named assignee|EXPECTED. Department queue routing and individual assignment are separate. No employee is silently assigned; no functional change made.|Verify Finance department with unassigned individual; only an authorized deliberate assignment should change it.|
|S05|Confirmed risk: default matching-ticket resolution|CORRECTED. Knowledge forms default unchecked. resolveTicket must be literal true and affects only ticketRef; no automatic search/bulk resolution. Signed Finance staff cannot publish global answers. Files:staffAnswerRoutes,admin.js. New test leaves another student's matching ticket Open.|As synthetic admin,save answer unchecked,then opt in for one ticket; confirm another matching ticket remains Open.|
|Q01|Source/display inconsistency: BIT346 C vs C#|CORRECTED PRESENTATION. Existing source-aware harmonizer now also runs for personalized timetable listings before day selection; prefer existing agreeing punctuation-bearing evidence. Raw variants and catalogue remain intact. File:personalAcademicService; prior C# regressions preserved.|Compare BIT346 lecture/tutorial listings; verify source-backed C# consistently, not a fabricated source rewrite.|
|Q02|Usability: comparison lacked difference|IMPROVED. Two semester means now state absolute difference and direction, using existing unweighted rounded means, not GPA. File:personalAcademicService. Screenshot reproduces71.5 versus69 and2.5 lower.|Run exact Year2 comparison; inspect numeric explanation and arithmetic-mean qualification.|
|Q03|Usability: YYYY-sem2 jargon|IMPROVED. Guidance asks for published calendar year/semester; accepts semester2 of2026 and2026 semester2, retaining internal period keys. No term inferred from student level. File:academicPublicationService.|Ask exams,then explicitly state a published year/semester. Empty record state must remain honest.|
|Q04|Usability: unlinked general e-learning reference|IMPROVED. Resource-only study replies include accessible Markdown links from the existing approved registry, labelled general resources. File:studySupportService. No fabricated course notes.|Ask Find study resources for BIT222; when notes absent, inspect approved general links.|
|Q05|Usability: repeated facility qualifications|CONSOLIDATED. Combined records share one answer-level operational/freshness qualification; per-source dates/provenance remain. No evidence removed. File:facilityInfoService.|Inspect combined hospital reply for both sources and one shared current-operations caveat.|
|Q06|Investigation: Google labels library coordinates as nearby church|EXTERNAL LIMITATION. Existing URL uses canonical destination coordinates; no verified Google place ID exists to substitute. Added destination-specific accessible label and explanation that Google may show a nearby label. No coordinate/GIS/URL routing rewrite. File:app.js. Live Google labeling remains unverified here.|Use external directions only when desired; confirm coordinate destination visually. Do not treat provider label as a verified renamed UNILUS building.|

## Conversational architecture and privacy

The regression had two linked causes: conversationService only recognized a narrow social phrase set, while the downstream generation prompt required supplied university evidence for every answer. New companionConversationService is an orchestration helper inside the same POST/api/chat and aiService chain, not a separate chatbot/provider/session manager.

Explicit safety/wellbeing/social intent is handled before institutional keyword-based retrieval. Mixed messages requesting actual courses/results/timetables/study/tutors keep those structured operations. Deterministic reminder/brief/support/tuition/peer/publication/facility/academic handlers remain ahead of ordinary general-question fallback. Existing greeting/help/thanks shortcuts remain for efficiency and regression compatibility; adding more canned greetings is not the main repair.

General conversation uses a separate system prompt allowing ordinary knowledge/humor/empathy without UNILUS documents. It explicitly disallows invented institutional facts, lived human experiences, clinician claims, promises of secrecy or actions/contact on the user's behalf. Institutional factual requests retain evidence-only grounding/numeric/link controls. Study uses the existing labelled educational mode, distinct from either institutional facts or ordinary conversation. Unsupported structured facts still clarify or report absence. No model output executes a ticket/reminder/tutor action.

Conversation references reuse createStore, keyed by signed owner/profile/session, max500,15-minute expiry and at most4 short ordinary turns. Raw wellbeing text is not retained; only a generic supportive-conversation marker may remain. Safety text is not retained in that buffer. Persistent history receives placeholders for the conversational channel; private marks/reminders/tutor contacts/support data do not enter unrestricted context. Topic changes cancel pending support consent and clear academic references; explicit academic queries establish fresh owned scope. Existing profile/session/identity guards and widget abort handling remain.

Serious self-harm wording follows a deterministic supportive response, asking about immediate danger and encouraging a trusted nearby person/local emergency help. No invented telephone number/university counseling service, automatic ticket/contact or confidentiality promise is given. Mocked safety tests verify no inference/RAG/record exposure or persistence of the test's sensitive text. This is not clinical certification or live wellbeing-quality acceptance.

Natural Finance assistance has an owner-scoped offered state. Accepting the offer shows the exact redacted issue; submission still requires a separate explicit confirmation. A generic request for help is never a provider-controlled write. Contacts and attachment bytes remain outside chat prompts.

## Actual model orchestration

|Path|Actual inspected configuration and behavior|
|---|---|
|Retrieval interpretation|queryUnderstandingService: QUERY_PLANNER_MODEL override or default openai/gpt-oss-20b; enabled unless QUERY_PLANNER_ENABLED=false and only with a key.10s timeout,0 SDK retries,450 output tokens. It returns bounded normalized queries/entities, not an answer or action. Failure/malformed output falls back to the original retrieval query.|
|Answer generation|aiService primary qwen/qwen3.8-27b → openai/gpt-oss-20b → openai/gpt-oss-120b.15s timeout per attempt,0 SDK retries. Success stops the chain; ordinary429/transient errors,timeout or malformed output permit bounded fallback. No reason to reorder a working grounding chain without live comparative evidence.|
|Budget|Existing7000-byte conservative input-cost budget,800 output-token reserve,question/history clipping. A size/oversized-token error stops unchanged fallback requests. Grounded numeric correction is at most one same-model retry when it fits; conversation/educational examples do not use institution-only numeric validation.|
|Tone rewriting|toneService contains20B→120B configuration, but enabled() returns false. Approved factual/policy answers remain verbatim. This guard was preserved, not enabled globally to disguise the conversation defect.|
|Diagnostics|Safe JSON event,model,route,input cost,latency and failure category; no raw transcripts/marks/contacts/numeric tokens/provider error body. Planner failures now log a category rather than err.message.|
|Active isolated StageA|No Groq credential loaded; outbound server access blocked. Tests inject completions or exercise safe unavailability. No claim that the live configured account/model quota or provider fallback succeeded.|

All three generation IDs are listed in [Groq's official supported-model documentation](https://console.groq.com/docs/models), checked2026-11-12. Documentation availability is not a live API/account entitlement test. No new provider or paid dependency was installed.

## Fresh verification

- Full backend:547 tests,547 passed,0 failed/skipped/cancelled/todo (`remediation-backend-full.txt`). Includes all existing security/ownership,planner/budget,timetable,tuition,Advisor,front-desk,tutor,brief/reminder,publication and isolated migration/recovery tests. New file contributes14 cases with multiple prompts/assertions each.
- Full widget:183/183,0 failed/skipped (`remediation-widget-full.txt`). Existing assertions were retained.
- Focused final routing/support subset:70/70 at its recorded checkpoint (`remediation-final-focused.txt`); additional generic-token and two-account tests are in the final full suite. Focused campus/navigation/remediation57/57 at its recorded checkpoint (`remediation-focused.txt`). Counts overlap, not additive.
- Syntax:306/306 (`remediation-syntax.json`); source/migration/secret-pattern scan in `remediation-change-verification.json`. Zero unresolved credential findings; the existing VM-only synthetic localhost URL is explicitly classified.
- Production widget build passed:21 modules,164.63kB / gzip51.61kB (`remediation-build.txt`). Existing Vite native-loader warning is nonfatal.
- Real Edge:10/10 remediation checkpoints (`remediation-browser.json`) and27/27 existing workflow checkpoints (`remediation-workflows.json`). These are local actual-browser checks; not Firefox, physical-phone or live Groq acceptance. No uncaught page errors in the final runs.
- Isolated29-table migration/recovery tests are included and pass in the full backend suite; no persistence schema/role change was needed. All001–007 hashes and hosting config match baseline. No remote database or Storage test/write was performed.

Initial regressions from an overly broad conversational catch-all were fixed rather than changing old assertions. The final route preserves deterministic operations,owned follow-ups,legacy social shortcuts and named navigation. A pre-existing test fixture hit Node fetch's forbidden ephemeral port: frontDeskKnowledge now chooses a bounded high local port, retrying address collisions only, without disabling bad-port security or changing assertions. One new test initially assumed period key2.2 instead of the existing2-2; the fixture expectation was corrected. No tests were disabled.

## Visual evidence and limitations

`remediation-synthetic-table-{320,390,768,1366,1920}.png` shows actual fictional results. Expanded light/dark captures exist for768/1366/1920. The306-source gate does not imply306 visual checks. Automated geometry checks assert readable header heights/minimum widths, no document overflow and an unclipped first column. Expanded screenshots were visually inspected; headers/marks remain conventional, course titles wrap normally, and compact/mobile use labelled keyboard-scrollable horizontal tables. No essential columns are truncated from the underlying table. Dark-theme captures apply the existing theme class in a real browser; the separate workflow runner exercises the actual theme switch.

The tablet's19px page overflow came from a host portal table, not the corrected chatbot table. Its section now contains horizontal scrolling. Crest overlap involved the runtime global-brand wrapper, not only the original anchor. Both final geometry checks pass. Composer clearance and visualViewport handling are implemented, but physical soft-keyboard behavior, full touch gestures and complete assistive-tech/focus-order certification still require owner checks.

## Exact files

Changed:

```text
backend/routes/staffAnswerRoutes.js
backend/services/academicPublicationService.js
backend/services/aiService.js
backend/services/chatService.js
backend/services/conversationService.js
backend/services/facilityInfoService.js
backend/services/locationSearchService.js
backend/services/morningBriefService.js
backend/services/navigationIntentDetector.js
backend/services/navigationService.js
backend/services/personalAcademicService.js
backend/services/queryUnderstandingService.js
backend/services/studySupportService.js
backend/services/supportConversationService.js
backend/services/supportService.js
backend/tests/frontDeskKnowledge.test.js
dummy-environment/chatbot-widget/app.js
dummy-environment/chatbot-widget/front-desk.js
dummy-environment/chatbot-widget/morning-brief.js
dummy-environment/chatbot-widget/peer-tutors.js
dummy-environment/chatbot-widget/widget.css
dummy-environment/chatbot-widget/dist/chatbot-widget.js
dummy-environment/css/portal.css
dummy-environment/css/website.css
dummy-environment/js/admin-ticket-service.js
dummy-environment/js/admin.js
```

Added:backend/services/companionConversationService.js,backend/tests/stageARemediation.test.js,deployment/remediation-browser.cjs,deployment/remediation-gates.cjs,deployment/remediation-workflows.cjs. Documentation adds this26 report/evidence and appends a dated update to24. Existing reports/backups are preserved.

## Reproduction and pending acceptance

From the existing integration root, with Node24 and installed dependencies:

```powershell
$env:STAGE_A_PORT='0'
node deployment/stage-a-local.cjs
# Open the printed loopback origin in Firefox.
# /website.html guest; /stage-a/b Luka; /stage-a/a flexible; /stage-a/staff Finance.
# Ctrl+C stops the interactive local helper.
```

1. Follow each defect table retest. Verify the exact comparison sequence, five sizes, compact/fullscreen/light/dark, tab/scroll to final controls and actual soft keyboard. Use only synthetic contacts/files.
2. Finance: create as B,review/confirm,open staff queue,reply; return to B and read notification. Switch to A during outstanding requests/forms; verify no B marks,contacts,tickets or reminders appear. Direct cross-owner API tests remain the authority for access denial, not an empty list alone.
3. Tutors: opt in with actual completed synthetic course history,discover/select exactly one,accept only after selected contact consent,decline/reselect/revoke; no eligibility grades disclosed. Test reminder edit/complete/cancel and bell read state,brief opt-in/out and idle behavior.
4. Source publication empty states must stay honest. No current authoritative calendar/exam/consultation feed or approved course notes was added. University-source publication remains a separately validated operational dependency, not a fake demonstration seed.
5. Separate authorization is needed before loading real Groq credentials into an isolated test that permits only provider inference. Keep SQLite/local objects and synthetic students; run supplied conversational/mixed sequences,inspect natural quality,compare factual grounding and failure behavior,record only model/route/latency/failure metadata. Use mocked429/timeout/size failures rather than deliberately exhausting a free account. No hosted actions/records are needed for that test.
6. Hosted behavior,migrations,Storage MIME compatibility/scanning and recovery gates from25 remain unchanged and require StageB approval. No off-machine recovery claim,source bootstrap or production action follows from these local passes.

**Stop after local remediation. No commit,push,deployment,production write or Phase4 routing was performed.**
