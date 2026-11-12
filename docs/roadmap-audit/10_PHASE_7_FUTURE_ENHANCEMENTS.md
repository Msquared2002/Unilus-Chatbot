# Phase 7 — focused feasibility

Audit: **2026-11-10, Africa/Lusaka**. Local HEAD `9cbdeb0517da8820b94a623d9b8facbef50ae1ee`, branch `codex/production-integration`, **with pre-existing uncommitted unified-notification work**. Source findings describe that working tree unless explicitly marked production. Documentation only; no implementation/release authorized. [Master](00_MASTER_AUDIT.md) · [Evidence freshness](14_DECISIONS_AND_ASSUMPTIONS.md)

## Remaining original-vision features
These are proposals, not implemented by the audit. Knowledge text is not a live structured operational feed.

| Feature/evidence | Missing source | Minimal service/table/UI | Security/dependencies | Complexity/value |
|---|---|---|---|---|
|Office hours: lecturer search exists, availability missing|Lecturer-approved hours/exceptions/office|Source adapter + dated office_hours, deterministic lookup|Never infer free availability from timetable; authorized publisher/lecturer IDs|Medium, useful with data|
|Exams: restricted PDF retrieval possible, dedicated dated engine absent|Approved current exam dates/cohort/venue/revisions|Exam importer/validator + exam_sessions, timetable-style view|Source audience restrictions; phase2 context; no lecture→exam inference|Medium/high, worthwhile|
|Announcements: static KB notices, no active feed|Publisher/audience/validity|Explicit announcement publication table/events, existing inbox|Phase1/3 eligibility; not every KB update|Medium|
|Course study support: RAG/Groq exists, course mode missing|Licensed current material/objectives|Course-scoped retrieval and existing chat|Private exam/material permissions; generated practice label; phase2|Medium pilot|
|Installable PWA: no active SW|Scope/manifest/icons/cache policy|Manifest + small service worker|HTTPS/update invalidation; never cache private API/token/profile/inbox; no implicit push|Medium after UI stable|
|Offline public info: no offline cache|Allowlist/version/expiry|Public-only cache/offline banner|PWA dependency; no authenticated data caching|Medium limited scope|
|Facilities: map/facility metadata exists|Current approved hours/access/prices|Versioned facility metadata with source/date|No stale guarantee; existing map reuse|Low/medium useful|
|Cafeteria: named places exist, menu feed absent|Verified menu/hours/prices|Same facility/public adapter|No invented current meals/prices|Low with data|
|Hospital: named place, services feed absent|Verified services/contact/hours|Source-backed public records|No diagnosis or invented availability|Low/medium with data|
|Feedback/analytics: feedback/support reports exist|Retention/evaluation definitions|Reuse aggregate reports, no new platform|Staff/admin only, redaction; no public conversation export|Low incremental, retain|
|Collaboration: no implemented directory|Purpose/moderation/consent|Small opt-in membership if approved|Reuse tutor privacy, no public contacts/unbounded chat|Medium, defer|
|Multilingual: no verified language workflow|Supported languages/glossary/evals|Existing Groq bounded instructions|Preserve official names/fees/identifiers; no new provider|Medium opt-in pilot|
|Voice: no integrated speech pipeline|Browser/accessibility/consent policy|Optional browser speech with text fallback|Explicit mic, no always-listening/retention/paid vendor|Medium lower priority|

## Common implementation contract (15 items)
1. Reuse chat/RAG, structured services, widget goToView, unified events/context.
2. Modify only selected feature adapter/route/view, no broad rewrite.
3. New modules: minimal source adapter/service; manifest/SW only for PWA.
4. Existing tables: appropriate knowledge/managed documents, feedback/events for current purposes.
5. Proposed migrations: source-specific dated publications only when needed, scoped ownership/RLS/grants/indexes.
6. Frontend: one existing widget/portal, accessible text fallback.
7. Backend: authoritative structured intent before general RAG when appropriate.
8. External dependencies: row-specific source; absent source means unavailable capability.
9. Security: access/consent/private-cache isolation; no arbitrary URL/file execution.
10. Acceptance: source/date/audience correctness and graceful missing data.
11. Existing tests: source/retrieval/auth/action/widget; feedback regression.
12. Additional tests: source expiry/visibility, PWA private exclusion/update, multilingual numeric provenance, mic-denial fallback.
13. Risks: stale sources, overstated verification, browser dependencies and excessive scope.
14. Order: source-backed facilities/feedback; dated office/exams/notices when data exists; study pilot; PWA/offline; selective collaboration/language/voice.
15. Complexity: per row; select one authorized capability at a time.


## Phase 7 local implementation — 2026-11-11

The authorized Phase7 features are now implemented locally. Prior proposals remain historical; voice/translation and Phase4 routing remain deferred. See [implementation report](22_PHASE_7_IMPLEMENTATION.md) and [consolidated handoff](23_CONSOLIDATED_ACCEPTANCE_HANDOFF.md).
