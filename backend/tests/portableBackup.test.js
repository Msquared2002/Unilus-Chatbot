const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { capture } = require('../services/logicalBackup');
const { seal, open } = require('../services/portableBackup');
const { rehearse } = require('../services/rehearsePortableBackup');
let snapshot;
test.before(async () => {
  const db = new PGlite();
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/001_integrated_core.sql'), 'utf8');
    await db.exec('CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])');
    await db.exec(sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS conversations'), sql.indexOf('CREATE TABLE IF NOT EXISTS chat_sessions')));
    await db.exec("INSERT INTO conversations(session_id,role,content) VALUES('synthetic','user','Synthetic recovery test');SELECT setval('conversations_id_seq',51,true)");
    snapshot = await capture({ query: (s, p) => db.query(s, p) });
  } finally { await db.close(); }
});
test('portable authenticated encryption recovers without DPAPI and contains no embedded recovery key', () => {
  const key = crypto.randomBytes(32), envelope = seal(snapshot, key);
  assert.deepEqual(open(envelope, key).snapshot, snapshot);
  assert.deepEqual(Object.keys(envelope).sort(), ['ciphertext', 'format', 'iv', 'tag']);
  assert.equal(JSON.stringify(envelope).includes('Synthetic recovery test'), false);
  assert.notEqual(seal(snapshot, key).iv, envelope.iv);
  key.fill(0);
});
test('wrong keys, modified ciphertext, tag, IV and format fail closed', () => {
  const key = crypto.randomBytes(32), envelope = seal(snapshot, key);
  assert.throws(() => open(envelope, crypto.randomBytes(32)));
  for (const field of ['ciphertext', 'iv', 'tag']) {
    const bytes = Buffer.from(envelope[field], 'base64'); bytes[0] ^= 1;
    assert.throws(() => open({ ...envelope, [field]: bytes.toString('base64') }, key));
  }
  assert.throws(() => open({ ...envelope, format: 'other' }, key));
  assert.throws(() => seal(snapshot, Buffer.alloc(31)));
  key.fill(0);
});
test('isolated portable restoration verifies schema, constraints, indexes, sequence state and fingerprints', async () => {
  const key = crypto.randomBytes(32);
  try {
    const result = await rehearse(seal(snapshot, key), key);
    assert.equal(result.verified, true);
    assert.equal(result.sequenceDefinitionsAndStateMatched, true);
    assert.equal(result.dpapiUsedForRecovery, false);
    assert.equal(result.remoteConnectionOpened, false);
    assert.equal(result.tableCounts.conversations, 1);
  } finally { key.fill(0); }
});
