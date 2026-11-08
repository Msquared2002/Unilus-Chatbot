// Child used only by the explicitly approved synthetic cloud verification.
const fs = require('node:fs');
const pg = require('pg'); let ddlAttempts = 0;
const query = pg.Client.prototype.query;
pg.Client.prototype.query = function(sql, ...args) {
 if (/^\s*(CREATE|ALTER|DROP|TRUNCATE)\b/i.test(typeof sql === 'string' ? sql : sql?.text || '')) { ddlAttempts++; throw Error('Cloud test forbids DDL'); }
 return query.call(this, sql, ...args);
};
const originalFetch = global.fetch;
global.fetch = async function(url, options) {
 if (options?.method === 'POST' && String(url).includes('/storage/v1/object/')) {
   fs.appendFileSync(process.env.CLOUD_OBJECT_INVENTORY, JSON.stringify({ plannedObjectWrite: new URL(url).pathname, at: new Date().toISOString() }) + '\n');
 }
 return originalFetch(url, options);
};
let server;
async function start() {
 const app = require('../app'); await app.initialize();
 server = app.app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
 process.send({ ready: true, port: server.address().port, memory: process.memoryUsage(), ddlAttempts });
}
process.on('message', async message => {
 try {
  if (message.type === 'stop') { server.closeAllConnections(); await new Promise(r => server.close(r)); await require('../services/db').close(); process.exit(0); }
  if (message.type === 'probe') {
   const hits = await require('../services/knowledgeService').searchKnowledge(message.query, { topK: 5 });
   const all = await require('../services/knowledgeService').getStore().list({ filter: m => m.source_file === message.source });
   process.send({ reply: message.id, records: all.map(r => ({ id: r.id, source: r.metadata.source_file })), hitSources: hits.map(h => h.source_file || h.metadata?.source_file), memory: process.memoryUsage(), ddlAttempts });
  }
  if (message.type === 'failedPublication') {
   const real = global.fetch;
   global.fetch = async (url, options) => options?.method === 'POST' && String(url).includes('/storage/v1/object/') ? new Response('', { status: 503 }) : real(url, options);
   let refused = false;
   try { await require('../services/knowledgeUpdater').uploadDocument({ filename: message.source, buffer: Buffer.from(message.text), access: 'restricted', title: 'Synthetic failed update', uploadedBy: 'synthetic-test' }); }
   catch { refused = true; } finally { global.fetch = real; }
   process.send({ reply: message.id, refused, failureInjectedLocally: true });
  }
 } catch (e) { process.send({ reply: message.id, failed: true, code: e.code || 'PROBE_FAILED' }); }
});
start().catch(e => { process.send({ ready: false, code: e.code || 'STARTUP_FAILED' }); process.exit(1); });
