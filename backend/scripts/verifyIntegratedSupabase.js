// Postflight: metadata/aggregate queries only. Never starts the application.
const fs = require('node:fs'), path = require('node:path');
const { CORE, APPLICATION, readOnly, inspect, ident } = require('../services/postgresOperations');
const { checkCore, checkSecurity, verifyBackup, bundleHash } = require('../services/migrationService');
const { open, sha256 } = require('../services/logicalBackup');
const canonical = rows => JSON.stringify(rows.map(r => JSON.stringify(Object.fromEntries(Object.entries(r).sort()))).sort());
async function main() {
  const repo = path.resolve(__dirname, '../..'), manifestFile = 'C:/UNILUS-secrets/backups/unilus-core-2026-11-08-v2.encrypted.json.manifest.json';
  const manifest = verifyBackup(manifestFile), { snapshot } = open(JSON.parse(fs.readFileSync(path.join(path.dirname(manifestFile), manifest.encryptedFile))));
  const files = fs.readdirSync(path.join(repo, 'backend/migrations')).filter(n => n.endsWith('.sql')).sort().map(name => ({ name, sql: fs.readFileSync(path.join(repo, 'backend/migrations', name), 'utf8') }));
  if (bundleHash(files) !== 'e53a6189ba403af7f1df42d39285a8a95bb64032defadfecdb047eb308067600' || sha256(fs.readFileSync(path.join(repo, 'backend/services/migrationService.js'))) !== '6a084535aa8763bdd20984cd2027f4179ab1c1d4c1d0f32213bef2431d315daa') throw Error('REVIEW_HASH_CHANGED');
  const result = await readOnly('C:/UNILUS-secrets/backend.env', async client => {
    const actual = await inspect(client); checkCore(actual); await checkSecurity(client);
    for (const t of CORE) if (actual.counts[t] !== manifest.tableCounts[t] || actual.fingerprints[t] !== manifest.tableFingerprints[t]) throw Error('ORIGINAL_RECORDS_CHANGED');
    for (const section of ['columns', 'constraints']) {
      const original = rows => rows.filter(r => CORE.includes(r.table_name));
      if (canonical(original(actual[section])) !== canonical(original(snapshot.metadata[section]))) throw Error('ORIGINAL_SCHEMA_CHANGED');
    }
    for (const old of snapshot.metadata.indexes) if (!actual.indexes.some(i => canonical([i]) === canonical([old]))) throw Error('ORIGINAL_INDEX_CHANGED');
    for (const s of snapshot.sequences) {
      const state = (await client.query('SELECT last_value::text,is_called FROM public.' + ident(s.sequencename))).rows[0];
      if (canonical([state]) !== canonical([s.state])) throw Error('ORIGINAL_SEQUENCE_CHANGED');
    }
    const ledger = (await client.query('SELECT version,checksum,applied_at FROM public.schema_migrations ORDER BY version')).rows;
    if (ledger.length !== files.length || files.some(f => !ledger.some(l => l.version === f.name && l.checksum === sha256(f.sql)))) throw Error('LEDGER_CHECKSUM_MISMATCH');
    const role = actual.roles.find(r => r.name === 'unilus_backend');
    if (!role || !role.rolcanlogin || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole || role.rolinherit || actual.memberships.length) throw Error('ROLE_DRIFT');
    const rights = (await client.query("SELECT has_database_privilege('unilus_backend',current_database(),'CREATE') AS database_create,has_schema_privilege('unilus_backend','public','CREATE') AS schema_create,has_table_privilege('unilus_backend','public.schema_migrations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS ledger_access")).rows[0];
    if (Object.values(rights).some(Boolean)) throw Error('EXCESSIVE_RUNTIME_RIGHTS');
    return { project: actual.project, capturedAt: actual.capturedAt, serverVersion: actual.identity.version,
      migrationCommitted: true, migrationBundleSha256: bundleHash(files), migrationLedger: ledger,
      counts: actual.counts, originalRecordsAndFingerprintsPreserved: true,
      originalColumnsConstraintsIndexesAndSequenceStatesPreserved: true,
      tables: actual.tables, indexes: actual.indexes, constraints: actual.constraints,
      policies: actual.policies, grants: actual.grants, sequenceGrants: actual.sequenceGrants,
      defaults: actual.defaults, schemaGrants: actual.schemaGrants,
      applicationTablesVerified: APPLICATION.length, rlsAndEffectiveGrantsVerified: true,
      restrictedRole: role, runtimeRights: rights, runtimeMemberships: actual.memberships,
      buckets: actual.buckets.length, internalSchemaWritesPerformed: false,
      internalSchemaNote: 'Reviewed SQL writes public application objects and approved role only; no full internal-schema baseline was captured.' };
  });
  result.runtimeConnection = await readOnly('C:/UNILUS-secrets/runtime.env', async client => {
    const identity = (await client.query('SELECT current_user AS role,current_database() AS database')).rows[0];
    return { ...identity, authenticated: true, tlsAuthorized: client.connection.stream.authorized,
      tlsProtocol: client.connection.stream.getProtocol(), hostnameVerificationEnabled: true };
  });
  // Load only the adapter and readiness checker; no app, auth bootstrap or ingest.
  Object.assign(process.env, require('dotenv').parse(fs.readFileSync('C:/UNILUS-secrets/runtime.env')));
  process.env.NODE_ENV = 'production';
  const db = require('../services/db');
  try {
    result.applicationAdapter = await db.transaction(async () => {
      await db.exec('SET TRANSACTION READ ONLY');
      await require('../services/runtimePermissionService').verifyRuntime(db);
      const parameter = await db.get('SELECT ?::text AS value', ['readonly-adapter-probe']);
      if (parameter.value !== 'readonly-adapter-probe') throw Error('PARAMETER_TRANSLATION_FAILED');
      const counts = {};
      for (const t of APPLICATION) counts[t] = Number((await db.get('SELECT count(*) AS n FROM public.' + ident(t))).n);
      return { productionAdapterInitialized: true, readinessPassed: true, parameterizedQueriesPassed: true,
        poolMax: 2, readOnlyTransaction: true, tableCounts: counts, applicationStarted: false };
    });
    let denied = false;
    try { await db.transaction(async () => { await db.exec('SET TRANSACTION READ ONLY'); await db.get('SELECT version FROM public.schema_migrations LIMIT 1'); }); }
    catch (e) { if (e.code !== '42501') throw e; denied = true; }
    if (!denied) throw Error('LEDGER_ACCESS_NOT_DENIED');
    result.applicationAdapter.actualLedgerReadDenied = true;
  } finally { await db.close(); }
  fs.writeFileSync(path.join(repo, 'deployment/supabase-migration-postflight-2026-11-08.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ migrationCommitted: true, project: result.project, applicationTablesVerified: result.applicationTablesVerified,
    counts: result.counts, originalRecordsAndFingerprintsPreserved: true, ledgerVerified: true,
    rlsAndEffectiveGrantsVerified: true, runtimeConnection: result.runtimeConnection, applicationAdapter: result.applicationAdapter, buckets: result.buckets }));
}
main().catch(e => { console.error(JSON.stringify({ event: 'postflight_failed', code: /^[A-Z_]+$/.test(e.message) ? e.message : e.code || 'VERIFICATION_FAILED' })); process.exitCode = 1; });
