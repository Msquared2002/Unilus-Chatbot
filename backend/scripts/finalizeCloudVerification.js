const fs = require('node:fs'), path = require('node:path');
const { PROJECT, readOnly, inspect, CORE, ident } = require('../services/postgresOperations');
const { storageHeaders } = require('../services/storageCredentials');
async function main() {
 const repo = path.resolve(__dirname, '../..');
 const latest = JSON.parse(fs.readFileSync(path.join(repo, 'deployment/cloud-application-latest.json')));
 const report = JSON.parse(fs.readFileSync(path.join(repo, 'deployment', latest.report)));
 if (!latest.complete || report.project !== PROJECT) throw Error('Completed approved test inventory required');
 Object.assign(process.env, require('dotenv').parse(fs.readFileSync('C:/UNILUS-secrets/runtime.env')));
 const db = require('../services/db');
 try {
  const actual = await require('../services/knowledgeService').getStore().list();
  const expected = require('../services/bootstrapKnowledge').records;
  const sort = rows => [...rows].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (JSON.stringify(sort(actual)) !== JSON.stringify(sort(expected))) throw Error('Corpus payload changed');
  const sid = report.sessions.map(s => s.id), refs = report.tickets;
  const inventory = { sessions: sid, conversations: (await db.all('SELECT id FROM conversations WHERE session_id IN (' + sid.map(() => '?').join(',') + ')', sid)).map(r => r.id),
   feedback: (await db.all('SELECT id FROM feedback WHERE session_id IN (' + sid.map(() => '?').join(',') + ')', sid)).map(r => r.id),
   tickets: (await db.all('SELECT id,ticket_ref FROM tickets WHERE ticket_ref IN (' + refs.map(() => '?').join(',') + ')', refs)),
   ticketEvents: (await db.all('SELECT id FROM ticket_events WHERE ticket_ref IN (' + refs.map(() => '?').join(',') + ')', refs)).map(r => r.id),
   ticketAssignments: (await db.all('SELECT ticket_ref FROM ticket_assignments WHERE ticket_ref IN (' + refs.map(() => '?').join(',') + ')', refs)).map(r => r.ticket_ref),
   staffAnswers: report.staffAnswers,
   documentVersions: await db.all('SELECT id,source_name,object_key,active FROM managed_documents WHERE source_name=?', [report.documents[0]]) };
  const current = await readOnly('C:/UNILUS-secrets/backend.env', async client => {
   const metadata = await inspect(client); await require('../services/migrationService').checkSecurity(client);
   const ledger = (await client.query('SELECT version,checksum FROM public.schema_migrations')).rows;
   const baseline = require('../services/logicalBackup').open(JSON.parse(fs.readFileSync('C:/UNILUS-secrets/backups/unilus-integrated-2026-11-08-preknowledge-v2.encrypted.json'))).snapshot;
   for (const t of CORE) {
    const ids = baseline.data[t].map(r => r.id);
    const r = (await client.query("SELECT count(*)::int AS n,md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,'[]')) AS digest FROM public." + ident(t) + ' t WHERE id=ANY($1::integer[])', [ids])).rows[0];
    if (r.n !== baseline.metadata.counts[t] || r.digest !== baseline.metadata.fingerprints[t]) throw Error('Original records changed');
   }
   const objects = (await client.query('SELECT name,(metadata->>\'size\')::bigint::text AS bytes FROM storage.objects WHERE bucket_id=$1 ORDER BY name', [process.env.SUPABASE_DOCUMENT_BUCKET])).rows;
   return { counts: metadata.counts, ledger, indexCount: metadata.indexes.length, rlsAndGrantsVerified: true,
    originalRecordsPreserved: true, objects, buckets: metadata.buckets };
  });
  const key = storageHeaders(), endpoint = process.env.SUPABASE_URL + '/storage/v1/object/' + process.env.SUPABASE_DOCUMENT_BUCKET + '/';
  const objectVersions = [];
  for (const version of inventory.documentVersions) {
   if (!current.objects.some(o => o.name === version.object_key)) throw Error('Document object missing');
   const response = await fetch(endpoint + version.object_key, { headers: key, signal: AbortSignal.timeout(15000) });
   if (!response.ok) throw Error('Document object unavailable');
   const bytes = Buffer.from(await response.arrayBuffer());
   const expectedCode = version.id === report.firstDocument.id ? 'ZAMBIA-CLOUD-ALPHA' : version.id === report.secondDocument.id ? 'ZAMBIA-CLOUD-BETA' : null;
   if (!expectedCode || !bytes.includes(Buffer.from(expectedCode))) throw Error('Object version content mismatch');
   objectVersions.push({ id: version.id, objectKey: version.object_key, bytes: bytes.length,
    sha256: require('node:crypto').createHash('sha256').update(bytes).digest('hex'), expectedSyntheticContentVerified: true });
  }
  // Both requests are expected to be rejected; known unique paths are inventoried first.
  const probes = [{ name: report.run + '/anonymous-refused.txt', credentials: false, contentType: 'text/plain' },
   { name: report.run + '/mime-refused.exe', credentials: true, contentType: 'application/octet-stream' }];
  fs.writeFileSync(path.join(repo, 'deployment/storage-negative-probes-2026-11-08.json'), JSON.stringify(probes.map(({name}) => ({name,planned:true})), null, 2));
  const negative = [];
  for (const p of probes) {
   const response = await fetch(endpoint + p.name, { method: 'POST', headers: { ...(p.credentials ? key : {}), 'Content-Type': p.contentType, 'x-upsert': 'false' }, body: 'Inventoried synthetic negative permission test', signal: AbortSignal.timeout(15000) });
   negative.push({ name: p.name, status: response.status, rejected: !response.ok });
   if (response.ok) throw Error('Unexpected unauthorized or unsupported upload');
  }
  const finalChecks = Object.values(Object.fromEntries(report.checks.map(c => [c.name, c])));
  if (finalChecks.some(c => !c.passed)) throw Error('Outstanding final workflow assertion');
  const result = { project: PROJECT, knowledgeCount: actual.length, allBootstrapPayloadsStillMatch: true,
   finalWorkflowChecksPassed: finalChecks.length, recordedAssertionHistory: report.checks.length,
   supersededHarnessAssertionFailures: report.checks.filter(c => !c.passed).length,
   syntheticInventory: inventory, ...current, objectVersions, storageNegativeProbes: negative,
   memoryAfterRetrieval: report.memoryAfterRetrieval, ragApi: report.ragApi,
   browserTestsPerformed: false, source: latest.report, recordedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(repo, 'deployment/cloud-integration-final-2026-11-08.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ project: PROJECT, knowledgeCount: actual.length, allBootstrapPayloadsStillMatch: true,
   finalWorkflowChecksPassed: finalChecks.length, counts: current.counts, originalRecordsPreserved: true, storageNegativeProbes: negative,
   syntheticInventoryCounts: Object.fromEntries(Object.entries(inventory).map(([k,v]) => [k,v.length])) }));
 } finally { await db.close(); }
}
main().catch(e => {
 const safe = ['Document object missing','Document object unavailable','Object version content mismatch','Corpus payload changed','Original records changed','Outstanding final workflow assertion'];
 console.error(JSON.stringify({ event: 'final_cloud_verification_failed', code: e.code || (safe.includes(e.message) ? e.message : 'VERIFICATION_FAILED') })); process.exitCode = 1;
});
