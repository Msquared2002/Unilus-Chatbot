const fs = require('node:fs'), path = require('node:path');
const { readOnly, inspect, CORE } = require('../services/postgresOperations');
const { verifyBackup, bundleHash, checkCore } = require('../services/migrationService');
const { open, sha256 } = require('../services/logicalBackup');
const canonical = rows => JSON.stringify(rows.map(r => JSON.stringify(Object.fromEntries(Object.entries(r).sort()))).sort());
async function main() {
  const args = process.argv.slice(2), option = k => args[args.indexOf(k) + 1];
  if (!['--env', '--manifest', '--out'].every(k => args.includes(k))) throw Error('ARGUMENTS_REQUIRED');
  const repo = path.resolve(__dirname, '../..'), inventory = JSON.parse(fs.readFileSync(path.join(repo, 'deployment/preparation-files-2026-11-08.json')));
  const retry = args.includes('--approved-verifier-sha256');
  const approvedVerifier = '6a084535aa8763bdd20984cd2027f4179ab1c1d4c1d0f32213bef2431d315daa';
  if (retry && option('--approved-verifier-sha256') !== approvedVerifier) throw Error('VERIFIER_REVIEW_HASH_CHANGED');
  const changedReviewedFiles = inventory.sourceFiles.filter(f => sha256(fs.readFileSync(path.join(repo, f.path))) !== f.sha256).map(f => f.path);
  if (changedReviewedFiles.some(p => !retry || !['backend/services/migrationService.js', 'backend/tests/migrationSafety.test.js'].includes(p))) throw Error('REVIEWED_FILES_CHANGED');
  if (retry && sha256(fs.readFileSync(path.join(repo, 'backend/services/migrationService.js'))) !== approvedVerifier) throw Error('VERIFIER_REVIEW_HASH_CHANGED');
  const files = fs.readdirSync(path.join(repo, 'backend/migrations')).filter(n => n.endsWith('.sql')).sort().map(name => ({ name, sql: fs.readFileSync(path.join(repo, 'backend/migrations', name), 'utf8') }));
  if (bundleHash(files) !== 'e53a6189ba403af7f1df42d39285a8a95bb64032defadfecdb047eb308067600') throw Error('REVIEW_HASH_CHANGED');
  const manifestFile = option('--manifest'), manifest = verifyBackup(manifestFile);
  const { snapshot } = open(JSON.parse(fs.readFileSync(path.join(path.dirname(manifestFile), manifest.encryptedFile))));
  const result = await readOnly(option('--env'), async client => {
    const current = await inspect(client); checkCore(current);
    if (CORE.some(t => current.counts[t] !== manifest.tableCounts[t] || current.fingerprints[t] !== manifest.tableFingerprints[t])) throw Error('DATA_CHANGED_SINCE_BACKUP');
    const sections = ['tables', 'columns', 'indexes', 'constraints', 'policies', 'grants', 'defaults', 'roles', 'memberships', 'buckets', 'sequences', 'sequenceGrants', 'schemaGrants', 'triggers'];
    const changed = sections.filter(s => {
      // The separately committed, authorized role is the sole expected difference.
      const normalize = rows => retry && s === 'roles' ? rows.filter(r => r.name !== 'unilus_backend') : rows;
      return canonical(normalize(current[s])) !== canonical(normalize(snapshot.metadata[s]));
    });
    if (changed.length) throw Error('SCHEMA_OR_PERMISSION_DRIFT');
    if (retry) {
      const role = current.roles.find(r => r.name === 'unilus_backend');
      if (!role || !role.rolcanlogin || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole || role.rolinherit || current.memberships.length) throw Error('RESTRICTED_ROLE_DRIFT');
    }
    const activity = (await client.query("SELECT count(*)::int AS active_other_sessions FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend' AND state<>'idle'")).rows[0];
    const locks = (await client.query("SELECT count(*)::int AS conflicting_table_locks FROM pg_locks l JOIN pg_class c ON c.oid=l.relation JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1) AND l.pid<>pg_backend_pid() AND l.mode IN ('RowExclusiveLock','ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock')", [CORE])).rows[0];
    const stream = client.connection.stream;
    return { project: current.project, capturedAt: current.capturedAt, identity: current.identity,
      reviewedFilesChecked: inventory.sourceFiles.length, reviewedFilesUnchanged: !changedReviewedFiles.length,
      changedReviewedFiles, separatelyApprovedVerifierSha256: retry ? approvedVerifier : null,
      separatelyCommittedRestrictedRoleExpected: retry,
      migrationBundleSha256: bundleHash(files), backupVerifiedFresh: true, backupCountsFingerprintsAndSchemaMatched: true,
      counts: current.counts, duplicateActiveTicketGroups: current.duplicateActiveTicketGroups,
      tls: { authorized: stream.authorized, protocol: stream.getProtocol(), hostnameVerificationEnabled: true },
      ...activity, ...locks, remoteWritesPerformed: false,
      ownerReportedDeveloperApproval: true, independentRecoveryGateWaivedByOwner: true,
      fixedMaintenanceWindowReplacedByTransactionalLocksByOwner: true,
      recoveryLimitation: 'DPAPI backup depends on current Windows identity and machine' };
  });
  fs.writeFileSync(option('--out'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (result.conflicting_table_locks || result.active_other_sessions) throw Error('CONFLICTING_ACTIVITY_REQUIRES_REVIEW');
}
main().catch(e => { console.error(JSON.stringify({ event: 'execution_preflight_refused', code: /^[A-Z_]+$/.test(e.message) ? e.message : e.code || 'VERIFICATION_FAILED' })); process.exitCode = 1; });
