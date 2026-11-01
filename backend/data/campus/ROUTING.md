# Silverest local routing data

`campus_walkways.geojson` and `campus_access_points.json` are manually maintained source files. The checked-in walkway layer and access-point list start empty because the OSM export does not verify the real pedestrian paths or building entrances. `campus_routing_graph.json` is generated output.

## Legacy local override workflow

The instructions below describe the older browser routing editor. Its `dummy environment/routing-editor.html` file is not present in the current workspace, so use the JOSM workflow below for new mapping. The local override files remain supported for exceptional reviewed data.

1. Run the backend with `CAMPUS_ROUTING_EDITOR=true` in the environment. For example, in PowerShell from `backend`: `$env:CAMPUS_ROUTING_EDITOR='true'; npm start`.
2. Serve `dummy environment` locally and open `routing-editor.html`. For example, from `dummy environment`: `python -m http.server 8000`, then open `http://localhost:8000/routing-editor.html`.
3. Inspect the boundary, building outlines, destination markers, and amber OSM service roads. Verify each real walkway and entrance on site before tracing it.
4. Choose **Draw path**, click along a verified walkway, and finish it. A green ring indicates a snap within 3 m of an existing line or vertex. Select a path to edit its vertices or type; delete mistakes before export.
5. Choose a canonical place ID in **Entrance for**, then **Add entrance** at its verified access point. Mark the appropriate entrance primary. Multiple entrances are supported.
6. Use **Validate**. Review disconnected components, dangling endpoints, access points not on the network, duplicate IDs, invalid geometry, zero-length segments, boundary exits, and building crossings. A building crossing requires human review even if it could be a covered passage.
7. Export both files and place them in this directory as `campus_walkways.geojson` and `campus_access_points.json`. The browser downloads the files; there is no backend write endpoint.
8. Run `npm run campus:routing:build` from `backend`. Inspect the reported component count and unmapped destinations. Restart the backend to serve the new generated graph.

No external directions service is used. The satellite basemap is visual context only; it is not a path source. Do not trace a path solely from imagery without verification.

## Preferred JOSM and OSM refresh workflow

JOSM/OpenStreetMap is the mapping source. The chatbot runs only on imported local files and never calls a mapping or routing service at runtime. Keep a complete Silverest `.osm` export containing the campus boundary, all 23 canonical destination features, service roads, and reviewed paths and access nodes. The importer preserves canonical IDs from `campus_place_catalog.json`; it refuses an export missing a canonical feature.

In JOSM, open **Preferences → Remote Control** and enable Remote Control. It is off by default. The helper tests `127.0.0.1:8111/version`. To use `add-node` or `add-way`, explicitly enable JOSM's **Create new objects** Remote Control permission. To use the `export` helper, enable its **Export data from JOSM** permission (available in JOSM r19425 or later). The helper never changes permissions or uploads data. See the [official JOSM Remote Control commands](https://josm.openstreetmap.de/wiki/Help/RemoteControlCommands) and [Remote Control preferences](https://josm.openstreetmap.de/wiki/Help/Preferences/RemoteControl).

From `backend`:

```powershell
python scripts/josmSilverest.py status
python scripts/josmSilverest.py load
python scripts/josmSilverest.py zoom
python scripts/josmSilverest.py open 'data/campus/source/map(4).osm'
```

`load` invokes `/load_and_zoom` with left `28.466848`, right `28.471409`, bottom `-15.357015`, top `-15.352995`. `open` invokes `/open_file` on a local export. For a small prepared OSM XML review layer, run `python scripts/josmSilverest.py review path/to/prepared.osm` (`/load_data`). Optional `add-node` and `add-way` commands use JOSM's official object creation endpoints and require `--new-objects-enabled`; for example, `python scripts/josmSilverest.py add-node -15.355 28.469 --tag entrance=main --new-objects-enabled`. Only use these for field verified geometry and review the resulting JOSM objects. They are not an upload command.

After reviewing the complete active JOSM layer, export it locally:

```powershell
python scripts/josmSilverest.py export data/campus/source/silverest-reviewed.osm
npm run campus:update -- data/campus/source/silverest-reviewed.osm
npm run campus:routing:build
```

The helper's `export` invokes `/export`, saves the active layer, and rejects an empty response. You can also use JOSM **File → Save As** to make a complete `.osm` export. The importer stores a local snapshot at `source/silverest_latest.osm` and creates `campus_osm_service_roads.json`, `campus_osm_pedestrian.geojson`, and `campus_osm_access_points.json`; the routing build reads those files and local overrides. Review warnings, graph component count, and routable destinations before deploying the updated local graph. No distances or walking times need hand editing.

### Mapping guidance

Map only features that physically exist. Use `highway=footway` for a constructed pedestrian walkway, `highway=path` for an informal or unconstructed trail, `highway=pedestrian` for a pedestrian street or area where appropriate, and `highway=steps` for stairs. A separately mapped sidewalk is `highway=footway` with `footway=sidewalk`. Map crossings with appropriate crossing tags **and connected topology**, rather than a visually crossing disconnected line. Use `entrance=main` for a verified main building entrance and `entrance=yes` for another entrance. A facility gate may use `barrier=gate`. Do not add tags solely for the chatbot.

The importer retains mapped `highway`, `footway`, `surface`, `access`, `foot`, `wheelchair`, `lit`, `covered`, `bridge`, `tunnel`, `layer`, `incline`, and `step_count`. It associates entrances and gates with canonical places only when the point lies on the mapped parent feature boundary. Unassociated gates are reported for review. `entrance=main` is preferred over `entrance=yes`; service, private, or foot prohibited entrances are not selected as primary. Multiple entrances remain available. A mapped access node becomes routable only if it is a node on a mapped path or service road. The importer never uses a building centroid or creates a connector.

The current `map(4).osm` contains no mapped campus pedestrian ways. A dry run with the new importer reports two unassociated gate nodes and still yields zero routable destinations. No path or entrance should be fabricated to change that count. Public OSM uploads remain an explicit, reviewed user action in JOSM.
