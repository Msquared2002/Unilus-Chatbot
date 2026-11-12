# Architecture and file map

> **Phase 1 implementation update (2026-11-10):** Read [the implementation delta, fresh tests and remaining acceptance gates](16_PHASE_1_IMPLEMENTATION.md) before using this historical audit snapshot. Fixed profile, automatic import adapter, persisted override and widget inbox are now implemented locally; no production release or browser acceptance is claimed.


Audit: **2026-11-10, Africa/Lusaka**. Local HEAD `9cbdeb0517da8820b94a623d9b8facbef50ae1ee`, branch `codex/production-integration`, **with pre-existing uncommitted unified-notification work**. Source findings describe that working tree unless explicitly marked production. Documentation only; no implementation/release authorized. [Master](00_MASTER_AUDIT.md) · [Evidence freshness](14_DECISIONS_AND_ASSUMPTIONS.md)

## Repository and frontend
Integration root is recorded in [.source-evidence.json](.source-evidence.json); origin https://github.com/Msquared2002/Unilus-Chatbot, branch codex/production-integration. Local main is separate; no branch changes. The inspected sibling Systems-Dev directory is not itself a Git root; its underlying remote/source was not located, so do not conflate it with this Group Studio repository.

| Entry / exact source path | Responsibility |
|---|---|
|dummy-environment/website.html; index.html; apply.html; elearning.html|Public website/demo pages|
|dummy-environment/portal-login.html; js/portal-login.js|Demo sign-in/programme selection; backend signed token remains authority|
|dummy-environment/portal.html; js/demo-session.js; js/demo-academics.js|Student portal/session lifecycle, profile API rendering/renewal; auth/profile/chat state sessionStorage; scoped preferences localStorage|
|dummy-environment/admin.html and admin adapter scripts|Staff queues, assignments, reply/status/knowledge controls; backend role/department checks decisive|
|dummy-environment/chatbot-widget/main.js; widget.js|Shared widget mount/init/goToView, chat/map/settings, expansion/theme/navigation across pages|
|dummy-environment/chatbot-widget/app.js|API request/render flow, timetable/answer formatting; marked+DOMPurify|
|dummy-environment/chatbot-widget/suggested-action-registry.js|Supported contextual action validation/execution|
|dummy-environment/chatbot-widget/avatar.js; avatar-entitlements.js; avatar-hairstyles.js|Emotion/customization/outfit/accessory logic; preserve guest/student visibility and event lifecycle|
|dummy-environment/chatbot-widget/widget.css; integration.css; avatar.css|Responsive/dark/expanded styling and existing avatar presentation|
|dummy-environment/chatbot-widget/campus-map.js; campus-location.js; campus-search.js; campus-data-client.js|Leaflet/place/photo/GPS/search/route integration|
|dummy-environment/js/ticket-notifications.js; css/notifications.css|Local combined inbox polling/presentation prepended to portal main; not a widget bell|
|dummy-environment/js/api-config.js; runtime-config.js|Shared API origin; production runtime config currently points at Render|
|dummy-environment/chatbot-widget/vite.config.js; package.json|Vite production bundle; deployment/configureFrontend.cjs requires HTTPS production API; published static tree dummy-environment|

Survey/editor and 3D preview HTML pages are development tools, not evidence of active portal features. Complete frontend entries and route files are in source evidence; old *_before_navigation.js is not automatically mounted.

## Backend/service flow
backend/server.js loads environment then app.start. backend/app.js installs CORS, payload/rate limits, attachUser, readiness gating and routes; initialize checks DB/runtime permission/private bucket, hydrates durable knowledge and local accepted timetable, optionally warms MiniLM/corpus. Production startup does not create tables.

Browser → configured HTTPS API → attachUser → owned-session/route role checks → services → db.js PostgreSQL or local SQLite / server-only private Storage. Chat routes resolve server session and simulated academic context; chatService dispatches deterministic tuition/academics/support/advisor/navigation then retrieval/generation as appropriate. Responses preserve legacy answer/session/source/action fields and optional navigation/route/academic/advisor metadata. Keeping sessionId does not establish durable unlimited conversational memory.

| Service boundary | Exact modules/functions |
|---|---|
|Identity/ownership|backend/services/authService.js sign-in/JWT; middleware/attachUser.js; sessionOwnershipService.js resolveSession/owns|
|Planning/chat|chatService.js; queryUnderstandingService.js Groq planner; aiService.js bounded generation/grounding/fallback|
|Hybrid knowledge|knowledgeService.js MiniLM384/BM25/RRF; databaseVectorStore.js durable payload; knowledgeSnapshotCache.js revision/singleflight32MiB; retrievalRouter.js structured routing|
|Programme/fees|programmeAdvisorService.js, programmePreferenceService.js, programmeCatalogueService.js and ECZ/eligibility services; tuitionFeeService.js verified structured lookup|
|Academic simulation|demoAcademicService.js allowed/mappings/generate/load/renew/publicProfile/withChat; demoAcademicChatService.js; undergraduateAcademicPolicy.js model4|
|Timetable|timetableService.js indexed getters/acceptSnapshot; timetablePresentationService.js; timetableUpdater.js validation/swap; local timetableChangeService.js and timetableNotificationService.js publish/diff/head/subscription|
|Campus|campusRepository and campusRoutingService.js, source backend/data/campus|
|Support|supportConversationService.js draft/consent; supportService.js createTicket; contactService.js topic contacts; ticketWorkflowService.js assign/list/status/reply; staffAnswerService.js approved reuse|
|Notifications|ticketNotificationService.js derived owner events/receipts; notificationService.js consistent combined inbox; local timetableNotificationService.js|
|Document/operations|managedKnowledgeService.js private object+metadata/vector management; db.js adapter; migrationService.js guard; postgresOperations.js and logicalBackup.js standalone tooling|

## Mounted route map
- POST /api/chat: routes/chatRoutes.js; server identity/context; production chat calls persist logs.
- /api/auth: authRoutes.js, private hashed user-file authentication, not Supabase Auth or SQL users.
- /api/demo-academics/profile GET/POST and /programmes: allowlisted students. Profile GET may persist/create Storage; not read-only audit-safe.
- /api/timetable: root, /course/:code, /programme/:code, /lecturer/:name, /day/:day, /search.
- /api/campus: campusRoutes.js place/search/navigation routes, canonical destination IDs and fail-closed routing metadata.
- /api/tickets and staff support operations: supportRoutes.js ownership or staff/admin/department gates.
- /api/notifications GET; POST /:id/read; GET /ticket/:ref. Local /timetable/options, PUT/DELETE /timetable/subscription depend003.
- /api/admin/documents POST/DELETE; /api/admin/knowledge GET/refresh-website: administrative knowledge management, not ticket attachments.
- Feedback/staff answers retain their existing route modules. /readyz is readiness, not full feature acceptance.

## Material coupling
Simulator curriculum currently depends on timetable and programme catalogue reads shared frontend catalogue data. JWT/context/profile are coordinated but distributed. Reuse a shared academic context adapter, not another session system. Use one widget goToView/notification polling lifecycle; one accepted timetable authority. Corpus cache is shared public/authorized content state, never a cross-student answer cache.

## Direct source references

- [Backend app](../../backend/app.js), [chat route](../../backend/routes/chatRoutes.js), [chat orchestration](../../backend/services/chatService.js), [auth](../../backend/services/authService.js), [ownership](../../backend/services/sessionOwnershipService.js).
- [Academic simulator](../../backend/services/demoAcademicService.js), [academic answers](../../backend/services/demoAcademicChatService.js), [academic policy](../../backend/services/undergraduateAcademicPolicy.js), [portal rendering](../../dummy-environment/js/demo-academics.js).
- [Timetable service](../../backend/services/timetableService.js), [import](../../backend/services/timetableUpdater.js), [diff](../../backend/services/timetableChangeService.js), [publication/recipient service](../../backend/services/timetableNotificationService.js), [combined inbox](../../backend/services/notificationService.js), [routes](../../backend/routes/notificationRoutes.js).
- [Widget state/views](../../dummy-environment/chatbot-widget/widget.js), [chat rendering](../../dummy-environment/chatbot-widget/app.js), [current notification presentation](../../dummy-environment/js/ticket-notifications.js), [portal](../../dummy-environment/portal.html).
- [Support draft](../../backend/services/supportConversationService.js), [ticket service](../../backend/services/supportService.js), [workflow](../../backend/services/ticketWorkflowService.js), [document persistence](../../backend/services/managedKnowledgeService.js).
- [Knowledge](../../backend/services/knowledgeService.js), [database adapter](../../backend/services/db.js), [migration guards](../../backend/services/migrationService.js), [backup scope](../../backend/services/logicalBackup.js), [Python integration description](../../backend/README.md).
- [Campus routing](../../backend/services/campusRoutingService.js), [map rendering](../../dummy-environment/chatbot-widget/campus-map.js), [routing graph](../../backend/data/campus/campus_routing_graph.json).

Current map background uses Esri World Imagery in campus-map.js, while GIS imports include OpenStreetMap data; do not describe the tile provider as OSM simply because place geometry originated there.

## Phase 1 new source map

backend/data/bit-curriculum-v1.json is the BIT catalogue; demoAcademicService fixed-v1 transcript is distinct from legacy active profile storage. academicContextService resolves server registration/stage/group. timetableIngestionService is the complete-manifest adapter used by timetableUpdater and scripts/ingestTimetable.js. timetableOverrideService overlays immutable publication rows and settles deduplicated lifecycle events. notificationRoutes adds owned /timetable/:id details. Widget main.js imports one shared ticket-notifications.js; widget.js owns notification view/back state; portal standalone notification script removed. Expanded backup scope lives in postgresOperations/logicalBackup/rehearsePortableBackup. Exact delta/tests: [implementation report](16_PHASE_1_IMPLEMENTATION.md).
