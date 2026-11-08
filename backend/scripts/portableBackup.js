// Key must already exist on an owner-controlled independent recovery medium.
// Never generates a key, logs secrets, exports plaintext, or connects to PostgreSQL.
const fs = require('node:fs'), path = require('node:path');
const { seal } = require('../services/portableBackup');
const { rehearse } = require('../services/rehearsePortableBackup');
async function main() {
  const args = process.argv.slice(2), option = name => args[args.indexOf(name) + 1];
  const mode = args[0];
  if (!['convert', 'verify'].includes(mode) || !args.includes('--key-file')) throw Error('Usage: convert --manifest FILE --out FILE --key-file FILE, or verify --backup FILE --key-file FILE');
  const key = fs.readFileSync(option('--key-file'));
  try {
    let envelope;
    if (mode === 'convert') {
      if (!args.includes('--manifest') || !args.includes('--out')) throw Error('Manifest and output required');
      const output = path.resolve(option('--out')), repo = path.resolve(__dirname, '../..');
      if (!path.relative(repo, output).startsWith('..' + path.sep)) throw Error('Backup must be outside repository');
      if (path.dirname(output).toLowerCase() === path.dirname(path.resolve(option('--key-file'))).toLowerCase()) throw Error('Keep key separate from backup');
      const { verifyBackup } = require('../services/migrationService');
      const { open } = require('../services/logicalBackup');
      const manifestFile = option('--manifest'), manifest = verifyBackup(manifestFile);
      const { snapshot } = open(JSON.parse(fs.readFileSync(path.join(path.dirname(manifestFile), manifest.encryptedFile), 'utf8')));
      envelope = seal(snapshot, key);
      const result = await rehearse(envelope, key);
      fs.writeFileSync(output, JSON.stringify(envelope), { flag: 'wx', mode: 0o600 });
      console.log(JSON.stringify({ ...result, independentlyStoredOwnerKeyConfirmed: false,
        note: 'Owner must confirm independent custody and recovery access; format alone does not satisfy the migration gate.' }));
    } else {
      if (!args.includes('--backup')) throw Error('Backup required');
      envelope = JSON.parse(fs.readFileSync(option('--backup'), 'utf8'));
      console.log(JSON.stringify(await rehearse(envelope, key)));
    }
  } finally { key.fill(0); }
}
main().catch(() => { console.error(JSON.stringify({ event: 'portable_backup_failed', secretsLogged: false })); process.exitCode = 1; });
