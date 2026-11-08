# Conversational orchestration hotfix — local review

The public deployment remains at `745dd609028793b546c3213936710260ffc57cb9`. This repair is a local commit on `codex/production-integration`; push and public deployment require the owner's separate final authorization. No cloud API, migration, bootstrap, Storage provisioning or shared database write was performed. Incident ticket UNI-2026-0008 was not changed.

## Confirmed defects addressed

1. `chatService.buildFallback` no longer creates tickets for empty retrieval or generated no-answer text. It retains hash-only unanswered logging and can offer support. Registry contact advice is not reported as a verified handoff.
2. `conversationService.reply` handles social-only salutations, wellbeing, thanks, farewells and ambiguous help without retrieval/Groq. `stripGreeting` removes a salutation from a mixed message without discarding the substantive request. For example, “Hey love, what are the hostel fees?” still follows the existing retrieval/generation path.
3. `supportConversationService.tryHandle` recognizes explicit ticket requests. It shows the issue, discloses that only the quoted issue is saved and no chat history is attached, and requires “Yes, submit it” (or the supported equivalent explicit submission phrase). A bare “yes” is insufficient. No model output is used as write authorization.
4. The pending issue is bound to the existing session and verified owner. A changed topic cancels pending consent; cancellation, absent/expired consent, foreign sessions and unrelated confirmations cannot submit. Concurrent/repeated confirmation reuses a single in-flight submission/receipt. The existing transactional ticket service and duplicate prevention are unchanged. Save failure keeps the confirmed issue pending for an explicit retry.
5. `retrievalRouter.resolveTimetableFollowup` resolves short day follow-ups from bounded prior user context, preserving an explicitly selected period over account defaults. Other elliptical knowledge questions use the existing smaller Groq planner once with bounded history. A failed/unchanged contextual rewrite asks for clarification instead of doing an unscoped search or retrying the planner without history. Topic changes stop deterministic timetable carryover.
6. `isSpecialistRequest` prevents high-confidence course/venue/cohort/explicit-lecturer requests from being shadowed by fuzzy staff FAQ matches. Normal approved answers and visibility rules remain active. A lone incidental word matching a timetable lecturer token is not treated as a high-confidence specialist request.
7. Advisor programme references keep the active verified programme for entry-requirement follow-ups. A topic-active flag prevents unrelated topic changes from leaving a stale implicit programme reference, without discarding the temporary applicant profile. The existing BIT mapping is recognized for programme enquiries; ordinary lowercase “a bit” is not treated as a programme.
8. Personal CA/marks/results/performance queries state that real academic records are not connected and offer a separately confirmed support request. No simulator or fictional academic results were added. ECZ/applicant assessment remains separate.

## Before and after

| Interaction | Before | Hotfix |
|---|---|---|
| Hey love / thanks / goodbye with no evidence | Could enter RAG and automatically create a ticket | Friendly deterministic reply; zero tickets and provider calls |
| Mixed greeting and hostel-fee question | No guaranteed social boundary | Substantive fee question retained; existing planner, RAG and grounded generator |
| Unanswered university question / generated no-answer | Automatic support ticket and possible “passed it to Registry” claim | Honest fallback, hash logging, optional support offer; no ticket |
| “I cannot access my final results” → “Can you create a ticket for me?” | Inconsistent escalation based on retrieval rather than consent | Limitation/help → quoted issue and consent prompt → explicit submission |
| “Yes, submit it” without a pending proposal, after cancellation or from another session/account | No dedicated consent contract | No ticket write; foreign session access rejected by existing ownership checks |
| Repeated/concurrent valid confirmation | No conversational submission state | One ticket; same receipt, existing duplicate guard retained |
| BIT Year 3 Semester 1 → And Wednesday? | Could lose cohort/stage context | Preserves BIT/3/1 and day, independent of BIT/3/2 account defaults |
| Hostel fees → What about international students? | Fragile follow-up gate | One bounded history-aware retrieval plan, with unchanged ranking/grounding |
| BIT programme → What are its entry requirements? | Could lose named-programme context | Existing catalogue and Advisor retain that programme within the active topic |
| Public fuzzy FAQ colliding with a cohort timetable | Could bypass structured routing | Student structured lookup / guest sign-in restriction takes precedence |

## Scope and compatibility

The two-stage Groq design, model chain, MiniLM, semantic/lexical ranking, grounding, official sources, timetable data, campus navigation, authentication, staff workflows, private Storage and durable PostgreSQL adapter are preserved. No dependencies or database schemas changed.

Existing response fields remain. An additive `support.status` describes the consent response; the widget already renders the answer and ticket information as text. No support action ID was introduced, so the existing identical backend/browser action allowlists and handlers remain unchanged. No avatar/typing/slow-wake/retry implementation was removed. The production widget bundle rebuild has no source change.

## Files/functions changed

- backend/services/chatService.js: buildFallback, answerQuestionCore, answerQuestion, markAdvisorTopic.
- backend/services/conversationService.js: reply, stripGreeting, personalResults (new small pure helper).
- backend/services/supportConversationService.js: tryHandle and consent response/state helpers (new temporary consent helper, not a replacement session manager).
- backend/services/retrievalRouter.js: retrieveAnswer, isContextualFollowup, resolveTimetableFollowup, isSpecialistRequest.
- backend/services/programmeAdvisorService.js: tryAnswer's active-topic/reference resolution.
- backend/services/programmePreferenceService.js: existing resolve alias mapping.
- backend/routes/chatRoutes.js: verified-user context passed internally to chatService; additive support metadata forwarding.
- backend/tests/chatOrchestrationRepair.test.js: 30 isolated orchestration/security regressions.
- This review document.

## Verification

- Full backend: **305/305 passed**, zero failures/skips, including existing migration/security/integration suites.
- Production widget: **126/126 passed**, zero failures/skips.
- JavaScript syntax: **208/208 passed** across tracked and new source/test files.
- Production widget build: passed; 137.76 kB / gzip 42.98 kB. Existing non-fatal Vite config-loader deprecation warning remains.
- New tests use in-memory SQLite, fictional JWT identities, mocked Groq and evidence, and a loopback-only fetch guard. They never load private production credentials or create cloud tickets.
- Tests cover 10 social/help inputs, mixed greetings, no evidence, generated no-answer, confirmed student/guest submission, no history attachment, simultaneous and repeated confirmation, bare yes, cancellation, actual simulated consent expiry, failed-save retry, latest-issue binding, topic changes, foreign identities/sessions, forged action bodies, personal results, ECZ separation, timetable/knowledge/Advisor continuity, FAQ collision, provider failures and authorization under model rewrites.
- One initial focused test exposed an overly broad single-token lecturer signal (the fixture word “public”). Specialist precedence was refined rather than weakening approved-answer coverage; the final full suite passes.

## Remaining review/deployment considerations

Pending consent and recent submission receipts are bounded in process memory (10 minutes, at most 500 sessions), keyed by the existing owned session. Render restart/cold process replacement loses unsubmitted consent and fails closed; the user must review a new proposal. Submitted tickets remain in PostgreSQL, and the underlying active-ticket duplicate guard remains authoritative. No new durable consent schema was introduced.

Guest support retains the existing session-capability boundary; this repair does not introduce an authentication/session system. Only explicitly requested support enters the consent flow. The quoted issue may be taken from a bounded prior user turn in that same session, but is shown for review and is the only ticket description; history_json is empty.

Do not claim these repairs are live yet. After owner authorization, push normally to the integration branch, deploy the reviewed commit to the same Render Free service, then verify behavior in the actual widget with fictional accounts. Do not change main, migrate, recreate Storage, bootstrap knowledge or clean up historical tickets. Browser/mobile/visual avatar verification of the hotfix is not claimed by local API/unit tests. The separate pre-existing 3D prototype baseline-hash issue is outside the production widget suite and is unchanged.
