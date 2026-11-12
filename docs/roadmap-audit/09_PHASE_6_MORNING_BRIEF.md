# Phase 6 — personalized Morning Brief

Audit: **2026-11-10, Africa/Lusaka**. Local HEAD `9cbdeb0517da8820b94a623d9b8facbef50ae1ee`, branch `codex/production-integration`, **with pre-existing uncommitted unified-notification work**. Source findings describe that working tree unless explicitly marked production. Documentation only; no implementation/release authorized. [Master](00_MASTER_AUDIT.md) · [Evidence freshness](14_DECISIONS_AND_ASSUMPTIONS.md)

**PLANNED ONLY.** Weekly timetable and owned ticket/change inbox can support request-driven composition after phases1/2. No trustworthy structured assignments/deadlines/calendar/announcement feed was found. A PDF mentioning a deadline is not a current personal obligation.

## Implementation contract

| Required item | Proposed work, not implemented in audit |
|---|---|
| 1 Reuse | academicContextService, effective timetable resolver, owned unified inbox and normal chat/actions |
| 2 Modify | Explicit brief intent/response metadata; optional entry action only when requested |
| 3 New modules | morningBriefService source-labelled deterministic composer; official calendar adapter when available |
| 4 Existing tables | Read snapshots/overrides/owned receipts/events/profile registration; no new table for requested brief |
| 5 Proposed migrations | Only separately approved dated announcement/deadline feeds if needed; explicit publication/eligibility |
| 6 Frontend | User-requested chat first; automatic display separate decision; no push/email/scheduler now |
| 7 Backend | Compose classes/change/unread sections with provenance; no repeated RAG or invented reminder; optional bounded wording |
| 8 External | Lusaka term/holiday calendar and publisher-owned dated assignments/announcements |
| 9 Security | Signed owner, minimal private snippets, no shared private-answer cache |
| 10 Acceptance | Each item traceable/source/freshness; missing feeds omitted/explained; no invented obligations |
| 11 Existing tests | Timetable/notification ownership and phase2 personalized tests |
| 12 New tests | Midnight/weekend/term, missing feed, expired override, account change, Render sleep, bounded calls/duplicate display |
| 13 Risks | Weekly recurrence not proof of dated class; Free suspension makes scheduled guarantees unreliable |
| 14 Order | Requested classes/unread brief→calendar qualification→trusted feeds→consider optional display later |
| 15 Complexity | Medium basic composition; high new feeds/scheduled guarantees |

## Acceptance scenarios
- Today means Africa/Lusaka and relevant registration, with missing term truth disclosed.
- No assignment/deadline section fabricates work when no feed exists.
- One compose request reuses context/head/inbox; no email, push or scheduled messages.

Cloud migrations/releases need separate concrete authorization. [Release gates](12_TESTING_AND_RELEASE_STRATEGY.md).


## Phase 6 local implementation — 2026-11-11

The historical proposal is superseded by the approved local implementation: optional automatic opening briefs default OFF; weekly/date uncertainty is explicit; no authoritative announcements are invented. See [Phase6 implementation and verification](21_PHASE_6_IMPLEMENTATION.md). Prior audit/proposal findings remain historical.
