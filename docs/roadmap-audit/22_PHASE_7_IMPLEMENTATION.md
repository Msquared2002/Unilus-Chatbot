# Phase 7 — Remaining Student Companion enhancements

Date:2026-11-11, Africa/Lusaka. Local implementation and automated verification only. All prior uncommitted work is preserved. Phase4 pedestrian navigation remains deferred. No commit, push, production migration, hosted account/credential change, deployment, cloud write or backup overwrite occurred.

## Status and scope

| Capability | Actual status |
|---|---|
| Calendar/examination contracts and deterministic lookup | Implemented/tested; awaiting reviewed current official records |
| Announcement publication, targeting, revision and existing-inbox receipts | Implemented/tested; no real announcements seeded |
| Lecturer consultation lookup and approved contact contract | Implemented/tested; no real consultation records seeded |
| Course-aware educational explanation/resources/practice | Implemented using existing hybrid retrieval and Groq chain; generated material explicitly labelled |
| Facility operating information | Existing dated signage/OSM records reused with freshness/source qualifications and View on Map |
| PWA/offline | Manifest, existing-asset icon, public fallback cache/update policy and connectivity handling implemented; browser installation not manually verified |
| Accessibility | Targeted input/scroll-region labels, keyboard focus, reduced-motion and safe announcement detail controls |
| Phase4 routing, voice and translation | Deferred/not implemented |
| Production/live-source/visual acceptance | Not performed; requires the owner's next authorization |

This extends the current chatbot, not another dashboard, notification system, profile database, vector index or document store. Reused components include signed auth/owner identity, academicContextService, existing catalogue/peer course resolver, managedKnowledgeService source metadata, knowledgeService hybrid search, aiService budget/fallback/sanitization, resourceService, campusRepository/locationSearch, the existing notificationService/bell lifecycle, morningBriefService and guarded migration/logical recovery tooling.

## Sources examined and authority limits

Detailed file hashes/findings are in phase7-source-evidence.json. Source data and the existing knowledge corpus were not rewritten or bootstrapped.

- handbook.txt late-registration section (around1095) refers to the academic calendar but does not provide current semester dates. Existing chunks include193 handbook-text and447 handbook-PDF chunks.
- Four indexed IMPORTANT_EXAMINATION_RULES_2026 PDF chunks contain examination conduct/arrival rules and direct students to the final portal timetable. Rules/arrival times are not current dated exam sessions.
- exam-timetable-bit-bcs-bscs.txt contains weekday/day-of-month entries without a verified month/year/current academic period and retains legacy programme-name conflicts. It is not imported as a current examination feed.
- The local vector manifest records1447 MiniLM entries. An existing corpus, prospectus, filename timestamp or uploaded document is not proof of a live operational calendar/announcement/consultation feed. No fresh Supabase corpus inspection or external source authentication was performed.
- Public campus observations include hospital services/visiting hours, library OSM hours, gym timetable and gym/sports prices, with27September2026 observation metadata/photo references. The gym poster's commencement date lacks a verified year; it is not converted into a dated calendar event.

No dependable current structured academic calendar, published exam feed, active announcement feed or lecturer-approved office-hours feed was established locally. These features are source-integration-ready, not claimed live official university integrations. The administrator's source review is a human attestation: an official-domain URL and valid fields do not themselves independently prove factual authenticity.

## Structured publication contract and administration

academicPublicationService uses one minimal versioned metadata model for calendar, exam, announcement and consultation records. It stores bounded title/summary, kind, immutable record key/revision, official source URL, optional existing managed-document ID, verification/validity/effective timestamps, explicit academic period, audience/targets, kind-specific payload, previous revision, publisher and publication time. It stores no new PDF/object bytes and does not duplicate the RAG corpus.

Only the existing signed admin role can create/review/publish/cancel. General staff, students, guests and the non-production shared admin-key shortcut cannot publish through these endpoints. Uploading or indexing a document never publishes a record. An explicit publication operation requires confirmed/sourceReviewed/targetingReviewed flags. The normalized stored draft can be fetched before publishing.

Local API contract:

- POST /api/admin/academic-publications — validated draft JSON.
- GET /api/admin/academic-publications/:id — authorized review of the stored draft/version/targets.
- POST /api/admin/academic-publications/:id/publish — explicit reviewed publication.
- POST /api/admin/academic-publications/:id/cancel — authorized cancellation.
- GET /api/academic-information/:kind — bounded currently visible records, optional period/course/lecturerId.
- GET /api/announcements/:id — currently authorized announcement detail.

The input fields are recordKey, revision, kind, title, summary, sourceUrl, optional sourceDocument, verifiedAt, validUntil, effectiveAt, period, audience, targets, payload and optional supersedes. Source URLs require HTTPS on unilus.ac.zm or its subdomains, without credentials, query secrets, fragments or custom ports. Timestamps must be exact UTC ISO values. Verification cannot be future or more than30 days old; validity is bounded to180 days from review and must contain event times. A later stale/expired record needs a reviewed revision. This conservative policy may require periodic operator review of long-term events.

Source-document IDs reference active existing managed_documents. A restricted document cannot support a public publication; deactivation removes its linked publication from student/public selection. No private object key or signed download URL is exposed.

New revisions explicitly reference the prior version and cannot change record kind under the same identity. Publishing a revision supersedes older published/cancelled versions atomically; stale drafts cannot displace a newer publication. Repeated publication does not generate another notification. Cancellation/expiry remove normal visibility while preserving metadata/history for authorized review and recovery. This is API-level administration; no separate authoring dashboard or bulk automatic PDF-to-publication workflow was introduced.

## Academic calendar and examination separation

Calendar payloads distinguish term, registration, examinations, holiday, deadline and semester-end with start/end timestamps. The response preserves period/source/review time and Africa/Lusaka display. Personal this-semester/deadline queries ask for an explicit published period when it is not verified; they do not infer the current academic term from weekly lectures or simulated academic-year numbers.

Examination payloads require a canonical course, named published venue, exact timestamps, academic period and student programme targeting. Lookup filters against stored registered courses and programme context. BCS catalogue ambiguity remains fail-closed. Unknown group membership returns a possible group-specific exam candidate, never a definite appointment, seat number or eligibility assertion. Other mismatched targets are excluded. Guest exam access is denied. General examination-period questions can use the calendar examinations category; personal exam schedules use the distinct exam contract. Neither personal reminders nor recurring lectures become examination sources.

Only published/effective/unexpired/recently-reviewed records appear. Empty results say the system has no current verified record to show, not that the university has issued none. Calendar categories are filtered for the question rather than returning an unrelated deadline or holiday as semester-end evidence.

## Announcements, targeting and existing notifications

Announcement targeting uses optional canonical programme/year/semester/mode/group/course/owner constraints. Unknown group does not authorize a group-specific announcement. Owners derive from signed identities; client-submitted usernames do not authorize student reads. Public records cannot contain private targeting. Public announcements are accessible to guests; student-specific ones require the correct signed context. Data views omit target-owner arrays, publisher identity and internal source-document keys.

Announcements are a category of the same unified inbox. Eligible published revisions form the notification identity; academic_notice_reads stores one immutable owner/publication receipt. There is no second generic notification table/poller or write on every source update. Draft imports generate no event. A revised published notice has a new identity/read state. Revoked, retargeted, superseded, stale or cancelled records cannot be retrieved through an old detail ID. The existing bell opens authorized detail and acknowledges it only after successful load. Brief generation mentions relevant summaries without marking them read.

Student lists expose up to20 matching records from a bounded100-record current candidate window, with a limited flag. Announcement unread counts cover the eligible bounded notice window rather than all historical publications. A much larger institutional feed would require publication pagination/target indexing before broad rollout; no large-feed completeness or delivery while the backend sleeps is claimed.

## Lecturer consultation and contact

Consultation payloads require an existing canonical lecturer ID and actual existing course/lecturer association, department, published hours and office. Plain name similarity alone cannot establish identity. Exact lecturer-ID tokens are distinct from course codes, including identifiers such as HM087. Ambiguous names/course wording ask for clarification. Teaching-free timetable slots never become consultation hours.

Optional email/phone uses the existing validation helper only and requires explicit publisher contactApproved consent. Approved contact appears with the reviewed consultation record; no Phase3 support defaults, personal student contacts or Phase5 tutor contacts are imported. No appointment booking is implemented. With no approved source, the response is unavailable or asks for the course/lecturer identifier rather than inventing availability.

## Course-aware study assistance

studySupportService resolves supported courses with the existing catalogue/current registration helpers, preserving code identity, ambiguous programming choices and BIT301 conflicts. It sends only the selected course identity, educational question/reference and bounded authorized excerpts to the existing AI service—not the student's transcript, marks, reminders, ticket history or tutor connections.

Knowledge lookup reuses existing MiniLM/hybrid search, with at most6 candidates and4 retained excerpts, no neighbor expansion and bounded excerpt lengths. Audience gates and additional study-source checks exclude exam schedules, private/unknown-access material, fees/prospectus/result/support content and student-record markers. It creates no vector store or document-ingestion pipeline.

Explicit study explanations/practice use a narrowly selected educational mode in the existing Groq completion/budget/fallback/URL-sanitization chain. General educational examples and numbers are permitted in that mode, with a separate prompt requiring institutional claims to remain source-grounded. Default university/tuition numeric grounding remains unchanged. Generated practice is prefixed AI-generated practice, not official UNILUS examination material. Other explanations distinguish general education from a verified university syllabus/assignment. Active graded work is handled with concept/similar-example guidance, not a claim to verify private assessment instructions.

Real source filenames/pages/URLs are preserved. If no approved course notes are found, that absence is explicit. A simple study-resource lookup returns actual indexed references/general existing e-learning links without a Groq call; it does not invent course materials. If generation is unavailable, no fabricated answer is substituted and real available references remain available.

A bounded30-minute/500-entry study reference store reuses the established store factory. It retains only owner/session/profile-bound educational topic text for a follow-up such as Explain this concept in simpler terms. It is not an unrestricted private conversation archive. Human-help questions continue to Phase5 tutor discovery, with no auto-registration/contact. A validated follow-up can offer that existing one-to-one workflow.

A genuine earlier integration defect was found: Phases5/6 emitted context.followup but neither action registry declared it. The ID is now registered consistently as the existing quick_reply type in backend/frontend validators. The current executor handles it; unknown IDs, mismatched types and arbitrary navigation URL payloads remain rejected. This also restores supported brief/tutor follow-up buttons.

## Facilities and photographs

facilityInfoService uses existing campusRepository/locationSearch records, not new GIS data. It returns place description, existing operating-hour tags and a conservative allowlist of already-ingested public campus text/metadata observations for hospital, library and gym. Dated signage observations preserve source filenames, observed dates, photo references and exact recorded details. Hospital services/hours and gym prices are not asserted as independently verified current availability. Cafeteria menus/prices and hostel availability remain unavailable when no source exists. No medical advice is generated.

Existing View on Map opens the actual canonical place, where existing photo handling remains available. No walking route, distance/time, entrance or OSM modification was made. Phase4 remains deferred.

## PWA and limited offline behavior

The public website and portal reference a manifest and small registration/connectivity script. The manifest starts on website.html, uses relative scope/paths, English metadata and an SVG icon embedding the unchanged permitted project crest. No new app, permission for push/microphone or paid service is introduced. Device installation and platform-specific icon behavior still require manual acceptance.

The service worker caches only four explicitly approved public assets: offline.html, original logo, icon and manifest. Installation fetches with credentials omitted and rejects private/no-store/opaque/non-success responses. Cache names are scoped to the application's pathname; activation removes only that application's older public-shell cache versions. It never force-activates/reloads with skipWaiting or clients.claim. Updates advise finishing the conversation and closing/reopening the site. Future shell changes must bump the worker's version; update behavior is covered by policy tests, not claimed visually installed.

Public-home navigations use the network, with the labelled offline shell only on network failure. Navigation responses themselves are never cached. Portal/admin/login navigations, all API paths, cross-origin requests, query-bearing URLs, non-GET, Authorization and X-Chat-Session requests are not intercepted or persisted. There is no runtime private response cache, IndexedDB personal store, offline submission queue or token cache. An offline request is not replayed later.

The fallback is deliberately limited branding/connectivity information. It does not render a cached authenticated portal or invent AI answers, current university facts, marks, tickets, files, tutor contacts, reminders or notifications. Existing sessionStorage-based online auth is not converted into an offline identity model. Public online Guest Mode remains independent of the portal; offline AI/live maps/Student Mode do not work. The live connectivity banner explains this and preserves the input draft. Reconnection uses the real network; no fake cached personalized answer is supplied.

## Targeted accessibility

No visual redesign/framework was introduced. Chat inputs now have explicit accessible names. Existing table-scroll wrappers receive keyboard focus, labelled region semantics and a visible focus outline; the original table layout/scroll wrapper is preserved. Links and notification actions have focus styling, long content wraps, and the connectivity banner uses a polite live status.

Reduced-motion preferences suppress avatar gaze tracking and shorten CSS movement for the actual avatar wrapper, while ordinary avatar emotions/customization remain unchanged when reduced motion is off. Announcement detail has a focusable heading and explicit close control returning focus where available. Account changes abort/clear private detail, and late responses cannot render for a different token. Browser/screen-reader/mobile visual acceptance is deferred, so DOM/source checks are not claimed as a complete accessibility certification.

## Schema, security and recovery

Local-only007_student_companion_enhancements.sql adds only academic_publications and academic_notice_reads. Keys include unique record/revision and owner/publication receipt; FKs preserve source-document, prior-revision and receipt dependencies. Indexed publication kind/status/effective/expiry supports bounded selection. RLS is enabled; PUBLIC/anon/authenticated direct grants are revoked. unilus_backend receives SELECT/INSERT/UPDATE only on publications and SELECT/INSERT only on receipts, with no DELETE/DDL or schema-admin privilege. It does not own the tables. Signed server predicates enforce student targeting for this shared backend role.

academicPublicationSchemaCheck is wired into the guarded runner and checks exact columns/types, keys/FKs, index, RLS/policies/effective grants. Existing migrations001–006 are byte-identical. Logical inspection/capture/recovery explicitly adds the two tables after managed documents and existing app tables. Isolated recovery verifies29 tables, revision/source links, read receipts, schema/indexes/policies/grants/fingerprints and denial of unauthorized mutation. Removing the required publication index causes guarded rollback before the valid isolated bundle is applied. No production migration or legacy remote public.notifications operation occurred. Existing backups were not overwritten. Synthetic recovery is not proof of complete hosted disaster recovery.

## Fresh automated verification

- phase7-focused.txt:18/18 backend source/publication/targeting/study/facility/real-chat routing tests.
- phase7-widget-focused.txt:14/14 announcement UI, PWA/offline and targeted accessibility checks.
- phase7-recovery.txt:1/1 guarded29-table migration/restore with negative index/permission tests.
- phase7-backend-full.txt:530/530 passed, zero failures/skips.
- phase7-widget-full.txt:182/182 passed, zero failures/skips.
- phase7-syntax.json:296/296 JavaScript syntax checks, including generated bundle and service worker.
- phase7-build.txt: production build passed,21 modules; bundle163.45kB, gzip51.20kB.
- phase7-source-evidence.json: local source findings/hashes and facility observation metadata.
- phase7-change-manifest.json / phase7-final-validation.json: exact source delta, immutable prior migrations, changed-file credential-pattern scan and consolidated final gates.

Focused counts are included in the full totals and should not be added again. Generation tests stub completion calls; no paid/live Groq evaluation is claimed. No actual institution publication was seeded. Credentials/student account files were not opened.

Development checks corrected missing local managed-document schema initialization for the new source dependency, overly escaped lecturer matching and lecturer-ID/course-code collisions, incomplete registered follow-up action IDs, and the facility adapter initially overlooking existing dated signage text. A syntax/fixture edit was corrected before final verification. Final artifacts supersede intermediate logs; existing tests were not weakened to conceal defects.

## Exact Phase7 source files

- dummy-environment/website.html
- dummy-environment/sw.js
- dummy-environment/portal.html
- dummy-environment/offline.html
- dummy-environment/manifest.webmanifest
- backend/app.js
- dummy-environment/js/ticket-notifications.js
- dummy-environment/js/public-pwa.js
- dummy-environment/chatbot-widget/widget.css
- dummy-environment/assets/pwa-icon.svg
- dummy-environment/chatbot-widget/avatar.js
- dummy-environment/chatbot-widget/app.js
- dummy-environment/chatbot-widget/academic-info.js
- dummy-environment/chatbot-widget/tests/pwa-offline.test.cjs
- dummy-environment/chatbot-widget/tests/academic-info.test.cjs
- dummy-environment/chatbot-widget/suggested-action-registry.js
- dummy-environment/chatbot-widget/dist/chatbot-widget.js
- backend/migrations/007_student_companion_enhancements.sql
- backend/routes/chatRoutes.js
- backend/routes/academicPublicationRoutes.js
- dummy-environment/chatbot-widget/main.js
- backend/services/chatService.js
- backend/services/aiService.js
- backend/services/academicPublicationService.js
- backend/services/academicPublicationSchemaCheck.js
- backend/services/academicPublicationSchema.js
- backend/services/migrationService.js
- backend/services/logicalBackup.js
- backend/services/facilityInfoService.js
- backend/services/notificationService.js
- backend/services/morningBriefService.js
- backend/services/postgresOperations.js
- backend/tests/studentCompanionRecovery.test.js
- backend/tests/studentCompanionEnhancements.test.js
- backend/services/suggestedActionRegistry.js
- backend/services/studySupportService.js

Documentation additionally updates00,03,10,11,12,13,14,15 and creates this22,23_CONSOLIDATED_ACCEPTANCE_HANDOFF.md and Phase7 evidence artifacts. phase7-baseline.json distinguishes this delta from all already-uncommitted prior work. No baseline file was removed.

## Remaining dependencies and release boundaries

Current official calendar/exam/announcement/consultation records require an authorized university publisher, real source review, correct academic period/cohort targets and a publication/revalidation process. Domain validation and synthetic fixtures do not complete that real-world integration. No scheduled ingestion from an official feed was invented. Source contacts/facility operations require periodic real verification.

Voice/multilingual capabilities remain feasibility items only. Future work could use the existing bounded text chain with language/name/number preservation tests, or evaluate browser speech capabilities with explicit consent/text fallback. Browser/provider privacy, language evaluation and institutional terminology need review first. No voice/translation provider, microphone use or new charge was added.

Pending consolidated acceptance must verify real browser installation/service-worker scope/update/offline behavior, mobile icon support, keyboard/screen-reader/reduced-motion behavior, account switching, source administration, all prior student/staff flows and free-host cold start. The owner must separately approve Git/release/cloud actions. A future release needs fresh read-only remote ledger/schema/grant inspection, current recovery coverage and explicit guarded review of pending migrations; never blindly reapply completed migrations. The previously documented remote public.notifications question remains untouched/unresolved. See23 for the concise consolidated handoff.

Local Phase7 implementation is complete as far as trustworthy available data allows. Live source integration and hosted/manual acceptance are not complete. Phase4 remains deferred. Await the owner's explicit next authorization before final acceptance/release activities.
