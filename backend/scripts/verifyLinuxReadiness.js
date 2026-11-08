// Local Docker only. No image push/deployment; PostgreSQL forced read-only.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFile } = require('node:child_process'), { promisify } = require('node:util');
const exec = promisify(execFile);
async function docker(args) { return (await exec('docker', args, { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 })).stdout.trim(); }
async function main() {
 const repo = path.resolve(__dirname, '../..'), envFile = 'C:/UNILUS-secrets/linux-test-20261108.env';
 const reuse = process.argv.includes('--reuse-private-env');
 if (fs.statSync(envFile).size && !reuse) throw Error('Prepared empty private file required');
 const env = require('dotenv').parse(fs.readFileSync(reuse ? envFile : 'C:/UNILUS-secrets/runtime.env'));
 const cloud = JSON.parse(fs.readFileSync(path.join(repo, 'deployment/cloud-application-latest.json')));
 const report = JSON.parse(fs.readFileSync(path.join(repo, 'deployment', cloud.report)));
 if (!reuse) {
 const url = new URL(env.DATABASE_URL); url.searchParams.set('options', '-c default_transaction_read_only=on');
 Object.assign(env, { DATABASE_URL: url.toString(), DATABASE_CA_FILE: '/run/secrets/supabase-ca.crt',
  NODE_ENV: 'production', VECTOR_BACKEND: 'database', WARM_MODEL_ON_START: 'yes', PORT: '10000',
  AUTH_USERS_FILE: '/run/secrets/users.json', AUTH_JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  CORS_ORIGINS: 'https://unilus-demo.invalid', TONE_REWRITE: 'off', QUERY_PLANNER: 'off' });
 env.GROQ_API_KEY = require('dotenv').parse(fs.readFileSync('C:/Users/mjluk/Desktop/FYP/UnilusChatBot/backend/.env')).GROQ_API_KEY;
 fs.writeFileSync(envFile, Object.entries(env).map(([k,v]) => k + '=' + v).join('\n') + '\n');
 }
 const target = new URL(env.DATABASE_URL);
 if (decodeURIComponent(target.username) !== 'unilus_backend.qhnspcstqvazxkqshuir' || target.port !== '5432' || !target.hostname.endsWith('.pooler.supabase.com') || target.searchParams.get('options') !== '-c default_transaction_read_only=on') throw Error('Read-only restricted target required');
 const name = 'unilus-k0-local-' + crypto.randomUUID(); let created = false;
 const result = { localOnly: true, image: 'unilus-integration:local', memoryLimitBytes: 536870912, cpuLimit: 0.1,
  databaseForcedReadOnly: true, runtimeRole: 'unilus_backend', deployed: false };
 try {
  await docker(['run', '--detach', '--name', name, '--memory=512m', '--cpus=0.1', '--env-file', envFile,
   '--mount', 'type=bind,source=C:/UNILUS-secrets/supabase-ca.crt,target=/run/secrets/supabase-ca.crt,readonly',
   '--mount', 'type=bind,source=' + report.syntheticUsersFile + ',target=/run/secrets/users.json,readonly',
   '--publish', '127.0.0.1::10000', 'unilus-integration:local']); created = true;
  const binding = await docker(['port', name, '10000/tcp']), port = Number(binding.split(':').at(-1));
  const base = 'http://127.0.0.1:' + port, started = Date.now(); let ready = false;
  for (let i = 0; i < 120; i++) {
   try { ready = (await fetch(base + '/readyz', { signal: AbortSignal.timeout(2000) })).ok; } catch {}
   if (ready) break;
   const running = await docker(['inspect', '--format', '{{.State.Running}}', name]);
   if (running !== 'true') break;
   if (i % 10 === 0) console.log(JSON.stringify({ linuxReadinessPending: true, elapsedSeconds: Math.round((Date.now() - started) / 1000) }));
   await new Promise(r => setTimeout(r, 3000));
  }
  result.ready = ready; result.startupSeconds = Math.round((Date.now() - started) / 1000);
  result.oomKilled = (await docker(['inspect', '--format', '{{.State.OOMKilled}}', name])) === 'true';
  if (ready) {
   result.stats = JSON.parse(await docker(['stats', '--no-stream', '--format', '{{json .}}', name]));
   const allowed = await fetch(base + '/healthz', { headers: { Origin: env.CORS_ORIGINS } });
   const denied = await fetch(base + '/healthz', { headers: { Origin: 'https://unapproved.invalid' } });
   result.allowedCorsOrigin = allowed.status === 200 && allowed.headers.get('access-control-allow-origin') === env.CORS_ORIGINS;
   result.unapprovedCorsOriginRejected = denied.status === 403;
  }
  fs.writeFileSync(path.join(repo, 'deployment/linux-runtime-2026-11-08.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (!ready || !result.allowedCorsOrigin || !result.unapprovedCorsOriginRejected) process.exitCode = 1;
 } finally { if (created) await docker(['rm', '--force', name]); }
}
main().catch(() => { console.error(JSON.stringify({ event: 'linux_readiness_verification_failed' })); process.exitCode = 1; });
