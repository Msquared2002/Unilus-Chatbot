const fs = require('node:fs'), path = require('node:path');
const { readOnly, inspect, CORE } = require('../services/postgresOperations');
const { verifyBackup } = require('../services/migrationService');
const { open } = require('../services/logicalBackup');
const canonical = rows => JSON.stringify(rows.map(r => JSON.stringify(Object.fromEntries(Object.entries(r).sort()))).sort());
async function main() {
  const file = 'C:/UNILUS-secrets/backups/unilus-core-2026-11-08-v2.encrypted.json.manifest.json';
  const manifest = verifyBackup(file), { snapshot } = open(JSON.parse(fs.readFileSync(path.join(path.dirname(file), manifest.encryptedFile))));
  const result = await readOnly('C:/UNILUS-secrets/backend.env', async client => {
    const actual = await inspect(client);
    const sections = ['tables', 'columns', 'indexes', 'constraints', 'policies', 'grants', 'defaults', 'memberships', 'buckets', 'sequences', 'sequenceGrants', 'schemaGrants', 'triggers'];
    const changed = sections.filter(s => canonical(actual[s]) !== canonical(snapshot.metadata[s]));
    const recordsPreserved = CORE.every(t => actual.counts[t] === manifest.tableCounts[t] && actual.fingerprints[t] === manifest.tableFingerprints[t]);
    const parser = (await client.query("SELECT ARRAY['unilus_backend'::name] AS roles, ARRAY['unilus_backend'::text] AS text_roles")).rows[0];
    return { project: actual.project, serverVersion: actual.identity.version, migrationCommitted: false,
      failureCode: 'RUNTIME_POLICY_DRIFT', originalCounts: manifest.tableCounts, postAttemptCounts: actual.counts,
      originalRecordsPreserved: recordsPreserved, changedSchemaPermissionSections: changed,
      rollbackVerified: recordsPreserved && changed.length === 0,
      ledgerPresent: actual.tables.some(t => t.name === 'schema_migrations'),
      integrationTablesPresent: actual.tables.filter(t => !CORE.includes(t.name)).map(t => t.name),
      runtimeRole: actual.roles.find(r => r.name === 'unilus_backend'),
      policyDriverProbe: { nameArrayIsArray: Array.isArray(parser.roles), nameArrayJsType: typeof parser.roles,
        textArrayIsArray: Array.isArray(parser.text_roles), nameArrayValue: parser.roles },
      buckets: actual.buckets.length, capturedAt: actual.capturedAt };
  });
  try {
    result.runtimeConnection = await readOnly('C:/UNILUS-secrets/runtime.env', async client => {
      const role = (await client.query("SELECT current_user AS role,current_database() AS database,current_setting('transaction_read_only') AS read_only,has_schema_privilege(current_user,'public','CREATE') AS schema_create,has_table_privilege(current_user,'public.conversations','SELECT,INSERT,UPDATE,DELETE') AS conversations_access")).rows[0];
      const stream = client.connection.stream;
      return { connected: true, ...role, tlsAuthorized: stream.authorized, tlsProtocol: stream.getProtocol() };
    });
  } catch (e) { result.runtimeConnection = { connected: false, code: e.code || 'CONNECTION_FAILED' }; }
  fs.writeFileSync(path.join(__dirname, '../../deployment/stopped-migration-verification-2026-11-08.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
main().catch(e => { console.error(JSON.stringify({ event: 'stopped_migration_verification_failed', code: e.code || 'VALIDATION_FAILED' })); process.exitCode = 1; });
