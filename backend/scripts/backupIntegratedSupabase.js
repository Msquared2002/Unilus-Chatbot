// Read-only remote capture; encrypted output outside repository; in-memory recovery.
const fs = require('node:fs'), path = require('node:path');
const backup = require('../services/logicalBackup');
const { readOnly, PROJECT } = require('../services/postgresOperations');
const { checkSecurity } = require('../services/migrationService');
const { rehearseSnapshot } = require('../services/rehearsePortableBackup');
async function main() {
 const args = process.argv.slice(2), option = k => args[args.indexOf(k) + 1];
 if (!['--env', '--out'].every(k => args.includes(k))) throw Error('Arguments required');
 const out = path.resolve(option('--out')), repo = path.resolve(__dirname, '../..');
 if (!path.relative(repo, out).startsWith('..' + path.sep) || fs.existsSync(out)) throw Error('New private backup path required');
 const snapshot = await readOnly(option('--env'), async client => { await checkSecurity(client); return backup.capture(client, { integrated: true }); });
 const { envelope, payloadSha256 } = backup.seal(snapshot);
 fs.writeFileSync(out, JSON.stringify(envelope), { flag: 'wx', mode: 0o600 });
 const recovered = backup.open(JSON.parse(fs.readFileSync(out)));
 if (recovered.payloadSha256 !== payloadSha256) throw Error('Readback mismatch');
 const recovery = await rehearseSnapshot(recovered.snapshot);
 const manifest = { project: PROJECT, capturedAt: snapshot.metadata.capturedAt, verified: true,
  tableNames: snapshot.tableNames, tableCounts: snapshot.metadata.counts, tableFingerprints: snapshot.metadata.fingerprints,
  encryptedFile: path.basename(out), encryptedSha256: backup.sha256(fs.readFileSync(out)), payloadSha256,
  recovery: { ...recovery, dpapiUsedForRecovery: true, independentOfWindows: false },
  scope: 'Applied application tables and migration ledger, including schema/indexes/constraints/RLS/ACL/sequences; excludes Auth, object bytes and provider internal schemas' };
 fs.writeFileSync(out + '.manifest.json', JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
 const safe = { project: PROJECT, encryptedBackupCreated: true, counts: manifest.tableCounts, integrityVerified: true,
  recovery: manifest.recovery, encryptedSha256: manifest.encryptedSha256, plaintextFilesWritten: false };
 if(args.includes('--report'))fs.writeFileSync(path.resolve(option('--report')),JSON.stringify(safe,null,2),{flag:'wx'});
 console.log(JSON.stringify(safe));
}
main().catch(e => { console.error(JSON.stringify({ event: 'integrated_backup_failed', code: e.code || 'VALIDATION_FAILED' })); process.exitCode = 1; });
