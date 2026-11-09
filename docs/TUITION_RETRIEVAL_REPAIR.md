# Tuition retrieval repair — 9 November 2026

## Evidence and root causes

Read the original PDFs with the existing pdf-parse extractor; rendered and visually checked prospectus PDF pages 13–14 to verify the two-column table associations. No shared data was changed.

A verified-TLS PostgreSQL `BEGIN READ ONLY` inspection found 1,447 Supabase knowledge records, matching the local index count. Both contain seven chunks from each 2025 undergraduate schedule and 229 from the 2026 prospectus. The relevant tables are **present**, not absent from ingestion or Supabase:

| Evidence | Existing indexed chunk | Finding |
|---|---|---|
| 2025 ZMW undergraduate schedule, PDF p1 | `24c5a511c1f859c3` | Computer Science and Cyber Security rows are intact, with eight semester amounts each. |
| 2026 prospectus, PDF p13 (printed p12) | `cbcb6d375af8f1ba` | Computer Science heading/descriptive text, separated from its table. |
| Same PDF page | `46d3267ca16dc789`, `b57397b3fb00aa0b` | Fee rows exist, but programme and fee_scope metadata are null; two-column extraction interleaves neighbouring programme content. |
| 2026 prospectus, PDF p14 (printed p13) | `0e0c7c463e36c5f3` | Information Systems and Technology and its ZMW/USD rows exist. Programme metadata is null. |

The baseline router loaded directly from commit `700206923f31ab06c82c1b3fa3c0929d7451c519` reproduces **82 timetable matches** for `fees for computer science bachelors`: `computer` is recognised as a lecturer-name token, making the query mixed timetable/knowledge. Programme year/semester signals also incorrectly trigger timetable retrieval for fees.

Baseline lexical-only retrieval on the real index (zero dense embedding, explicitly not a claim about every live Groq plan) ranked foreign undergraduate fees first and the postgraduate Computer Science prospectus chunk `4182ab7a05161970`, PDF p38, second; the local undergraduate table was fourth. `fees for BIT` returned no lexical evidence. Metadata conflicts are normally only suppressed when at least three clean candidates exist, so weak programme metadata allows unrelated candidates to survive.

The old generation path had no aggregate prompt budget: all formatted timetable/knowledge evidence and history could be sent with 2,500 output tokens. It also retried size errors across all fallback models. This explains the route to oversized requests; no historical provider error log is asserted to have been recovered.

## Focused correction

- `buildTuitionCatalogue.js` extracts 48 schedules offline from five existing PDFs: both 2025 general schedules, the 2026 prospectus and both Medicine-specific schedules. Source SHA256, exact programme name, calendar year and year basis, category, currency, physical PDF page, original selected row, study year, semester and amount remain together in `tuition-fees.json`. A reproducibility test checks every field against fresh PDF extraction.
- The small deterministic lookup runs before staff answers, the Programme Advisor, planner and general RAG for supported undergraduate tuition questions. It requires category rather than guessing; omitted semester returns the schedule. Omitted calendar year explicitly labels the most recent verified year for that exact programme/category, without claiming current fees. Explicit missing years never fall back to another year.
- BIT maps to **Bachelor of Science in Information Systems and Technology**. The differently named 2025 **Bachelor of Science in Information Technology** row is not silently reused for BIT. Computer Science, Cyber Security, Law and Medicine remain distinct. Postgraduate queries and the other clinical programmes retain their existing RAG path.
- Fee follow-ups reuse existing bounded session history; no competing session store was introduced. Supported answers return source metadata, legacy response fields, zero timetable matches and no weekday actions. Fee intent is also excluded from timetable classification at the general retrieval boundary.
- Source tables say *total fees per semester* or *Fees Schedule*. Responses therefore call the amounts published semester fees, not a verified tuition-only breakdown, and do not add general fees again. Medicine USD has no year in its body: its 2026 filename is explicitly identified as the year basis.
- Groq planner and generation models remain unchanged. Prompt construction bounds UTF-8 bytes including framing, retains grounding rules and reserves output; 7,000 input-budget units plus 800 output tokens remain below the documented 8K Free-tier allowance. This is a conservative byte bound, not an exact tokenizer claim. Optional history and evidence are shortened; oversized 413/context-size errors stop unchanged fallback attempts. Ordinary rate-limit fallback remains supported. Correction retries also undergo the budget check.

Official limit references: [Groq rate limits](https://console.groq.com/docs/rate-limits), [supported models](https://console.groq.com/docs/models). Account-specific remaining quota can still cause ordinary rate limits.

## Verification and delivery

Targeted source, service, API, budget and orchestration tests cover both Computer Science years, BIT naming, Cyber Security, LLB, Medicine categories, missing/ambiguous stage and year, fee follow-up corrections, source provenance, guest/student parity, no Groq calls for supported fees and no timetable actions. Size-error tests inject provider failures rather than deliberately sending oversized paid/provider requests.

Final results: full backend **366/366**, full widget **139/139**, focused tuition/budget/orchestration **47/47**, syntax **224/224**, production widget build passed and unchanged, credential scan **537 files / zero private-value matches**. Two old tests expecting tuition to reach Groq were changed to general university-regulation questions, retaining their planner/failure assertions; deterministic tuition has separate API coverage.

Changed files:

- `backend/data/tuition-fees.json`
- `backend/scripts/buildTuitionCatalogue.js`
- `backend/services/tuitionFeeService.js`
- `backend/services/groqRequestBudget.js`
- `backend/services/aiService.js`
- `backend/services/chatService.js`
- `backend/services/queryUnderstandingService.js`
- `backend/services/retrievalRouter.js`
- `backend/tests/tuitionFeeService.test.js`
- `backend/tests/tuitionApi.test.js`
- `backend/tests/groqRequestBudget.test.js`
- `backend/tests/chatOrchestrationRepair.test.js`
- `docs/TUITION_RETRIEVAL_REPAIR.md`

This is a local-only repair: no migrations, remote knowledge updates, push or deployment. The hosted application remains on the previous release until separately authorised deployment.
