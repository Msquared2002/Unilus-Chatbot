# Phase 3 — digital front desk

Audit: **2026-11-10, Africa/Lusaka**. Local HEAD `9cbdeb0517da8820b94a623d9b8facbef50ae1ee`, branch `codex/production-integration`, **with pre-existing uncommitted unified-notification work**. Source findings describe that working tree unless explicitly marked production. Documentation only; no implementation/release authorized. [Master](00_MASTER_AUDIT.md) · [Evidence freshness](14_DECISIONS_AND_ASSUMPTIONS.md)

**PARTIALLY IMPLEMENTED.** Consent draft, ticket events/assignment, role/department staff access, approved answers and private reply notifications exist. Draft createTicket omits contact, causing Registry fallback; optional contact and private attachments are missing. Knowledge uploads are a separate administrative workflow.

## Implementation contract

| Required item | Proposed work, not implemented in audit |
|---|---|
| 1 Reuse | supportConversationService/supportService.createTicket/contactService/ticketWorkflowService.assign/list; supportRoutes/admin adapter; ticket notifications |
| 2 Modify | Draft→canonical department handoff, direct-create consent policy/validation, staff ticket details; document lifecycle only when scoped |
| 3 New modules | Small explicit department resolver; optional contact validator and owned ticket attachment service |
| 4 Existing tables | tickets, ticket_events, ticket_assignments, chat_sessions, receipts; managed_documents remains institution knowledge |
| 5 Proposed migrations | Optional minimal contact/consent metadata; separate ticket_attachments(owner,ticket_ref,object_key,MIME,size,hash,visibility/state), FK/index/RLS/grants |
| 6 Frontend | Existing draft confirmation/staff queue; optional contact, owned upload/download; not KB upload UI |
| 7 Backend | Verified department→ticket/assignment transaction; authorized private downloads; generic receipt events; future notices require publication/eligibility |
| 8 External | Approved department IDs/contact directory, retention/allowed file policy and staff reassignment rules |
| 9 Security | Purpose/consent/minimal PII; MIME+extension+magic+size, safe names/quarantine/scan where feasible; private server-mediated bytes; no private indexing |
| 10 Acceptance | Correct queues/department access, optional contact, private attachment isolation, student-visible events only |
| 11 Existing tests | Support consent/workflow/ownership, ticketNotifications, integrationSecurity and managed knowledge tests |
| 12 New tests | Actual assignment/fallback; direct API consent; cross-department download; spoof/oversize/traversal; DB failure after upload, retention/delete |
| 13 Risks | Direct POST tickets bypasses conversational pending consent; object upload precedes DB commit, remove deactivates but retains bytes; no malware workflow observed |
| 14 Order | Routing/consent→minimal contact→attachment security/lifecycle→owned UI→notifications |
| 15 Complexity | Medium routing/contact; high attachments |

## Acceptance scenarios
- Finance label actually creates verified Finance assignment; unknown case transparently falls back to Registry.
- Other department/student cannot access private contact/files/events.
- Ticket attachment never enters public RAG or lock-screen detail.
- Current upload end-to-end operation remains unverified in this audit because writes are prohibited.

Cloud migrations/releases need separate concrete authorization. [Release gates](12_TESTING_AND_RELEASE_STRATEGY.md).


## Phase 3 implementation update — 2026-11-11

Implementation replaces the proposed work status for local code. Core ticket contact-column assumptions were incorrect: additive004 extension tables preserve the existing core schema. See [Phase3 implementation and evidence](18_PHASE_3_IMPLEMENTATION.md) for authoritative current details. Earlier audit findings remain historical.
