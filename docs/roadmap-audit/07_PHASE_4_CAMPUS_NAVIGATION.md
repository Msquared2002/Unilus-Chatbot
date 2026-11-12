# Phase 4 — verified campus walking navigation

Audit: **2026-11-10, Africa/Lusaka**. Local HEAD `9cbdeb0517da8820b94a623d9b8facbef50ae1ee`, branch `codex/production-integration`, **with pre-existing uncommitted unified-notification work**. Source findings describe that working tree unless explicitly marked production. Documentation only; no implementation/release authorized. [Master](00_MASTER_AUDIT.md) · [Evidence freshness](14_DECISIONS_AND_ASSUMPTIONS.md)

**BLOCKED BY EXTERNAL DEPENDENCIES** for reliable routes. Campus has23 named places/37 buildings, boundary/search/catalogue/facilities/photos. Graph114 nodes/127 edges uses21 shared roads,0 local walkways,0 verified accesspoints; all23 destinations lack valid access. Connected roads do not establish pedestrian entrances.

## Implementation contract

| Required item | Proposed work, not implemented in audit |
|---|---|
| 1 Reuse | campusRepository/campusRoutingService; campus-map/location/search/data-client; buildCampusRoutingGraph/updateCampusOsm/survey processor tools |
| 2 Modify | Surveyed campus_walkways.geojson/accesspoints and validated graph outputs; only needed route animation/error UI |
| 3 New modules | Survey validation fixtures, small animation helper if necessary; no replacement map/router |
| 4 Existing tables | None needed; versioned GIS authority; no GPS history storage |
| 5 Proposed migrations | None for verified static walking graph |
| 6 Frontend | Preserve Leaflet/base imagery, boundary, markers/photo cards, selected emphasis, GPS denial/errors, recenter and mobile sheet |
| 7 Backend | Use verified pedestrian/access edges only; geometry distance and qualified estimated time; retain fail-closed statuses |
| 8 External | Physical path/entrance/gate/crossing/stair/accessibility/restriction survey and provenance |
| 9 Security | No GPS retention; finite/on-campus validation; private/foot=no exclusions; no unverified accessibility claims |
| 10 Acceptance | Every supported destination has verified connected allowed entrance; accurate geometry and graceful no-route |
| 11 Existing tests | campusLocalRouting, campusSurvey, widget campus-regressions and route validation tests |
| 12 New tests | Entrances/disconnections/restrictions, outside GPS/snap threshold, distance, animation/mobile/GPS-denied and physical walkthrough |
| 13 Risks | routing_graph_unavailable, destination_access_unmapped/start_access_unmapped, PEDESTRIAN_NETWORK_REQUIRED are real capability limits |
| 14 Order | Survey→provenance/access validation→graph build→route tests→local browser/GPS mocks→physical walk→reviewed release |
| 15 Complexity | High, physical verification dominates |

## Acceptance scenarios
- Library/cafeteria/hostels/hospital/Academic Building A resolve supported canonical data or clarify; no invented mapping.
- Missing route still selects place/map without fabricated distance/minutes.
- Photo cards/zoom/pan/recenter/mobile remain intact. Fresh browser/GPS/photo HTTP crawl was not performed in this audit.

Cloud migrations/releases need separate concrete authorization. [Release gates](12_TESTING_AND_RELEASE_STRATEGY.md).
