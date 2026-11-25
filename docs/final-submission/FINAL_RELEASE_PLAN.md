# Final release preflight

## Fee-help correction and v5 delta

Fee-help and Accounts contact questions now use the existing Support Centre finance department and give a Sources entry. They neither prepare nor submit a ticket. Explicit escalation goes through the existing consent workflow. Tuition calculations, payment procedures, financial aid information and campus directions retain separate routes. Payment instructions and campus locations bypass tuition clarification. No phone number, email address, fee policy or financial aid eligibility was added.

The exact non-documentation payload differences against the owner-accepted v5 archive are:

- backend/services/chatService.js — run fee-help guidance before tuition calculation, after explicit support.
- backend/services/tuitionFeeService.js — classify informational assistance and preserve other fee-related routes.
- backend/services/companionConversationService.js — previous accommodation intent fix to reach institutional retrieval.
- backend/tests/chatOrchestrationRepair.test.js — accommodation and fee-help orchestration regressions.
- backend/tests/tuitionFeeService.test.js — distinct calculation/payment/aid/campus intent regression.
- scripts/evaluate-live-ai.cjs — previous SDK base-URL correction to prevent duplication of the API path.

Archived map, voice, widget, wardrobe, authentication and academic profile payloads matched the working tree byte for byte. The v5 archive checksum remained 74B5A2D373E9992BAC89686B860026AFE0AC65C9032D05DF8D1406A344216237. See RELEASE_FILE_INVENTORY.md for the full delta from the integration Git base, including the earlier approved changes.

## Verified production state

| Resource | Live | Retained previous candidate |
|---|---|---|
| Render | dep-dbqnde3tqb8s73f6hd70, 123e338b3c79860ee518a4cb270e3e94e93a860d | dep-dbqkqhl6e07s73fh4rj0, c5767a671928717994cb2850c81e07388ed1a0b3 |
| Netlify | 6af5766057b063edca538491, ready and published | 6af54cf03c96bf470cff466d, ready and retained |

Render is one Free instance on codex/production-integration, auto-deploy disabled. Public /readyz returned 200. Required database TLS, JWT, auth mount, inference, private storage, CORS and academic identity variables were present. Runtime vectors use the durable database. No migration or test overrides were present. Netlify has a connected integration branch with builds stopped. It uses the established manual publication process. The public runtime configuration returned 200 and points to https://unilus-chatbot-free-demo.onrender.com/api. Provider metadata has no Git SHA for either manual upload. The handoff associates the live upload with 123e338b3c79860ee518a4cb270e3e94e93a860d. Its public widget bundle matched that commit byte for byte, and widget CSS matched with normalized line endings. The published HTML differs from Git, including clean URL rewriting and host-injected markup. This is partial corroboration, not a provider commit assertion.

The actual Supabase ledger contains exactly migrations 001–007, with no extra entries or checksum differences. Verified required application tables and row-level security, core schema and constraint contracts, restricted runtime role, and extended table grants. The database checks used TLS and explicit read-only transactions and rolled back. No migration or knowledge bootstrap is required for these routing changes. Keep the existing production durable catalogue and object storage. The historical encrypted recovery backup passed checksum verification. The established isolated restore procedure and Windows DPAPI dependency are documented in the production handoff. No restore was performed. The previously deferred historical recovery is separate from this release.

The live signing value matched the established private configuration in memory. The existing auth mount path was confirmed. The two configured academic identities matched local hashed student records, and the fixed identity was one of them. The private mounted file bytes could not be compared through the authorized provider metadata. No hosted login was performed.

## Execution only after separate owner authorization

1. Review RELEASE_FILE_INVENTORY.md and the current diff. Fetch origin after authorization, confirm the integration branch relationship to the live source and stop on divergence. Stage only reviewed paths from the inventory. Check staged paths and secret scan, commit the reviewed branch and push it to origin/codex/production-integration without force or merge. Record the new exact SHA.
2. Use the existing manual Render service deploy for that commit. Leave all environment settings, auth files and credentials unchanged. Do not run migrations, role provisioning, data seed or durable knowledge bootstrap. Wait for the new deploy to be live and /readyz to return 200.
3. Generate the frontend runtime configuration using the existing Render HTTPS endpoint. Build the Node 24 frontend from the same approved SHA using netlify.toml and the lockfile. Upload the built dummy-environment output as an unpublished manual deploy, review its artifact and API target, and publish that deploy. Record its ID, approved source SHA and artifact checksum locally because manual upload metadata can omit the commit SHA.
4. Verify Guest Mode, all campus maps, floor filters, and sourced fee help, accommodation and official knowledge. Verify signed-in academic ownership, the fixed profile and flexible programme selection, wardrobe gates, timetable-to-map action and voice controls. With separate login authorization, the owner can privately use the two credentials already given to the lecturer, confirm both existing identities and fixed/flexible profile behavior, then sign out. Keep passwords out of chat, screenshots and reports. Use a separately approved synthetic account for stateful hosted checks.
5. Roll back if readiness, auth or critical workflows fail. First disable the failing rollout by restoring the pre-release Netlify deploy 6af5766057b063edca538491, then restore Render deploy dep-dbqnde3tqb8s73f6hd70 for 123e338b3c79860ee518a4cb270e3e94e93a860d and verify the pair. If already unhealthy before release, the retained earlier pair is Netlify 6af54cf03c96bf470cff466d and Render dep-dbqkqhl6e07s73fh4rj0. Do not restore any database or credential material during an application rollback.

## Submission

Keep candidate v5 unchanged. After release approval, regenerate the source ZIP from the exact reviewed snapshot using scripts/package_submission.py. This includes the six changed payloads above, README, the rebuilt widget, campus and timetable datasets, and local retrieval chunks and vectors. Verify the archive manifest, checksum, fresh install, build and isolated startup. Use the project name and owner-confirmed student names for the ZIP filename. The academic PDF remains a separate deliverable and was not revised in this phase.

## Validation and recommendation

READY FOR RELEASE APPROVAL. The fee-focused suites passed 43 of 43, the full backend suite passed 613 of 613 on the repeat run, the widget suite passed 187 of 187, all 319 syntax checks passed, and the production widget build and Git diff check passed. The first full backend run received one 503 during programme selection. That suite passed 14 of 14 in isolation, and the repeated full run passed. No programme assertion was weakened.

The owner still controls release authorization, private lecturer login verification and the confirmed student names for the submission filename. The Netlify manual deploys expose deploy IDs but no provider-confirmed source SHA. Record the commit and artifact checksums for the next upload.
