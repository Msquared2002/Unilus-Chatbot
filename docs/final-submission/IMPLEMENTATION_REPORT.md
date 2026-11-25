# Implementation report

The integration branch is codex/production-integration, based on 123e338b3c79860ee518a4cb270e3e94e93a860d. The working tree preserves earlier retrieval, academic and presentation changes. This increment adds the offline OSM importer, scoped campus API and directory search, Leaflet layers and floor controls, verified-anchor chat actions, speech lifecycle handling, the isolated preview and submission tooling.

Academic and timetabling records remain authoritative for course and venue assignments. The directory enriches location answers and supplies map actions for matching venue codes with a mapped anchor. The import does not write academic or timetable records. The preview creates temporary synthetic auth and profile records. Existing hosted identities, fixed-account behavior, flexible programme catalogue and wardrobe entitlements remain in their established code paths.

Review exact current file paths with git status --short and git diff --name-status in the integration checkout. There were no release or migration operations.
