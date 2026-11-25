# UNILUS AI Student Companion

A university information and student support prototype. It brings programme guidance, schedules, campus directories and support workflows into one conversational interface. The project addresses the time students spend finding information across documents, timetables and campus offices.

Guests can ask general questions and explore campus maps. Signed-in demonstration students can ask about their own fictional academic records and timetables, manage reminders and view notifications. Staff tools handle routed support requests and approved knowledge updates according to role. The widget also offers Sources, feedback, PDF export, avatar customization and browser-native speech where available.

## Architecture

The browser widget uses JavaScript, Vite and Leaflet. Express serves authenticated routes and a routing layer that combines deterministic timetable operations, the Programme Advisor, university document retrieval and optional Groq inference. SQLite supports local evaluation. The hosted architecture uses PostgreSQL, durable vector records and private object storage. Node 24 is required. Python 3 is needed only for offline data preparation such as the OSM importer.

- `backend/` contains APIs, services, migrations, tests and runtime data.
- `dummy-environment/` contains the demonstration site, portal and widget.
- `docs/final-submission/` records acceptance, packaging and deployment decisions.
- `netlify.toml`, `Dockerfile` and `render.yaml` describe release builds.

## Run locally

From the extracted project root with Node 24 and npm installed:

```powershell
npm --prefix backend ci --include=dev
npm --prefix dummy-environment/chatbot-widget ci --include=dev
npm --prefix dummy-environment/chatbot-widget run build
node scripts/isolated-preview.cjs
```

The preview prints local guest, fixed-student and flexible-student URLs. It uses synthetic sign-in, in-memory SQLite and temporary profiles. Keep the process running during the review. Press Ctrl+C to stop it. The preview defaults to frontend port 8081 and backend port 5001. Set `UNILUS_PREVIEW_WEB_PORT` and `UNILUS_PREVIEW_API_PORT` to available ports when needed. General Groq generation is disabled in this mode. Structured services and local data can be evaluated independently.

For ordinary AI-enabled development, review `backend/.env.example`, supply your own private development settings and start with `npm --prefix backend start`. Use a separate local database and a static frontend configured to that backend. Never re-use hosted secrets for an evaluation copy. Production startup requires a configured database and private deployment resources. A lecturer does not need them for isolated review.

The JSON vector snapshot is needed for local retrieval. The document chunks support data maintenance and catalogue reproduction. The candidate package includes these runtime inputs where the packaging scan passes. Treat third-party documents and photos according to their original terms. The package does not grant additional redistribution rights.

## Using the demonstration

Open the guest or student URL printed by the preview, then open the chat launcher. Ask a natural question such as “What’s my longest break on Monday?” or “Where is Room 19 at Pioneer?” Use the map’s campus buttons, search and directory floor selector. Building anchors approximate the area of a facility. Unknown indoor locations appear in the directory. Use the microphone on a supported browser, review its transcription, and send normally. **Listen** reads an answer and toggles to **Stop** during playback.

The hosted demonstration is available at [Guest website](https://unilus-demo.netlify.app/website.html) and [Student portal](https://unilus-demo.netlify.app/portal.html). See the release plan for version alignment. Use the separately provided lecturer credentials for the hosted site. Staff workflows require the appropriate authorized role.

## Testing and data

Run `npm --prefix backend test`, then run `node --test tests/*.test.cjs` from the widget directory. See `docs/final-submission/ACCEPTANCE_RESULTS.md` for observed results and outstanding checks.

The campus data combines local Silverest survey materials, OpenStreetMap geometry and verified directory information from the project handoff and university sources. © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. Silverest contains richer mapping coverage. Leopards Hill's Old and New Buildings are directory labels awaiting physical footprint identification. Pedestrian and indoor navigation remain limited. Most programmes lack simulated curricula. Speech depends on browser and OS support. Academic records in the demo are fictional.

Contributor names and responsibilities should be confirmed by the project group before submission. University references include the [UNILUS prospectus and site](https://web.unilus.ac.zm/) and retained official timetables. Review campus photography and university document redistribution permissions before public distribution.


## Package a candidate

From an integration Git checkout, run `python scripts/package_submission.py ../UNILUS-Student-Companion-submission-candidate.zip`. Extract the archive into a new directory and follow the local setup above. The archive includes a file manifest. See the final-submission reports for acceptance status.


### Existing frontend on port 8080

If port 5000 is free, use this PowerShell session from the project root. Set a new local-only password of 12 or more characters, then sign in through the frontend as `demo` or `student` using that password. Check `http://127.0.0.1:5000/__local-test/status` for isolated-local-test mode before testing writes. Leave any pre-existing listener untouched and use the separate review preview if the port is occupied.

```powershell
$localPassword = Read-Host 'New local-only test password' -AsSecureString
try {
    $env:UNILUS_LOCAL_TEST_PASSWORD = [System.Net.NetworkCredential]::new('', $localPassword).Password
    node backend/scripts/startIsolatedLocalTest.cjs --port=5000
} finally {
    Remove-Item Env:UNILUS_LOCAL_TEST_PASSWORD -ErrorAction SilentlyContinue
    $localPassword.Dispose()
}
```
