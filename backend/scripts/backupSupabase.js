const fs = require('node:fs'), path = require('node:path');
const { readOnly } = require('../services/postgresOperations');
const backup = require('../services/logicalBackup');
const args = process.argv.slice(2), option = key => args[args.indexOf(key) + 1];
(async () => {
  if (!args.includes('--env') || !args.includes('--out')) throw Error('Private --env and --out paths required');
  const out = path.resolve(option('--out')), repo = path.resolve(__dirname, '../..');
  if (!path.relative(repo, out).startsWith('..') || fs.existsSync(out)) throw Error('Use a NEW backup path outside the repository');
  const snapshot = await readOnly(option('--env'), backup.capture);
  const { envelope, payloadSha256 } = backup.seal(snapshot);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(envelope), { flag: 'wx', mode: 0o600 });
  const bytes = fs.readFileSync(out), verified = backup.open(JSON.parse(bytes));
  if (verified.payloadSha256 !== payloadSha256) throw Error('Backup readback mismatch');
  const manifest = { project: snapshot.metadata.project, capturedAt: snapshot.metadata.capturedAt, verified: true,
    scope: 'Four original application tables; not a full Supabase/Auth/Storage backup',
    encryptedFile: path.basename(out), encryptedSha256: backup.sha256(bytes), payloadSha256,
    tableCounts: snapshot.metadata.counts, tableFingerprints: snapshot.metadata.fingerprints, recovery: 'AES-256-GCM; key protected by Windows CurrentUser DPAPI; same Windows identity/machine required' };
  fs.writeFileSync(out + '.manifest.json', JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ backupCreated: true, encrypted: true, readbackVerified: true, tableCounts: manifest.tableCounts, encryptedSha256: manifest.encryptedSha256, plaintextWritten: false }));
})().catch(e => { console.error(JSON.stringify({ event: 'backup_failed', code: e.code || 'BACKUP_VALIDATION_FAILED' })); process.exitCode = 1; });
