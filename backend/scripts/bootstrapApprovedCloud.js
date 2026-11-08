const fs = require('node:fs'), path = require('node:path');
const { PROJECT, configuration } = require('../services/postgresOperations');
async function main() {
 if (process.env.APPROVED_BOOTSTRAP_PROJECT !== PROJECT) throw Error('Explicit project approval required');
 const file = 'C:/UNILUS-secrets/runtime.env'; configuration(file); // validates project/pooler/TLS config
 Object.assign(process.env, require('dotenv').parse(fs.readFileSync(file)));
 const backup = JSON.parse(fs.readFileSync('C:/UNILUS-secrets/backups/unilus-integrated-2026-11-08-preknowledge-v2.encrypted.json.manifest.json'));
 require('../services/migrationService').verifyBackup('C:/UNILUS-secrets/backups/unilus-integrated-2026-11-08-preknowledge-v2.encrypted.json.manifest.json');
 if (backup.tableNames?.length !== 10 || !backup.recovery?.verified) throw Error('Integrated recovery proof required');
 const { records, manifest } = require('../services/bootstrapKnowledge');
 if (records.length !== 1447 || new Set(records.map(r => r.id)).size !== records.length) throw Error('Corpus shape mismatch');
 const sources = [...new Set(records.map(r => r.metadata.source_file))];
 for (const source of sources) {
  if (source.startsWith('https://')) { const host = new URL(source).hostname; if (!host.endsWith('.unilus.ac.zm') && !host.endsWith('.unilus.app')) throw Error('Unapproved website provenance'); }
  else if (path.basename(source) !== source || !/\.(txt|pdf|docx|html?)$/i.test(source) || /demo_users|credential|\.env/i.test(source)) throw Error('Private or unsupported source');
 }
 if (records.some(r => /sb_secret_[A-Za-z0-9]|gsk_[A-Za-z0-9]{20}|postgres(?:ql)?:\/\/[^\s]+:[^\s]+@/.test(r.text))) throw Error('Sensitive material refused');
 const db = require('../services/db'), { DatabaseVectorStore } = require('../services/databaseVectorStore');
 const store = new DatabaseVectorStore(); store.validate(records);
 try {
  await require('../services/runtimePermissionService').verifyRuntime(db);
  await db.transaction(async () => {
   await db.get('SELECT pg_advisory_xact_lock(hashtext(?))', ['unilus-knowledge-writer']);
   if (await store.count() || Number((await db.get('SELECT count(*) AS n FROM managed_documents')).n)) throw Error('NONEMPTY_KNOWLEDGE_TARGET');
   for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100);
    await db.run('INSERT INTO knowledge_records(id,payload) VALUES ' + batch.map(() => '(?,?)').join(','), batch.flatMap(r => [r.id, JSON.stringify(r)]));
   }
   const actual = await store.list();
   const expected = [...records].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
   if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error('Stored corpus differs');
  });
  const result = { project: PROJECT, bootstrapped: true, count: await store.count(), manifest,
   payloadBytes: Buffer.byteLength(JSON.stringify(records)), provenanceSources: sources, allPayloadsMatched: true,
   repeatBehavior: 'Refuses a nonempty target under the same writer lock; insert-only transaction, no overwrite',
   relationBytes: (await db.get("SELECT pg_total_relation_size('public.knowledge_records')::text AS n")).n };
  fs.writeFileSync(path.join(__dirname, '../../deployment/cloud-bootstrap-2026-11-08.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, provenanceSources: sources.length }));
 } finally { await db.close(); }
}
main().catch(e => { console.error(JSON.stringify({ event: 'approved_cloud_bootstrap_stopped', code: e.message === 'NONEMPTY_KNOWLEDGE_TARGET' ? e.message : e.code || 'INTEGRITY_OR_TARGET_CHECK_FAILED' })); process.exitCode = 1; });
