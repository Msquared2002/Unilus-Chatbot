# UNILUS K0 demonstration deployment

Target: existing Supabase qhnspcstqvazxkqshuir, Render Free backend, existing https://unilus-demo.netlify.app frontend. Do not rerun migrations, role provisioning, bucket creation or knowledge bootstrap. Public deployment and Git push still require owner authorization. The local branch is codex/production-integration, descended from the existing Group Studio merge; never replace/force-push main.

## Private demonstration configuration

Owner-controlled files outside the repository:

- C:\UNILUS-secrets\hosting.env: complete server environment, restricted unilus_backend Session pooler5432, CA path, Storage/Groq secrets, stable JWT, exact Netlify CORS origin. No migration credentials.
- C:\UNILUS-secrets\demo-users.json: three stable student/Academic Office staff/admin profiles with scrypt password hashes.
- C:\UNILUS-secrets\demo-access.env: owner-retrievable demo sign-in details. Never publish, paste into chat, commit or give administrator credentials to public visitors.
- C:\UNILUS-secrets\demo-jwt-secret.txt: stable server JWT material; already present in hosting.env. Keep private.
- C:\UNILUS-secrets\supabase-ca.crt: trusted database certificate.

Private files have owner/SYSTEM/Administrators-only ACLs. Authentication remains file/JWT based. The image excludes bundled demo users; the host must mount the intended user file. Supabase persists conversations/tickets/documents/knowledge; local upload files are a rehydratable cache. Applicant grades remain temporary. Password/user-file changes require reviewed updates to the host secret file, not local ephemeral edits on Render.

## Exact authorized deployment sequence

1. Review the prepared local commit and final secret scan. On owner approval, push **codex/production-integration** to its existing origin. Do not merge into or force-push main. The checkout is shallow; the new commit retains the original Group Studio merge as its parent, and does not rewrite remote history.
2. In Render, create one **Free** Docker web service from that branch and repository root, using Dockerfile/render.yaml in Frankfurt, near the existing Supabase eu-central-1 project. Leave automatic deployment disabled. Do not add a database, disk, paid compute or additional Supabase project.
3. Import server values privately from hosting.env into Render's environment. Do not copy these values to Netlify. DATABASE_CA_FILE must be `/etc/secrets/supabase-ca.crt`; AUTH_USERS_FILE must be `/etc/secrets/demo-users.json`. Upload the corresponding CA and hashed user JSON as Render secret files with those filenames. Set AUTH_JWT_SECRET to the stable prepared value; keep DATABASE_URL restricted and separate from privileged operations configuration. Render supplies PORT; the server honors it and listens on all interfaces.
4. Set health check `/readyz`. `/healthz` can respond while initialization runs; API requests return retryable503 until readiness. Initialization emits sanitized stage/time/RSS/error-code logs and exits on failure. Initial DB connection timeout is bounded at20 seconds; only one retry is allowed for recognized transient connection failures. TLS/authentication/permission failures are not retried. MiniLM is bundled during image build. The bounded corpus/lexical snapshot warms before readiness.
5. After Render assigns the actual HTTPS hostname, verify `/healthz` and `/readyz`, private login, role/department restrictions and a bounded RAG/timetable/campus request. Record the actual hostname; none is invented in source.
6. Only after owner approval to modify the live Netlify site, select the reviewed integration branch/commit for the existing site. Set **PUBLIC_API_BASE=https://<actual-render-host>/api**. Keep all server/database/Storage/Groq/JWT secrets off Netlify. Build command and publish directory are already in netlify.toml. The build generates js/runtime-config.js before the widget bundle; it rejects invalid/credential-bearing production API URLs.
7. Backend CORS_ORIGINS is exactly **https://unilus-demo.netlify.app**, without trailing slash/wildcards. Add other exact origins only if explicitly needed/reviewed. HTTPS is required. Test Guest Mode, Student Mode, timetable, map assets/photos, avatar/outfits, mobile, focus, slow wake-up and failure/retry against the actual published site. Do not claim those hosted browser checks passed from local unit tests.
8. Test a deliberate Render restart/idle wake-up and persistent Supabase state. Render's filesystem is ephemeral; do not add a paid disk. Keep demonstration traffic bounded within Supabase/Groq Free quotas. No paid upgrade is authorized.

## Performance and reliability evidence

The previous ~45-second retrieval was reproduced at ~53 seconds. PostgreSQL execution was about1ms; two14.45MB transfers and repeated parsing dominated the initial path. Request-scoped reuse removes duplicate dense reads. A32MiB raw-payload-bounded snapshot checks an exact database content revision before reuse, coalesces concurrent loads, bypasses cache inside transactions and invalidates after mutation. Cold corpus loads use200-row keyset pages in a consistent read-only snapshot, avoiding the existing30-second statement timeout without changing database policies. Other-process changes are detected by the next revision check. Weakly held lexical term counts avoid repeated tokenization; BM25 weights/filtered IDF, embeddings, semantic scores, fusion and access filters are unchanged. No user answers or grades are cached.

Interim constrained results: warm retrieval improved from53s to14–16s after eliminating payload rereads, then7.5–8.2s after lexical preparation. Rankings matched exactly. Warm requests transferred no corpus payload; they still perform a small revision query scanning payload hashes on PostgreSQL. Snapshot warm-up moves the initial load into startup; cold wake-up remains slower. A0.1CPU local simulation is not a provider latency guarantee. Full acceptance results, cold-start outcomes and memory measurements are recorded in the owner's local verification reports; they are deliberately excluded from deployment commits.

Local regression at preparation: backend273/273, production widget126/126, Vite build passed. Combined widget/prototype discovery is136/137, with only the separate3D prototype's legacy apply.html baseline-hash guard failing; it remains unchanged. Final counts/results must be read from the execution report if subsequent changes are made. No expected results were weakened.

## Demonstration boundaries

The owner explicitly deferred further backup/recovery work until after the demonstration, accepts Windows DPAPI/machine dependence, and instructed preservation of existing backups. Independent off-machine recovery is **not complete**; this is not a rollout for real student operational data. Do not restart that work under this preparation task.

This stage prepares a demonstration reachable when the laptop is off. The private configuration must be installed on Render; running local Docker alone is not public hosting. Push, Render deployment and live Netlify changes remain the final owner authorization boundary. No such remote publishing action has occurred during preparation.

### Final acceptance evidence

Three consecutive bounded Linux starts reached readiness in67,57,65 seconds with no OOM/retries. An additional fixed-port Advisor check reached readiness in56 seconds and returned the guided answer in1.299s. The earlier extra dynamic-port readiness probe timed out despite successful initialization-stage logs; it was preserved as a harness/transport limitation, not counted as an application success.

Full constrained chat: first/repeated RAG17.196/17.101s; two simultaneous guest/authenticated RAG requests30.058/15.161s; timetable1.540s; campus1.001s. Each RAG response had8 sources and no AI-unavailable fallback. The generic programme-choice phrase initially fell through to26s RAG; the small intent alias now routes to the guided Advisor. Stable student/staff/admin logins and JWT reuse across process restarts passed. All original records/fingerprints were preserved; demonstration additions are inventoried locally.

Recorded peak retrieval RSS was204460KiB (~200MiB), maximum logged startup RSS231661568 bytes (~221MiB). No OOM occurred with512MiB caps. These bounded samples show no monotonic snapshot growth; they are not a long-duration production load guarantee.

SQL measured current database size24041139 bytes using unilus_backend. Account-wide Render/Netlify/Groq remaining quotas were not accessible here. Before authorized deployment confirm Free compute, available included hours/bandwidth/build minutes, and no enabled spending/overage path; do not add a payment method or paid resource. Render Free sleeps after15 idle minutes and has750 shared free instance hours/month; exceeding included bandwidth/build usage can bill accounts with payment methods. See [Free limitations](https://render.com/docs/free), [health-check window](https://render.com/docs/health-checks), [secret-file paths](https://render.com/docs/configure-environment-variables) and [regions](https://render.com/docs/regions).

Hosted browser/mobile/avatar/outfit/focus/real wake-up checks remain deployment-stage verification. No live Netlify changes, Git push or public Render service have occurred in preparation. Owner authorization for those publishing operations is the remaining execution boundary.

Provider-only bounded probe: query planning1.006s (three rewritten searches), generation0.416s using approved public context. These host-side provider timings are not substituted for the full constrained HTTP measurements above. The final Advisor API check confirmed isProgrammeAdvisor=true and returned no unrelated RAG sources.
