# Silverest GPS field survey

This is a developer tool. Its map is drawn from local campus boundary, buildings, destinations and the existing service-road graph. The browser does not use an external routing service or GPS analytics.

For standalone field surveying with only an Android phone, build and install the offline app described in [android-survey/README.md](../../../../../android-survey/README.md). The USB workflow below remains available for desktop development and browser testing.

## Open on an Android phone

Connect the phone by USB with USB debugging enabled. From the project root, in one PowerShell window:

```powershell
cd backend
npm run campus:survey:serve
```

In another PowerShell window:

```powershell
adb reverse tcp:8765 tcp:8765
```

Open `http://localhost:8765/` **on the phone**. Android Chrome treats phone `localhost` as a secure context for Geolocation. The server binds only to computer localhost and exposes only the survey page and five campus data files. Keep the server window open while surveying. For a desktop trial, the same URL works on the computer. If `adb` is absent from PATH, use `C:\Users\mjluk\AppData\Local\Android\Sdk\platform-tools\adb.exe`.

The page also works from a trusted HTTPS host if USB is unavailable. Plain HTTP at the computer's LAN address generally cannot access Geolocation. Do not publish the survey page or exports to a public host.

## Record and export

Choose a walkway type, tap **Start walkway**, and walk. `watchPosition` requests high accuracy only during recording. **Pause**, **Finish**, **Cancel**, page unload, and page refresh stop the watch. After refresh, an unfinished path is restored paused. Accepted points need accuracy of ±25 m or better. Samples above that threshold, stationary samples and fast repeated samples remain in `raw_samples` with a decision, but do not enter the LineString. The live display shows reported accuracy and approximate length.

For an entrance or gate, choose a canonical place explicitly and tap the mark button. The page takes up to five fresh GPS readings and uses the median coordinate of the three most accurate. It reports best accuracy and asks for confirmation above ±15 m. Gate access is unspecified unless selected. The final save is separate from measuring.

**Export local survey JSON** downloads one package with `walkways` GeoJSON FeatureCollection, `access_points` JSON array and raw samples. Preserve this file. After exporting, use **New session after export** for another field session. Browser localStorage is interruption recovery, not a permanent backup. Nothing from the page writes production campus routing files.

## Review multiple sessions

From `backend`, run:

```powershell
npm run campus:survey:process -- "C:\path\to\survey_1.json" "C:\path\to\survey_2.json"
```

The command prints a new `backend/data/campus/source/surveys/review-...` folder. It copies every raw export and writes `processed_walkways.geojson`, `processed_access_points.json`, and `review.json`. Cleanup removes sub-0.6 m stationary duplicates, simplifies within 1.5 m, and snaps endpoints to other surveyed endpoints within 2 m. It reports campus exits, building crossings, poor GPS, nearby junctions, and overlapping repeats. It does not erase overlapping paths, average parallel paths, route around buildings, or silently resolve disagreements. Review coordinates against the raw traces and field notes; edit processed files only when you have field evidence.

Open `http://localhost:8765/dummy-environment/campus-survey-review.html` on the computer while the survey server is running. Select the files from the review folder. Orange is raw trace, blue is processed geometry, and purple is an access point. Read `review.json` warnings alongside the map.

## Deliberate production promotion

After examining all warnings and correcting approved geometry, change `review.json` `status` from `pending` to `approved`. Then, from `backend`, run:

```powershell
npm run campus:survey:promote -- "C:\full\path\to\review-folder" --approve
npm run campus:routing:build
```

Promotion validates place IDs and production source structure, makes timestamped backups of the two production source files, and merges the approved features. It does not run automatically during survey or processing. The graph rebuild is a separate explicit step. Review the rebuild's warnings, connected components, and routable destinations. An access point is not guaranteed routable merely because it was surveyed; it must connect to the graph.

The original raw files and processor output remain under the review folder. Do not process the same session twice in a single review batch. Do not promote the same approved review folder twice; IDs would collide and validation would reject it.
