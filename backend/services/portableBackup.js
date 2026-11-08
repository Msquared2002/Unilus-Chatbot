// Additional recovery format; does not change the reviewed migration or DPAPI backup.
const crypto = require('node:crypto');
const { validateSnapshot, restoreSql, sha256 } = require('./logicalBackup');
const FORMAT = 'unilus-portable-aes256gcm-v1';
function checkKey(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw Error('A separate 32-byte recovery key is required');
}
function seal(snapshot, key) {
  checkKey(key); validateSnapshot(snapshot);
  if (snapshot.restoreSql !== restoreSql(snapshot)) throw Error('Recovery SQL mismatch');
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(FORMAT));
  const bytes = Buffer.from(JSON.stringify(snapshot));
  try {
    return { format: FORMAT, iv: iv.toString('base64'),
      ciphertext: Buffer.concat([cipher.update(bytes), cipher.final()]).toString('base64'),
      tag: cipher.getAuthTag().toString('base64') };
  } finally { bytes.fill(0); }
}
function open(envelope, key) {
  checkKey(key);
  if (envelope.format !== FORMAT) throw Error('Unsupported portable backup');
  const iv = Buffer.from(envelope.iv, 'base64'), tag = Buffer.from(envelope.tag, 'base64');
  if (iv.length !== 12 || tag.length !== 16) throw Error('Invalid envelope');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(FORMAT)); decipher.setAuthTag(tag);
  const bytes = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
  try {
    const snapshot = JSON.parse(bytes); validateSnapshot(snapshot);
    if (snapshot.restoreSql !== restoreSql(snapshot)) throw Error('Recovery SQL mismatch');
    return { snapshot, payloadSha256: sha256(bytes) };
  } finally { bytes.fill(0); }
}
module.exports = { seal, open };
