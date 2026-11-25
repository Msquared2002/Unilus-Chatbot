# Exact reviewed Git release inventory

Integration base 123e338b3c79860ee518a4cb270e3e94e93a860d. Apply the following path list to the existing tracked source. Use the accepted v5 internal PACKAGE_MANIFEST.json as the 610-file submission baseline, updated with the six post-v5 payloads listed in the final preflight and the current reports.

## Modified tracked paths

- backend/data/advisor/catalogue-evidence.json
- backend/routes/campusRoutes.js
- backend/routes/chatRoutes.js
- backend/routes/demoAcademicRoutes.js
- backend/services/academicContextService.js
- backend/services/aiService.js
- backend/services/authService.js
- backend/services/chatService.js
- backend/services/companionConversationService.js
- backend/services/demoAcademicChatService.js
- backend/services/demoAcademicService.js
- backend/services/navigationService.js
- backend/services/personalAcademicService.js
- backend/services/queryUnderstandingService.js
- backend/services/retrievalRouter.js
- backend/services/tuitionFeeService.js
- backend/tests/chatOrchestrationRepair.test.js
- backend/tests/demoAcademic.test.js
- backend/tests/personalAcademic.test.js
- backend/tests/tuitionFeeService.test.js
- dummy-environment/chatbot-widget/answer-tools.js
- dummy-environment/chatbot-widget/app.js
- dummy-environment/chatbot-widget/campus-data-client.js
- dummy-environment/chatbot-widget/campus-map.js
- dummy-environment/chatbot-widget/campus-search.js
- dummy-environment/chatbot-widget/dist/chatbot-widget.js
- dummy-environment/chatbot-widget/tests/chat-actions.test.cjs
- dummy-environment/chatbot-widget/voice.js
- dummy-environment/chatbot-widget/widget.css
- dummy-environment/chatbot-widget/widget.js
- dummy-environment/js/demo-academics.js
- dummy-environment/js/demo-session.js
- dummy-environment/portal.html

## Reviewed new paths

- backend/data/campus/additional-campuses.json
- backend/data/campus/source/additional/leopards_hill_campus.osm
- backend/data/campus/source/additional/pioneer_campus.osm
- backend/scripts/auditReasoningCoverage.js
- backend/scripts/benchmarkReasoningQuality.js
- backend/scripts/importAdditionalCampuses.py
- backend/scripts/startIsolatedLocalTest.cjs
- backend/services/additionalCampusService.js
- backend/services/responsePresentationService.js
- backend/services/scheduleIntervals.js
- backend/services/scheduleReasoningService.js
- backend/services/timetableQueryContext.js
- backend/tests/intelligenceUx.test.js
- backend/tests/multiCampus.test.js
- backend/tests/scheduleCapabilitySecurity.test.js
- backend/tests/scheduleReasoning.test.js
- docs/final-submission/ACCEPTANCE_RESULTS.md
- docs/final-submission/BROWSER_REPAIR_ACCEPTANCE.md
- docs/final-submission/CAMPUS_INTEGRATION_REPORT.md
- docs/final-submission/CLEAN_EXTRACTION_RESULTS.md
- docs/final-submission/FINAL_RELEASE_PLAN.md
- docs/final-submission/IMPLEMENTATION_REPORT.md
- docs/final-submission/LIVE_AI_EVALUATION.md
- docs/final-submission/PACKAGE_INVENTORY.md
- docs/final-submission/RELEASE_FILE_INVENTORY.md
- docs/final-submission/TECHNICAL_EVIDENCE.md
- docs/final-submission/VOICE_MANUAL_TESTS.md
- docs/intelligence-ux/before.json
- dummy-environment/chatbot-widget/tests/voice-controls.test.cjs
- README.md
- scripts/evaluate-live-ai.cjs
- scripts/isolated-preview.cjs
- scripts/package_submission.py

## Hosted build inputs and submission-only data

- Preserve tracked Dockerfile, .dockerignore, render.yaml, netlify.toml, both package lockfiles, migrations 001 through 007, the timetable and search index, the catalogue, all three campus datasets, and the complete built widget and avatar assets.
- Existing production knowledge, persisted profiles and Storage objects remain on their current durable backends. No data publication, ingestion, bootstrap or migration is part of this routing release.
- Include ignored backend/data/documents/chunks.json and backend/data/vectors/knowledge_vectors.json in the submission ZIP through the explicit allowlist. Do not stage these large local retrieval snapshots for hosted release.
- Exclude private environment and auth files, credential or provider traces, local databases, private backups, uploads and unrelated audit output.
