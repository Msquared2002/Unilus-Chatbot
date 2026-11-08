# Silverest campus map verification

Follow-up release note: the findings below record the pre-fix investigation. D1–D4 have since been corrected with focused regressions: failed loads retry while successful/concurrent loads remain cached; cached GPS recenter reports completion; singular/plural hostel requests return existing destinations and ambiguous navigation asks for a choice; and search requests are invalidated immediately on input changes. Explicit named hostel-to-hostel routing preserves both endpoint roles. Final local verification passed 10 focused regressions, 349 backend tests, 139 widget tests, 218 syntax checks and the production build. Visual browser acceptance remains limited by the previously recorded platform restriction. The combined release is authorized separately by the owner; this historical report alone is not a deployment instruction.

Verification date: 9 November 2026, Africa/Lusaka. Local candidate: `d2f8cfaa5778a1f831fcc1e3c42669a8c2a43f9e`, branch `codex/production-integration`.

## 1. Executive summary

**Verdict: requires correction before the map can be signed off for the combined release.** The public map assets, canonical place data, photographs, API configuration and CORS are available and consistent with the local candidate. Deterministic navigation resolves four of the five requested example questions and the frontend consumes their destination IDs correctly in isolated tests. Internal pedestrian routing correctly refuses to fabricate routes.

Four confirmed defects remain: a failed initial campus-data request is cached permanently until refresh; a repeated cached-location re-center can leave its button disabled; plural “hostels” returns no location match; and an in-flight search can repopulate results after the input is cleared. The first, second and fourth were reproduced by executing the existing frontend functions with isolated mocks. The hostels failure was also confirmed against the public GET search endpoint.

No live or local visual browser result is claimed. The available Windows browser-control method was stopped by platform URL-policy enforcement before navigation. HTTP, mock-based functional tests and static CSS inspection do not establish visual tile rendering, actual GPS permission behaviour, touch gestures or console cleanliness.

Only this report was created. No application code, academic simulator, GIS data, photos, deployment configuration or shared records were changed. No commit, push, deployment, migration, OSM operation, knowledge bootstrap or support-ticket creation was performed. Public requests were GET only; the live `/api/chat` endpoint was deliberately not called because it persists conversations.

## 2. Exact active map architecture

| Layer | Active files / responsibility |
|---|---|
| Host page | `dummy-environment/website.html`: widget/map DOM, stylesheets and script loading |
| API origin | `dummy-environment/js/runtime-config.js`, then `js/api-config.js`; published base is `https://unilus-chatbot-free-demo.onrender.com/api` |
| Widget bundle | `dummy-environment/chatbot-widget/main.js` imports the map/data/location/search/widget/action/chat modules; shipped as `dist/chatbot-widget.js` |
| Map control | `chatbot-widget/widget.js`: `#map-btn` → `goToView('map')` → next-frame `CampusMap.show()` |
| Canonical data adapter | `chatbot-widget/campus-data-client.js`: loads `/campus/places`, `/campus/boundary`, and same-origin `chatbot-widget/campus-data/presentation.json` |
| Leaflet rendering | `chatbot-widget/campus-map.js`: map initialization, boundary/mask, markers, cards/photos, selection, list filters, recenter and route presentation |
| Search | `chatbot-widget/campus-search.js`: debounced GET `/campus/search?q=…`; selection calls `flyToBuilding` and `openBuildingCard` |
| GPS | `chatbot-widget/campus-location.js`: explicit geolocation requests, boundary check, position/accuracy markers and cached recenter |
| Presentation | `chatbot-widget/widget.css`, `avatar.css`, `integration.css`; `presentation.json` adds categories, facilities and gallery basenames without duplicating canonical geometry |
| API mounting | `backend/app.js` mounts `backend/routes/campusRoutes.js` at `/api/campus`, behind existing readiness, CORS and rate-limit middleware |
| Data repository | `backend/services/campusRepository.js` reads `backend/data/campus/campus_places.json`, `campus_boundary.json`, `campus_buildings.json`, catalogue/search data |
| Navigation | `navigationIntentDetector.js` → `locationSearchService.js` → `navigationService.js` → `mapResponseBuilder.js`; `chatService.js` forwards the deterministic navigation result |
| Chat action | `suggestedActionService.js` emits validated `campus.map` actions; widget `app.js` verifies matching IDs and creates View on Map controls |
| Routing | `campusRoutingService.js`, `campusGraphBuilder.js`, routing graph/access/walkway files; no new engine was introduced |

Leaflet is version **1.9.4**, loaded from `unpkg.com` before the production widget. The basemap is **Esri World Imagery**, not an OpenStreetMap tile layer:

`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`

OSM is the source of campus geometry and canonical destination identities. The widget's visible map uses Esri satellite imagery with attribution. It initializes Leaflet once, enables zoom controls, limits zoom to 15–18, calls `invalidateSize` on visibility/layout changes, draws the boundary outline and outside mask, fits campus bounds and constrains panning to padded campus bounds.

The data client swaps GeoJSON `[longitude, latitude]` into Leaflet `[latitude, longitude]`. It renders 23 named destination markers. `/campus/buildings` serves 37 physical building geometries, but the current widget does not request that endpoint or draw those unnamed footprints: its active named-place layer is the 23-marker layer. Place geometry in navigation responses does not mean a building polygon is highlighted; selection emphasizes the marker/card.

Read endpoints: `GET /api/campus/places`, `/places/:id`, `/places/:id/nearby`, `/boundary`, `/buildings`, `/search?q=…`. `POST /navigate` is a deterministic navigation diagnostic and `POST /route` reads the local graph; neither was invoked remotely during this investigation. Editor endpoints were not enabled or used.

## 3. Published Netlify and backend findings

Public page: <https://unilus-demo.netlify.app/website.html>. Backend: <https://unilus-chatbot-free-demo.onrender.com>.

The sandbox initially returned DNS `ENOTFOUND`. The same read-only checks were then run through the permitted host execution mechanism and succeeded. This was HTTP access, not a browser session.

| Public GET check | Observed result |
|---|---|
| `website.html` | 200 HTML; all 12 required map element IDs occur exactly once |
| Runtime configuration | 200 JavaScript; correct HTTPS Render `/api` origin |
| API configuration, widget bundle, widget/integration/avatar CSS | 200, appropriate content types |
| `presentation.json`, placeholder SVG | 200; presentation contents match local after normalizing line endings |
| `/readyz` | 200 ready at inspection time; not a cold-start reliability guarantee |
| `/api/campus/places` | 200, 23 canonical places; complete returned JSON matches the local repository |
| `/api/campus/boundary` | 200; complete JSON matches local; six ring coordinates |
| `/api/campus/buildings` | 200, 37 geometries |
| CORS on places, boundary, buildings and searches | `Access-Control-Allow-Origin: https://unilus-demo.netlify.app` when that Origin is supplied |
| Search `library` | Primary result `unilus_library` |
| Search `cafeteria` | Primary `cafeteria_school_of_medicine`, followed by `the_growcery` |
| Search `hostels` | **Empty list** |
| Search `hospital` | Primary `unilus_hospital` |
| Search `Academic Building A` | Primary `knowledge_field_1`; additional lower-ranked matches also returned |
| Leaflet JS and CSS on unpkg | Both 200 |
| Campus-centre Esri tile at zoom 17 | 200 JPEG, 16,757 bytes |
| Campus-centre Esri tile at zoom 18 | 200 JPEG, 13,661 bytes |

The two tile addresses were computed from campus centre `(-15.3550065, 28.4691214)`:

- `/tile/17/71194/75901`
- `/tile/18/142389/151802`

Successful tile responses do not prove their placement, masking or appearance in the browser. No actual browser console/network panel was accessible.

### Distinguishing published and local versions

The live widget bundle matches the checked-in bundle at historical baseline `745dd609028793b546c3213936710260ffc57cb9` after line-ending normalization. Its downloaded SHA256 is `4ddd12d495af246c8fe64587fed1a793d191ead071a241c92388dea9ba5931bc` (137,763 bytes). The local candidate bundle SHA256 is `4d1143c55ed2ea5e722c15d225e54a0c2fe7afb4bf26850a2960adf271e0c486`.

The live HTML has a different whole-file hash, but its map script/style URLs and required DOM IDs match the local host page. No full deployed backend commit was inferred from its public endpoints.

The map/data/location/search modules, `widget.js`, canonical campus data and presentation metadata are unchanged between that historical baseline and the local candidate. Live widget CSS matches the historical version; the local CSS adds only academic-table rules. API adapter, integration CSS and avatar CSS match after line-ending normalization. The defects below are therefore in shared pre-existing map code; they are not changes introduced by the academic correction. Their browser manifestation was not observed live.

## 4. Local candidate verification

An ephemeral, loopback-only Express harness used the **existing campus router and static frontend files**. It did not load the full application/database or real chat service. A local runtime-config response used `/api` so the candidate's map data requests stayed local. The process was closed after checking it.

- 12 map-page/script/style/data/API resource requests returned 200.
- Local places endpoint returned all 23 canonical records.
- All 48 referenced cover/gallery JPEG requests returned 200.
- No source or configuration files were edited to run the harness.

This verifies local HTTP availability and actual route output, not a local browser rendering. The Windows computer-use method was stopped with the platform explanation that URL-policy enforcement is unsupported for the current browser. No alternative was used to bypass that restriction. Consequently **both live-browser and local-browser checks remain unverified** in this pass.

## 5. Feature-by-feature evidence

Legend: **HTTP** = live read-only request; **local HTTP** = isolated current-source harness; **mock** = existing functions executed with isolated DOM/Leaflet/GPS mocks; **static** = source/CSS inspection; **unverified** = actual browser interaction/rendering unavailable.

| Requested feature | Evidence and result | Actual browser status |
|---|---|---|
| Map opens | Static button/view wiring; mock widget dispatch calls map show/open | Unverified |
| Background tiles | Esri layer configured; centre tiles at zooms 17/18 return JPEG over HTTP | Unverified rendering |
| Campus boundary | Live/local JSON identical; geometry tests pass; polygon/mask/fitBounds wiring present | Unverified rendering |
| Named markers | 23 IDs adapted successfully; marker click handler calls matching card ID | Unverified visibility/clicks |
| Canonical IDs | Backend catalogue, presentation and API agree; existing integrity tests pass | Data verified |
| Correct place information | Four navigation IDs consumed correctly in mocks; card reads corresponding place record | Unverified actual click/card layout |
| Photographs | All 51 existing campus image assets accessible live and byte-identical; 48 referenced photos available locally | Unverified browser decoding/display |
| Search | Live GET examples work except plural hostels; mock reproduces stale-result race | Defects; visual interaction unverified |
| Category filters | Existing handler execution produces All 23, Academic 7, Facilities 4, Food 2, Sports 7 list entries | Unverified visual interaction |
| Selected-marker emphasis | Existing functions select z-offset 1000, collapse previous marker to 0 and clear selection on close in mocks | Unverified visual appearance |
| Zoom/pan | Leaflet controls/default dragging, max bounds and 15–18 zoom limits configured | Unverified actual gestures |
| Re-center | First located click returns enabled; second cached-location click remains disabled in reproduction | **Confirmed defect** |
| GPS permission/error handling | Mocked unsupported API, denial, unavailable and timeout produce correct messages; on-campus fixture drives recenter | Real permission prompt/GPS unverified |
| Desktop expanded map | `toggleExpand` schedules map resize; CSS gives map full panel width/height with docked card | Unverified layout |
| Mobile fullscreen | At ≤640px panel is fixed to viewport; expand button hidden | Unverified layout |
| Mobile bottom sheet | Existing click/drag handlers toggle 42%/92% sheet state correctly in isolated mocks; close handler hides card | Real touch/rendering unverified |
| Chat View on Map | Actual app button handler passes correct IDs for four requested known destinations | Browser click unverified |
| Correct selected destination | Actual widget dispatcher calls open Silverest, fly to same ID, open same card ID in mocks | Browser highlight unverified |
| Missing assets | No missing referenced JPEG/script/style/data in checked requests; expected WebP fallback failures exist | Browser failure list unverified |
| Console/network errors | Expected library cover WebP probe returned 404; all checked actual JPEGs and dependencies succeeded | Console exceptions unverified |

Category filtering currently affects the **place list**, not the marker layer. All named map pins remain present. There is no separate hostel filter, but All contains the three hostel destinations. Re-center means the user's location, not reset-to-campus-bounds.

## 6. Map and photo asset integrity

There are 23 canonical destination IDs and 37 building geometries. Existing integrity tests verify unique canonical/OSM IDs, catalogue/search-index references and physical geometry contained by the campus boundary. The frontend presentation is keyed by exactly the canonical place-ID set and has no separate coordinate/name copies.

- **21** destinations have curated covers; **27** gallery entries yield **48** referenced JPEGs.
- Two destinations deliberately lack covers: `hostel_school_of_medicine_side` (**Lubambe Hostel**) and `life_science_labs`. They use the placeholder. `unilus_hostel_school_of_medicine_side` is the distinct **Chipembele Hostel**, and does have photographs; these IDs must not be merged.
- The public scan checked all **51** image assets under the campus-data directory: 48 referenced JPEGs, two facility photographs and the placeholder SVG. Every response was 200 with an image content type and identical bytes to the local asset.
- Facility photographs for Botanic Bloom remain available; Botanic Bloom focuses its parent `p_c_school_of_business`, rather than creating a new canonical geometry.

The photo loader tries `.webp`, `.jpg`, `.jpeg`, `.png` in order, then the placeholder. This intentionally produces failed probes for JPEG-only media. The public library `cover.webp` returned **404**, while its actual JPEG was available. Opening a photo-less destination tries all four missing extensions before falling back. It is therefore incorrect to promise “zero failed image requests,” even though no existing referenced JPEG is missing. These fallback probes are separate from missing curated assets.

## 7. Chatbot View on Map integration

No live `/api/chat` request was sent. Instead the existing deterministic navigation service and actual frontend handlers were executed with isolated mocks. This avoids persistent conversation or ticket writes.

| Exact example | Deterministic result |
|---|---|
| Where is the UNILUS Library? | `navigation.placeId = unilus_library` |
| Show me the cafeteria on the map. | `cafeteria_school_of_medicine` |
| Where are the hostels? | **No deterministic navigation result**; plural search fails |
| Locate the UNILUS Hospital. | `unilus_hospital` |
| Where is Academic Building A? | `knowledge_field_1` |

For the four resolved examples, responses contain canonical `placeId`, name, category, finite latitude/longitude, highlight flag and geometry. `mapResponseBuilder` supplies zoom metadata; the frontend deliberately uses its own zoom 18 to match tile coverage. Silverest is supplied by the validated action or the existing single-campus fallback.

`renderActions` accepts a `campus.map` action only if its validated payload ID equals `data.navigation.placeId`. It then invokes `addMapConfirmButton`; a legacy navigation response without quick actions uses the same button path. The actual View on Map button handlers were executed for all four known examples and each called `UnilusWidget.showBuildingOnMap` with the expected `buildingId` and `campus: silverest`. The widget dispatcher was separately executed: it selected the map view, called `CampusMap.show`, opened Silverest, flew to the library and opened its matching card. A null route did not trigger route rendering.

The navigation answer currently says it has already highlighted the destination even before View on Map is clicked. That is a minor wording mismatch with the confirmation-driven UI, not proof that the map opened automatically. The actual display is triggered by the button click.

## 8. Desktop, mobile and GPS findings

Desktop uses a flex viewport with the map and building card as siblings; showing/hiding the card schedules Leaflet size invalidation. Expanded mode removes the map's width constraint. At the mobile breakpoint, the panel fills the viewport and the card becomes an overlay bottom sheet, 42% high normally and 92% with `is-full`. Grabber click and pointer-drag state transitions were executed successfully with mocks, as were marker selection and close-state transitions.

GPS is requested only after explicit actions. Mocked messages were:

- No geolocation API: `Location is unavailable in this browser.`
- Error code 1: `Location permission was denied.`
- Error code 2: `Location is unavailable.`
- Error code 3: `Location request timed out.`

An on-campus synthetic fix exercised the location marker/accuracy-circle calls and `flyTo`. The first re-center re-enables its button through the status callback. A subsequent cached on-campus recenter only calls `flyTo`, never reports status and leaves the caller's button disabled. This is a reproducible state-management defect, not a physical GPS result.

Actual geolocation permission, device accuracy, off-campus real GPS, responsive CSS rendering, sheet touch gestures, panning and zooming remain unverified. No user's precise GPS location was requested or transmitted.

## 9. Pedestrian-routing limitation

The checked-in graph has **114 nodes, 127 edges, 21 source shared roads**, **zero local walkways**, **zero access points** and **zero routable destinations**. A connected shared-road graph does not establish verified walking access to buildings.

The existing route service returns `destination_access_unmapped` (422) for library → hospital. Library → cafeteria navigation returns `route: null`, `routeStatus: destination_access_unmapped` and a destination-map payload, with no route distance/time. Existing tests also cover missing graph data, invalid/outside coordinates, unmapped entrances and disconnected paths; there is no centroid or straight-line fallback. Nearby-place distances are geodesic proximity measurements, not walking-route distances or ETA.

The frontend draws a walking line/summary only for `status: ok` and LineString geometry. Its internal-route function displays the backend's unavailable message or a service-unavailable toast. Current incomplete data must continue to produce no walking polyline or internal walking estimate.

An existing, separate **Directions in Google Maps** control opens an external Google walking-directions URL after an explicit action and location handling. This is pre-existing behaviour, not a new provider added here. It does not make the local pedestrian graph verified, and external Google routes were not tested. No Google-generated campus path should be represented as a locally surveyed route. `backend/data/campus/ROUTING.md` contains older workflow/documentation claims and is not evidence of current external-link behaviour.

## 10. Confirmed defects and minimal proposed corrections

No correction was implemented.

| ID | Finding and reproduction | Minimal proposal for a separately authorized change |
|---|---|---|
| D1 — high | `campus-map.js loadData()` catches failure and resolves cached `dataLoadPromise` to an empty data object. Two opens with a mock loader that would succeed on the second request call it only once. `CampusMap.init` eagerly requests data, so a transient production readiness 503 can affect later map opens until page refresh. | Clear the failed cached promise and retain an explicit retry path; test first-load failure followed by success. |
| D2 — medium | `initMapControls()` disables Re-center; `CampusLocation.recenter()` reports no completion on the cached on-campus branch. Two clicks with a valid mock fix leave the button disabled after the second click. | Ensure every completion path re-enables the control, including cached recenter; retain error/timeout handling. |
| D3 — medium | Public `/search?q=hostels` returns `[]`; local “Where are the hostels?” returns no deterministic navigation result. The place matcher does not normalize this plural and no generic plural alias resolves it. | Handle singular/plural hostel terms and offer the supported hostel choices when ambiguous; preserve all three canonical IDs. |
| D4 — low | `CampusSearch` increments its request counter only when the debounced fetch starts. Clearing the field hides the list but does not invalidate an already pending fetch. Releasing that response reopens one stale result under an empty input. | Invalidate requests on every input change, including clear; optionally abort old fetches; test the clear/response race. |
| D5 — minor presentation | Locate answer says “I've highlighted it” before user confirmation; map actually opens only on View on Map. | Use wording that invites the click instead of claiming completed highlighting. |
| D6 — optional network hygiene | JPEG-only covers/gallery are always probed as WebP first; absent-cover destinations probe four extensions before placeholder. One live WebP 404 was explicitly confirmed. | Use known file paths/extension metadata, and immediately select placeholder for known absent covers; do not fabricate photos. |

D1–D4 warrant correction and focused regression coverage before declaring the map ready. Existing automated tests passing does not negate these independently reproduced edge cases.

## 11. Tests run and their limits

| Suite | Result |
|---|---|
| Seven existing campus Node test files | **41/41 passed**, zero failures/skips/cancellations |
| Existing Python offline pedestrian importer tests | **7/7 passed** |
| Existing production widget test suite | **133/133 passed**, zero failures/skips/cancellations |

Commands (from the appropriate directory, using the existing runtimes):

```text
backend: node --test tests/campusDataIntegrity.test.js tests/campusFrontendContract.test.js tests/campusPhotoKnowledge.test.js tests/campusRoutingService.test.js tests/campusLocalRouting.test.js tests/campusOsmPedestrian.test.js tests/campusSurvey.test.js
backend: python -B -m unittest discover -s tests -p test_campus_osm_pedestrian.py -v
dummy-environment/chatbot-widget: node --test tests/*.test.cjs
```

The Python suite uses temporary fixtures and does not rebuild the GIS dataset. Campus photo knowledge checks were lexical-only; their expected dense-search-unavailable notices were not inference failures. The production widget bundle was inspected and served as-is; it was **not rebuilt**, preserving this read-only scope.

Additional ephemeral probes executed existing source functions in memory, without changing files: category-list counts, GPS status cases, repeated recenter, failed-load caching, stale-search completion, marker emphasis/collapse, mobile sheet state, four navigation button payloads and widget dispatch. These are not browser tests and are not included in the 41/7/133 suite counts. One initial search probe had an incomplete mock lacking `replaceChildren`; after correcting the in-memory mock, the stale-search defect reproduced. No production code was changed to make tests pass.

## 12. Unverified features and manual checklist

**Live browser:** none verified. **Local browser:** none verified. Browser console exceptions, real failed-request sequences, actual tile composition/quality, photo display/decoding, zoom/pan gestures, real permission prompts, expanded desktop layout and mobile touch/fullscreen/bottom-sheet appearance remain pending.

For the published site, the short manual checklist is:

1. Open the exact public `website.html`, open the chatbot and choose Campus map. Confirm Silverest is active, satellite imagery, boundary and named pins appear; inspect console/network for errors.
2. Search Library, Cafeteria, Hospital and Academic Building A; select results/pins and verify the correct title, photo and emphasized marker. Also check the known plural “hostels” failure and the three named hostel choices separately.
3. Open the place list and test All/Academic/Facilities/Food/Sports. Confirm these filter the list; verify photos or expected placeholders. Expect extension-probe 404s under the current image loader.
4. Zoom/pan within campus bounds, expand on desktop, and check 390px mobile fullscreen/card open/close and grabber drag/tap. Test re-center twice after allowing a location fix; separately check denial/unavailable handling.
5. For View on Map use an **already existing** navigation answer; verify its destination matches the opened card. Do not send new public chat questions or create tickets under this read-only authorization. End-to-end new public chat and external Google directions can be checked later with specific authorization if needed.
6. Reproduce the transient-data-load and cleared-search races using an owner-controlled browser network test; reload afterward. Review the proposed fixes before any deployment.

Repeat the same visual checklist against an isolated localhost candidate with its API pointing to local campus routes and synthetic navigation mocks. Serving the static candidate with its checked-in production runtime configuration alone would still call Render; it is not an isolated local backend test. The ephemeral harness in this investigation used a local runtime-config response without editing the checked-in file.

## 13. Final verdict

The live site delivers its required map dependencies, canonical place data and existing photographs, with correct public API configuration/CORS. Local data integrity, navigation payloads, frontend ID consumption and routing refusal are supported by HTTP, static and isolated-test evidence. No missing curated photo or lost campus dataset was found.

**The map requires correction before combined-release sign-off:** D1–D4 are confirmed, while real browser rendering and device GPS/touch behaviour still need visual acceptance. This report does not authorize or implement fixes. The academic commit remains unchanged, and no deployment was triggered.
