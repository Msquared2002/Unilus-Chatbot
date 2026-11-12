# Phase 5 — verified peer tutors

Audit: **2026-11-10, Africa/Lusaka**. Local HEAD `9cbdeb0517da8820b94a623d9b8facbef50ae1ee`, branch `codex/production-integration`, **with pre-existing uncommitted unified-notification work**. Source findings describe that working tree unless explicitly marked production. Documentation only; no implementation/release authorized. [Master](00_MASTER_AUDIT.md) · [Evidence freshness](14_DECISIONS_AND_ASSUMPTIONS.md)

**MISSING.** No tutor service/table/opt-in UI was found. Reuse authenticated identity and canonical courses. Demonstration authentication is not proof of real university enrolment or tutoring competence; define verification honestly.

## Implementation contract

| Required item | Proposed work, not implemented in audit |
|---|---|
| 1 Reuse | authService/attachUser, phase1 academicContextService/curriculum, widget view/profile patterns |
| 2 Modify | Small authenticated API mount and deterministic course lookup in chat/UI |
| 3 New modules | peerTutorService/routes and opt-in/search view; course validator |
| 4 Existing tables | No suitable existing directory; do not misuse tickets/staff_answers |
| 5 Proposed migrations | peer_tutor_profiles keyed stable owner, visible/consented_at/minimal fields; peer_tutor_courses unique(owner,course), FK/index/scoped RLS/grants |
| 6 Frontend | Explicit visibility toggle, canonical course choices, contact preference and honest demo verification label |
| 7 Backend | Every discovery/recommendation rechecks visible=true and current consent; no stale public cache |
| 8 External | Definition/provider for real identity/course competence verification; currently absent |
| 9 Security | Default hidden, owner edits only; no public phone/email, consent-based contact/relay, rate limits; no ratings |
| 10 Acceptance | Opt-out immediately disappears from search/chat; correct course identity and no cross-owner edits |
| 11 Existing tests | Auth/session isolation and widget navigation patterns; no tutor tests exist |
| 12 New tests | Toggle/search races, cache visibility, duplicate course/forged owner IDs, hidden direct lookup, contact privacy |
| 13 Risks | Shared fictional account must not be marketed as verified actual student |
| 14 Order | Verification/privacy definition→reviewed schema→owned opt-in→deterministic discovery→UI/chat |
| 15 Complexity | Medium after catalogue/context; institution verification external |

## Acceptance scenarios
- Explicit opt-in required; hidden is default.
- Opt-out immediately removes discovery without deleting other account data.
- No unnecessary public contacts or unsupported competence claims.

Cloud migrations/releases need separate concrete authorization. [Release gates](12_TESTING_AND_RELEASE_STRATEGY.md).


## Phase 5 local implementation — 2026-11-11

This implementation supersedes historical proposed verification badges: no eligibility indicators, marks, grades or student numbers are displayed. Discovery is chatbot-led and requests target exactly one selected tutor. See [Phase5 implementation and fresh evidence](20_PHASE_5_IMPLEMENTATION.md). Older audit statements remain historical.
