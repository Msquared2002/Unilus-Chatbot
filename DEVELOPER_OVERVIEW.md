# UNILUS Chatbot developer overview

This document describes the current student project at a high level. The backend is CommonJS Node.js, while the widget is built with Vite and vanilla JavaScript. The dummy environment provides static university pages and demo workflows.

## Main folders

- `backend/` — Express API, chatbot and retrieval services, ingestion tools, campus routing, data, and Node tests.
- `dummy-environment/` — static demonstration pages, shared site scripts/styles, Support Centre dashboard, and chatbot widget.
- `dummy-environment/chatbot-widget/` — widget UI, avatar renderer/assets, campus map modules, widget styles, Vite build, and focused tests.
- `dummy-environment/chatbot-widget/3d-prototype/` — isolated avatar experiment and preview; not part of the production widget flow.
- `android-survey/` — Android offline field-survey app and bundled web assets used to collect campus routing data.
- `Context/` — project reference material; treat its contents as supporting documents rather than runtime code.

## Important files

- `backend/server.js` mounts the HTTP routes and starts the API.
- `backend/routes/chatRoutes.js` exposes the chat endpoint; `backend/services/chatService.js` coordinates question handling.
- `backend/services/retrievalService.js` selects timetable, knowledge, and resource evidence; `backend/services/aiService.js` generates grounded responses.
- `backend/routes/campusRoutes.js` exposes campus data and route endpoints.
- `backend/services/campusRepository.js` loads canonical campus data; `campusGraphBuilder.js` builds/validates graph geometry; `campusRoutingService.js` finds local walking paths.
- `dummy-environment/chatbot-widget/widget.js` coordinates widget UI and backend requests; `main.js` is the Vite entry and prepares Markdown rendering.
- `dummy-environment/chatbot-widget/avatar.js` renders and updates the avatar; `avatar-hairstyles.js`, `avatar-entitlements.js`, `avatar.css`, and asset folders define appearance and options.
- `dummy-environment/admin.html`, `js/admin.js`, `js/admin-ticket-service.js`, and `css/admin.css` implement the Support Centre dashboard and its demo ticket operations.
- `backend/tests/` covers API services, data contracts, retrieval, and routing. `dummy-environment/chatbot-widget/tests/` covers avatar option behavior.

## Frontend to backend connection

The static dummy pages load the built widget bundle from `dummy-environment/chatbot-widget/dist/chatbot-widget.js`. The widget sends chat requests to the backend chat route and campus/map requests to campus routes. The backend returns structured answer fields and optional navigation/map data for the widget to render. Keep those JSON response fields stable when maintaining the UI or API.

The static site and demo pages can also load page-specific scripts under `dummy-environment/js/`; shared site behavior is in `shared.js` and shared styling is in `css/shared.css`.

## Chatbot flow

1. The widget collects a question and sends it to `/api/chat` with the current session identifier when available.
2. `chatRoutes.js` delegates to `chatService.answerQuestion()` and returns the answer plus sources, resources, timetable matches, and optional navigation metadata.
3. `chatService.js` asks `navigationService` to handle campus navigation intent and otherwise uses `retrievalService` for timetable, document, and resource evidence.
4. `aiService.js` produces a response from the gathered evidence. The widget renders the returned text and structured results.

Document and website ingestion scripts generate retrieval data under `backend/data/`; generated data should be rebuilt using the documented backend npm scripts rather than edited casually.

## Campus routing

Campus places, buildings, boundary, access points, and routing graph are stored under `backend/data/campus/`. `campusRepository.js` loads canonical records. `locationSearchService.js` resolves place queries, `navigationIntentDetector.js` recognizes route requests, and `campusRoutingService.js` searches the pedestrian graph between mapped entrances. `mapResponseBuilder.js` shapes route/place results for the API. The widget’s `campus-data-client.js` adapts API records, while `campus-map.js`, `campus-search.js`, and `campus-location.js` display and interact with them.

Survey pages and the Android survey app collect candidate field data. Processing and validation scripts review that input before promotion to production campus data. Keep this review/promotion boundary intact.

## Avatar system

`avatar.js` creates and updates the DOM-based avatar. `avatar.css` defines its layers and animation. Hairstyle metadata and selection rules live in `avatar-hairstyles.js` and `avatar-entitlements.js`; outfit and hairstyle artwork lives in the widget asset folders. The widget requests avatar state changes through the renderer’s public API. The 3D prototype is separate and does not replace this production path.

## Support Centre

`admin.html` provides the dashboard structure and loads its page assets. `js/admin.js` coordinates the dashboard UI; `js/admin-ticket-service.js` owns the ticket data operations for the current demo. `css/admin.css` styles dashboard components. The current ticket service is demo/local behavior; connect a future persisted ticket backend through this service boundary while keeping dashboard rendering and API contracts stable.

## Future Supabase integration

No Supabase provider is assumed to exist today. A future integration can be introduced behind the existing service boundaries: backend service modules for chatbot/campus data and `admin-ticket-service.js` for Support Centre records. Keep credentials on the server, define and review database policies before connecting user data, and preserve current route response shapes. Avoid direct Supabase calls scattered across page components.

## Comment format

For non-obvious behavior or cross-file decisions, use this format:

```text
Changes: What this section changes.
Affects: Which file, component, or contract it affects.
Purpose: Why the behavior exists or which decision it preserves.
```

Add comments where they record intent or invariants, not where the code already makes the behavior obvious.
