# Developer integration and Programme Advisor repair

## Scope and provenance

Baseline: `c5767a671928717994cb2850c81e07388ed1a0b3`, branch `codex/production-integration`. The original dirty checkout was preserved. All remote branches were fetched and inspected; no branch was merged wholesale.

Pete's `ef89cb8` (merged into main in PR #5, `ce112e1`) supplies the feedback, answer-PDF renderer and browser-native voice designs adapted here. PR #4 (`3d0bf3b`, source `c31fae0`) supplies overlapping ticket/email/notification ideas. Older backend-fixes and PostgreSQL branches were compared with our established implementation.

| Contribution | Integration decision |
| --- | --- |
| Answer ratings, reasons, review and CSV | Adapted to session ownership and administrator-only review; category/reference replaces private question/answer storage. |
| PDF answer export | Reused PDFKit renderer with bounded, stateless export and ownership checks. Widget initiates the download. |
| Microphone and read-aloud | Integrated browser APIs, explicit user activation, editable transcript, no automatic send; cancel on account/profile changes. |
| Contacts, staff replies, ticket notifications, consent, uploads | Existing protected Digital Front Desk, unified inbox and managed documents remain authoritative; duplicate implementations excluded. |
| Visitor email | Deferred: no email provider is configured. No email was sent or claimed delivered. |
| Chat-document analysis | Deferred: separate memory/text cache and answering pipeline need private-document lifecycle, prompt-budget and transcript-persistence safeguards. Existing ticket attachments and staff knowledge uploads remain available. |

## Advisor repair

Broad selection requests previously fell through FAQ routing. Casual uncertainty intercepted active admissions context; history had no interest-to-catalogue association. The repaired router recognizes broad intent and temporary session-scoped follow-ups while retaining safety, wellbeing, academic, fee, timetable, reminder and navigation precedence.

Recommendations use the existing 89-entry catalogue (24 current offerings; 15 entries with structured rules). The existing current/verified undergraduate filter remains. Weighted history/politics/government and other interest connections are explicitly **inferred guidance based on verified titles/descriptions**, not invented modules or objective aptitude scores. Recent preference refinements influence ranking. Unsupported programmes are not manufactured. Actual catalogue source URLs accompany recommendations.

The original seven-turn history conversation now refines toward Politics and International Relations, offers Development Studies/Public Administration alternatives, preserves the selected programme and invites qualification details. Interest guidance does not require grades. Existing ECZ interpretation, qualification confirmation, partial/conflicting rules and no-admission-guarantee safeguards remain separate. State retains the existing 30-minute inactivity expiry/reset and owner-bound chat sessions.

Academic regression additions recognize completed-semester averages, weakest-course requests and reverse-form pasted university marks without treating them as ECZ results. No academic records or grading calculations changed.

## API and data compatibility

- Existing `POST /api/feedback` remains compatible; optional `answerRef`, `reason`, `category` and returned `id` enable idempotent ratings.
- `PATCH /api/feedback/:id` requires matching session ownership.
- `GET /api/admin/feedback` and `PATCH /api/admin/feedback/:id` require administrator authorization. Responses omit transcripts/session identifiers. CSV exports the bounded visible review list and escapes spreadsheet formulas.
- `POST /api/chat/pdf` renders caller-displayed text only; no transcript retrieval, file access or model calls. It validates sizes/source strings, checks any supplied session ownership, limits concurrent rendering and returns a non-cacheable PDF.
- PostgreSQL's existing optional feedback columns are verified read-only. No database migration, role/grant change or cloud resource is needed. SQLite test initialization adds the same optional columns locally.
- Only dependency added: `pdfkit@0.20.2`, matching the developer's implementation.

## Verification and limitations

Focused tests cover complete Advisor conversations, topic/crisis/academic isolation, duplicate feedback, persistence, student ownership, administrator permissions, contact/mark redaction, PDF bounds and source/table rendering. The existing full suites additionally cover ECZ corrections, foreign qualifications, conflicting requirements, ticket/notification permissions and other protected features.

Real local guest-widget acceptance covers all seven history turns, rating submission, a downloaded PDF, mobile page overflow, zero uncaught errors, and a browser speech API double proving explicit activation and account-switch cancellation. The downloaded PDF was rendered and visually inspected. Actual microphone transcription/audio quality still requires a supported device/browser and permission; browser support varies. Speech recognition may use the browser vendor's online service.

Read-only production checks verify TLS 1.3, existing feedback columns/RLS/runtime grants and migrations 001–007. Existing encrypted backups remain machine/Windows-identity dependent; independent recovery remains deferred by the owner. Historical recovery of 34 conversation rows is **not** part of this release and was not executed.

Local release evidence and final hosted results are retained privately under `deployment/collab-*`; the deployment handoff records exact release/deployment IDs. No avatar, peer-tutor registration or pedestrian-routing changes are included.
