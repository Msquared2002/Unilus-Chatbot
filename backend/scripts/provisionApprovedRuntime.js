// Explicitly authorized operator action. Never imported by the application.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { Client } = require('pg');
const { configuration, PROJECT } = require('../services/postgresOperations');
const { sha256 } = require('../services/logicalBackup');
async function main() {
  if (process.env.APPROVED_RUNTIME_PROVISION !== PROJECT) throw Error('EXPLICIT_ROLE_APPROVAL_REQUIRED');
  const repo = path.resolve(__dirname, '../..'), inventory = JSON.parse(fs.readFileSync(path.join(repo, 'deployment/preparation-files-2026-11-08.json')));
  if (inventory.sourceFiles.some(f => sha256(fs.readFileSync(path.join(repo, f.path))) !== f.sha256)) throw Error('REVIEWED_FILES_CHANGED');
  const preflight = JSON.parse(fs.readFileSync(path.join(repo, 'deployment/execution-preflight-2026-11-08.json')));
  if (preflight.project !== PROJECT || Date.now() - Date.parse(preflight.capturedAt) > 10 * 60000 || !preflight.backupCountsFingerprintsAndSchemaMatched || preflight.active_other_sessions || preflight.conflicting_table_locks) throw Error('FRESH_PREFLIGHT_REQUIRED');
  const target = 'C:/UNILUS-secrets/runtime.env';
  if (fs.statSync(target).size !== 0) throw Error('RUNTIME_FILE_MUST_BE_PREPARED_EMPTY_WITH_PRIVATE_ACL');
  const { options } = configuration('C:/UNILUS-secrets/migration.env', { migration: true });
  const url = new URL(options.connectionString), password = crypto.randomBytes(32).toString('hex');
  if (password === decodeURIComponent(url.password)) throw Error('DISTINCT_PASSWORD_REQUIRED');
  url.username = 'unilus_backend.' + PROJECT; url.password = password;
  fs.writeFileSync(target, 'DATABASE_URL=' + url.toString() + '\nDATABASE_CA_FILE=C:/UNILUS-secrets/supabase-ca.crt\nDATABASE_POOL_MAX=2\nNODE_ENV=production\n');
  const client = new Client(options);
  let provisioned = false, loginConfigured = false;
  try {
    await client.connect();
    await client.query(fs.readFileSync(path.join(repo, 'deployment/provision-runtime-role.sql'), 'utf8'));
    provisioned = true;
    // Password is generated hex, not user text; never logged or included in errors.
    await client.query("ALTER ROLE unilus_backend LOGIN PASSWORD '" + password + "'");
    loginConfigured = true;
    const role = (await client.query("SELECT rolname,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit,rolcanlogin FROM pg_roles WHERE rolname='unilus_backend'")).rows[0];
    if (!role || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole || role.rolinherit || !role.rolcanlogin) throw Error('ROLE_SECURITY_CHECK_FAILED');
    const result = { project: PROJECT, provisioned, loginConfigured, distinctCredentialStoredPrivately: true, role };
    fs.writeFileSync(path.join(repo, 'deployment/runtime-provision-result-2026-11-08.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } catch (e) {
    console.error(JSON.stringify({ event: 'runtime_provision_stopped', provisioned, loginConfigured, code: e.code || 'VALIDATION_FAILED' }));
    process.exitCode = 1;
  } finally { await client.end().catch(() => {}); }
}
main().catch(() => { console.error(JSON.stringify({ event: 'runtime_provision_refused' })); process.exitCode = 1; });
