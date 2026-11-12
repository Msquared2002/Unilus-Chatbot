# Security, reliability, performance and risks

> **Phase2 local implementation — 2026-11-11:** [Implementation, exact source delta, fresh440/146 tests and limitations](17_PHASE_2_IMPLEMENTATION.md). Personalized StudentMode is implemented locally. Manual browser/visual acceptance is intentionally deferred until the consolidated seven-phase stage. Historical audit/Phase1 evidence below remains dated; no production release is implied.


> **Phase 1 implementation update (2026-11-10):** Read [the implementation delta, fresh tests and remaining acceptance gates](16_PHASE_1_IMPLEMENTATION.md) before using this historical audit snapshot. Fixed profile, automatic import adapter, persisted override and widget inbox are now implemented locally; no production release or browser acceptance is claimed.


Audit: **2026-11-10, Africa/Lusaka**. Local HEAD `9cbdeb0517da8820b94a623d9b8facbef50ae1ee`, branch `codex/production-integration`, **with pre-existing uncommitted unified-notification work**. Source findings describe that working tree unless explicitly marked production. Documentation only; no implementation/release authorized. [Master](00_MASTER_AUDIT.md) · [Evidence freshness](14_DECISIONS_AND_ASSUMPTIONS.md)

## Material findings
| Priority/confidence | Evidence | Scoped action |
|---|---|---|
|High/high|Timetable-derived curriculum/project exclusion; BCS mismatch in demoAcademicService and portal-login|Phase1 canonical catalogue/context; wrong identity can target wrong alerts|
|High/high|Unexpected public.notifications RLSfalse, no current source consumer|Clarify ownership/purpose/full effective ACLs; no selected grants found, no change authorized|
|High/high|Core RLS allows trusted shared backend all rows|Test all owner/department predicates; DB policies alone do not isolate application students|
|High/high|logicalBackup fixed scope and FK restrictions|Complete reviewed new-table/FK restore rehearsal before relevant migration, preserve existing backups|
|High/high|Extractor completeness unavailable|Automatic removals must wait for trusted complete manifest, retain previous head on failures|
|Medium/high|Draft creation omits contact; Registry fallback|Canonical department→actual assignment in phase3|
|Medium/high|Direct POST tickets bypasses draft consent|Explicit API creation-consent policy/validation|
|Medium/high|Managed upload before DB commit; deactivation leaves object bytes|Future compensation/retention policy; no blind cloud cleanup|
|Medium/high|MIME selected by extension, no full malware pipeline observed|Magic/size/content validation and safe private download before attachments|
|Medium/high|Profile lock process-local/private object overwritten|CAS/version or DB pointer if multi-instance; retain409 guards|
|Medium/high|Prototype file accounts + offline frontend demo check|Backend JWT remains sole protected authority; never hardcode/document password|
|Medium/high|Guest UUID capability; Advisor/draft memory expiring|No anonymous private push; session ID is not permanent memory|
|Medium/medium|DatabaseVectorStore revision hashes corpus per read|Measure aggregate revision query overhead before optimizing; cache avoids repeated full downloads|

## Preserve protections
HMAC JWT/scrypt; owned sessions; staff role/department gate; server-only private Storage keys; CA+hostname pg TLS; runtime role restrictions/separate migration credential; guarded hash/fingerprint/lock/transaction migration; validated action registry; DOMPurify/textContent; bounded payload/model context. Privileged read-only diagnostics are not application runtime authorization.

## Performance and reliability
Existing Render Free config: one ephemeral instance/no disk, small pool2, baked MiniLM,32MiB singleflight corpus snapshot. Historical constrained Linux latency/cold-start reports are not fresh audit benchmarks. Preserve deterministic tuition before RAG and Groq byte/framing/output bounds; aiService avoids unchanged oversized fallback retries. Timetable lookups indexed in memory; accepted-head refresh30sec singleflight, full snapshot only on changed ID. Combined inbox uses consistent snapshot/bounded list and separate unread count.

One visibility/auth-aware30sec poll must survive UI move without duplication/stale account responses. Free backend sleep delays notification delivery; absolute override expiry cannot rely on timers. Unique DB keys/advisory locks—not memory maps—deduplicate multiple instances. No paid/always-running worker requirement.

Historical widget139.29kB/gzip43.42 is not an audit build measurement. Mobile frame rate/GPS/bundle load need future browser checks. Maintainability changes should target demonstrated coupling: canonical identifiers, shared academic context/effective timetable, one inbox client. Keep private tickets/notes out of public RAG and approved-answer learning.


## Phase 3 implementation update — 2026-11-11

New support tables have backend-only RLS/grants; owner/department checks protect contacts and bytes. Antivirus is not configured; pending object cleanup and real private byte recovery require release follow-up. See [Phase3 implementation and evidence](18_PHASE_3_IMPLEMENTATION.md) for authoritative current details. Earlier audit findings remain historical.


## Phase 5 local implementation — 2026-11-11

New peer tables use backend-only RLS/grants and signed application-owner checks. Contacts require separate tutoring consent and may be withdrawn; no support defaults are imported. Bounded current academic snapshot reads preserve validity; hosted latency is unmeasured. See [Phase5 implementation and fresh evidence](20_PHASE_5_IMPLEMENTATION.md). Older audit statements remain historical.


## Phase 6 local implementation — 2026-11-11

New daily/reminder tables have backend-only RLS/grants, signed owner checks and per-owner transaction locks. Reminder contents stay out of model history. Offline delivery is lazy; a lost/suppressed automatic response can consume its at-most-once daily claim. See [Phase6 implementation and verification](21_PHASE_6_IMPLEMENTATION.md). Prior audit/proposal findings remain historical.


## Phase 7 local implementation — 2026-11-11

007 provides backend-only RLS/grants and reviewed source/targeting/revision gates. Offline caches contain only explicitly approved public assets; no private API or token caching. Generated study material is distinguished from university evidence. See [implementation report](22_PHASE_7_IMPLEMENTATION.md) and [consolidated handoff](23_CONSOLIDATED_ACCEPTANCE_HANDOFF.md).
