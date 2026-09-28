# Silverest local routing data

`campus_walkways.geojson` and `campus_access_points.json` are manually maintained source files. The checked-in walkway layer and access-point list start empty because the OSM export does not verify the real pedestrian paths or building entrances. `campus_routing_graph.json` is generated output.

## Trace verified paths

1. Run the backend with `CAMPUS_ROUTING_EDITOR=true` in the environment. For example, in PowerShell from `backend`: `$env:CAMPUS_ROUTING_EDITOR='true'; npm start`.
2. Serve `dummy environment` locally and open `routing-editor.html`. For example, from `dummy environment`: `python -m http.server 8000`, then open `http://localhost:8000/routing-editor.html`.
3. Inspect the boundary, building outlines, destination markers, and amber OSM service roads. Verify each real walkway and entrance on site before tracing it.
4. Choose **Draw path**, click along a verified walkway, and finish it. A green ring indicates a snap within 3 m of an existing line or vertex. Select a path to edit its vertices or type; delete mistakes before export.
5. Choose a canonical place ID in **Entrance for**, then **Add entrance** at its verified access point. Mark the appropriate entrance primary. Multiple entrances are supported.
6. Use **Validate**. Review disconnected components, dangling endpoints, access points not on the network, duplicate IDs, invalid geometry, zero-length segments, boundary exits, and building crossings. A building crossing requires human review even if it could be a covered passage.
7. Export both files and place them in this directory as `campus_walkways.geojson` and `campus_access_points.json`. The browser downloads the files; there is no backend write endpoint.
8. Run `npm run campus:routing:build` from `backend`. Inspect the reported component count and unmapped destinations. Restart the backend to serve the new generated graph.

No external directions service is used. The satellite basemap is visual context only; it is not a path source. Do not trace a path solely from imagery without verification.
