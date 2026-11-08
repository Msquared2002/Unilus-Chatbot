// Explicit opt-in; retained, inventoried synthetic records only. No blanket cleanup.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { fork } = require('node:child_process');
const { PROJECT, configuration, readOnly, CORE, ident } = require('../services/postgresOperations');
async function main() {
 if (process.env.APPROVED_CLOUD_TEST_PROJECT !== PROJECT) throw Error('Explicit approval required');
 configuration('C:/UNILUS-secrets/runtime.env');
 Object.assign(process.env, require('dotenv').parse(fs.readFileSync('C:/UNILUS-secrets/runtime.env')));
 const bootstrap = JSON.parse(fs.readFileSync(path.join(__dirname, '../../deployment/cloud-bootstrap-2026-11-08.json')));
 if (!bootstrap.bootstrapped || bootstrap.count !== 1447) throw Error('Verified bootstrap required');
 const repo = path.resolve(__dirname, '../..');
 const resumeName = process.argv[2];
 if (resumeName && !/^synthetic-cloud-[0-9a-f-]+\.json$/.test(resumeName)) throw Error('Invalid resume inventory');
 const resume = resumeName ? JSON.parse(fs.readFileSync(path.join(repo, 'deployment', resumeName))) : null;
 if (resume && resume.project !== PROJECT) throw Error('Wrong inventory project');
 const run = resume?.run || 'synthetic-cloud-' + crypto.randomUUID();
 const reportFile = path.join(repo, 'deployment', run + '.json'), objectFile = path.join(repo, 'deployment', run + '-objects.jsonl');
 const result = resume || { run, project: PROJECT, startedAt: new Date().toISOString(), checks: [], sessions: [], tickets: [], staffAnswers: [], documents: [], retainedSyntheticData: true };
 if (resume) { result.priorFailure = result.failure; delete result.failure; }
 const save = () => fs.writeFileSync(reportFile, JSON.stringify(result, null, 2));
 const check = (name, condition) => { result.checks.push({ name, passed: Boolean(condition) }); save(); if (!condition) throw Error('Check failed: ' + name); };
 const secret = crypto.randomBytes(32).toString('hex'), password = crypto.randomBytes(24).toString('hex');
 Object.assign(process.env, { AUTH_JWT_SECRET: secret, VECTOR_BACKEND: 'database', NODE_ENV: 'production',
  CORS_ORIGINS: 'https://unilus-demo.invalid', TONE_REWRITE: 'off', QUERY_PLANNER: 'off', WARM_MODEL_ON_START: 'yes',
  AUTH_USERS_FILE: 'C:/UNILUS-secrets/' + run + (resume ? '-resume-' + crypto.randomUUID() : '') + '-users.json', CLOUD_OBJECT_INVENTORY: objectFile });
 process.env.GROQ_API_KEY = require('dotenv').parse(fs.readFileSync('C:/Users/mjluk/Desktop/FYP/UnilusChatBot/backend/.env')).GROQ_API_KEY;
 const auth = require('../services/authService');
 const users = ['a', 'b', 'admin', 'finance'].map(role => ({ username: run + '-' + role, name: 'Synthetic cloud verification',
  role: role === 'admin' ? 'admin' : role === 'finance' ? 'staff' : 'student', department: role === 'finance' ? 'Finance' : null,
  programme: 'BIT', year: 3, semester: 2, password_hash: auth.hashPassword(password) }));
 fs.writeFileSync(process.env.AUTH_USERS_FILE, JSON.stringify({ users }), { flag: 'wx', mode: 0o600 });
 result.syntheticUsersFile = process.env.AUTH_USERS_FILE; save();
 const db = require('../services/db'); let child, base;
 const tokens = {};
 async function start() {
  child = fork(path.join(__dirname, 'cloudApplicationWorker.js'), [], { env: process.env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true });
  const ready = await new Promise((resolve, reject) => {
   const timer = setTimeout(() => reject(Error('Startup timeout')), 180000);
   child.once('message', m => { clearTimeout(timer); resolve(m); }); child.once('exit', code => { if (code) { clearTimeout(timer); reject(Error('Worker exited')); } });
  });
  check('production startup ' + (result.restarts || 0), ready.ready && ready.ddlAttempts === 0);
  result.memory = ready.memory; base = 'http://127.0.0.1:' + ready.port; save();
 }
 async function stop() { if (!child || child.exitCode !== null) return; const done = new Promise(r => child.once('exit', r)); child.send({ type: 'stop' }); await done; }
 async function probe(message) {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
   const timer = setTimeout(() => { child.off('message', receive); reject(Error('Probe timeout')); }, 120000);
   function receive(m) { if (m.reply === id) { clearTimeout(timer); child.off('message', receive); m.failed ? reject(Error('Probe failed: ' + m.code)) : resolve(m); } }
   child.on('message', receive); child.send({ ...message, id });
  });
 }
 async function request(route, body, who, method = 'POST', extra = {}) {
  const r = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(tokens[who] ? { Authorization: 'Bearer ' + tokens[who] } : {}), ...extra },
   ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(120000) });
  return { status: r.status, data: await r.json() };
 }
 async function session(who) {
  const id = crypto.randomUUID(); result.sessions.push({ id, owner: who ? 'user:' + run + '-' + who : 'guest' }); save();
  const now = new Date();
  await db.run('INSERT INTO chat_sessions(id,owner,created_at,expires_at) VALUES (?,?,?,?)', [id, result.sessions.at(-1).owner, now.toISOString(), new Date(now.getTime() + 86400000).toISOString()]);
  return id;
 }
 const source = run + '.txt'; if (!result.documents.includes(source)) result.documents.push(source); save();
 const storage = require('../services/storageCredentials').storageHeaders();
 const url = process.env.SUPABASE_URL + '/storage/v1/object/' + process.env.SUPABASE_DOCUMENT_BUCKET + '/';
 async function upload(text) {
  const r = await fetch(base + '/api/admin/documents?filename=' + encodeURIComponent(source) + '&access=restricted', { method: 'POST', headers: { Authorization: 'Bearer ' + tokens.admin, 'Content-Type': 'application/octet-stream' }, body: text, signal: AbortSignal.timeout(120000) });
  return { status: r.status, data: await r.json() };
 }
 try {
  await start();
  let sid = resume?.sessions.find(s => s.owner === 'user:' + run + '-a')?.id, ref = resume?.tickets[0];
  if (resume) for (const who of ['a','b','admin','finance']) tokens[who] = auth.signToken(users.find(u => u.username === run + '-' + who)).token;
  if (!resume) {
  check('health and readiness', (await request('/readyz', undefined, null, 'GET')).status === 200);
  check('wrong password denied', (await request('/api/auth/login', { username: users[0].username, password: 'incorrect' })).status === 401);
  for (const who of ['a', 'b', 'admin', 'finance']) { const r = await request('/api/auth/login', { username: run + '-' + who, password }); check('login ' + who, r.status === 200); tokens[who] = r.data.token; }
  sid = await session('a'); const guest = await session(null), advisor = await session(null);
  check('authenticated chat', (await request('/api/chat', { question: 'hello', sessionId: sid }, 'a')).status === 200);
  check('foreign session denied', (await request('/api/chat', { question: 'hello', sessionId: sid }, 'b')).status === 403);
  check('guest cannot reuse account session', (await request('/api/chat', { question: 'hello', sessionId: sid })).status === 403);
  check('guest chat', (await request('/api/chat', { question: 'hello', sessionId: guest })).status === 200);
  check('guest timetable denied', (await request('/api/timetable', undefined, null, 'GET')).status === 401);
  const timetable = await request('/api/chat', { question: 'Show BIT third year second semester timetable', sessionId: sid }, 'a');
  check('timetable stage and data', timetable.status === 200 && timetable.data.timetableMatches > 0 && timetable.data.queryType.entities.semester === 2);
  const campus = await request('/api/chat', { question: 'Where is the library?', sessionId: guest });
  check('campus and compatible fields', campus.status === 200 && campus.data.navigation?.placeId === 'unilus_library' && ['answer','sessionId','suggestedActions','sources'].every(k => k in campus.data));
  for (const question of ['I love business and computers', 'Maths 4, English 5, Biology 6, Commerce 2, Civic Education 3', 'ECZ School Certificate', 'What about Computer Science?'])
   check('advisor response ' + result.checks.length, (await request('/api/chat', { question, sessionId: advisor })).status === 200);
  check('applicant grades not persisted', Number((await db.get('SELECT count(*) AS n FROM conversations WHERE session_id=?', [advisor])).n) === 0);
  const t = await request('/api/tickets', { sessionId: sid, question: run + ' missing demonstration result' }, 'a');
  if (t.data.ticket?.ref) { result.tickets.push(t.data.ticket.ref); save(); }
  check('ticket created', t.status === 201); ref = t.data.ticket.ref;
  const repeated = await Promise.all(Array.from({ length: 3 }, () => request('/api/tickets', { sessionId: sid, question: run + ' missing demonstration result' }, 'a')));
  check('concurrent duplicates prevented', repeated.every(r => r.status === 200 && r.data.ticket.ref === ref));
  check('foreign ticket denied', (await request('/api/tickets/' + ref, undefined, 'b', 'GET', { 'X-Chat-Session': sid })).status === 403);
  check('assignment persisted', (await request('/api/admin/tickets/' + ref + '/assignment', { department: 'Academic Office', assignee: run + '-admin' }, 'admin')).status === 200);
  check('wrong department denied', (await request('/api/admin/tickets/' + ref, undefined, 'finance', 'GET')).status === 403);
  check('staff reply saved', (await request('/api/admin/tickets/' + ref + '/events', { kind: 'reply', body: 'Synthetic cloud test reply' }, 'admin')).status === 200);
  const answer = await request('/api/admin/answers', { question: run + ' approved verification phrase', answer: 'Synthetic approved cloud response', visibility: 'public' }, 'admin');
  if (answer.data.id) { result.staffAnswers.push(answer.data.id); save(); }
  check('approved answer saved', answer.status === 200 && answer.data.id);
  const faqReply = await request('/api/chat', { question: run + ' approved verification phrase', sessionId: sid }, 'a');
  check('approved answer returned', faqReply.status === 200 && faqReply.data.answer.includes('Synthetic approved cloud response'));
  check('guest document upload denied', (await fetch(base + '/api/admin/documents?filename=' + source, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: 'unauthorized' })).status === 401);
  check('document upload and indexing', (await upload('Synthetic cloud verification document. The demonstration verification code is ZAMBIA-CLOUD-ALPHA. This document is only a synthetic integration test.')).status === 201);
  }
  if (!resume?.secondDocument) {
  const first = await db.get('SELECT id,object_key FROM managed_documents WHERE source_name=? AND active=1', [source]);
  result.firstDocument = first; save();
  check('authorized private download', (await fetch(url + first.object_key, { headers: storage })).status === 200);
  check('anonymous private download denied', !(await fetch(url + first.object_key)).ok);
  check('public object endpoint denied', !(await fetch(process.env.SUPABASE_URL + '/storage/v1/object/public/' + process.env.SUPABASE_DOCUMENT_BUCKET + '/' + first.object_key)).ok);
  const rag = await probe({ type: 'probe', source, query: 'What is the demonstration verification code ZAMBIA-CLOUD-ALPHA?' });
  result.knowledgeIds = rag.records.map(r => r.id); result.memoryAfterRetrieval = rag.memory; save();
  check('real MiniLM hybrid retrieval finds private document', rag.hitSources.includes(source) && rag.records.length > 0 && rag.ddlAttempts === 0);
  const failed = await probe({ type: 'failedPublication', source, text: 'Synthetic deliberately failed replacement ZAMBIA-CLOUD-FAIL.' });
  check('injected upload failure refused', failed.refused);
  check('failed publication preserves previous active version', (await db.get('SELECT id FROM managed_documents WHERE source_name=? AND active=1', [source])).id === first.id);
  check('updated document published', (await upload('Synthetic cloud verification document. The demonstration verification code is now ZAMBIA-CLOUD-BETA. Updated synthetic integration test.')).status === 201);
  const second = await db.get('SELECT id,object_key FROM managed_documents WHERE source_name=? AND active=1', [source]); result.secondDocument = second; save();
  check('immutable old and new objects retained', second.id !== first.id && (await fetch(url + first.object_key, { headers: storage })).ok && (await fetch(url + second.object_key, { headers: storage })).ok);
  }
  const beforeRestart = await db.get('SELECT count(*) AS n FROM conversations WHERE session_id=?', [sid]); check('conversation records persisted', Number(beforeRestart.n) > 0);
  result.restarts = 1; await stop(); await start();
  check('conversation persists after process restart', Number((await db.get('SELECT count(*) AS n FROM conversations WHERE session_id=?', [sid])).n) === Number(beforeRestart.n));
  const ticketAfter = await request('/api/admin/tickets/' + ref, undefined, 'admin', 'GET');
  check('ticket history and assignment persist after restart', ticketAfter.status === 200 && ticketAfter.data.events.length >= 2 && ticketAfter.data.assignedTo === run + '-admin');
  check('updated object hydrated after restart', fs.readFileSync(path.join(__dirname, '../data/documents/uploads', source), 'utf8').includes('ZAMBIA-CLOUD-BETA'));
  const again = await probe({ type: 'probe', source, query: 'What is the demonstration verification code ZAMBIA-CLOUD-BETA?' });
  check('RAG survives restart', again.hitSources.includes(source));
  const ragApi = await request('/api/chat', { question: 'What is the demonstration verification code ZAMBIA-CLOUD-BETA?', sessionId: sid }, 'a');
  result.ragApi = { status: ragApi.status, sourceCount: ragApi.data.sources?.length || 0, answerContainsSyntheticCode: ragApi.data.answer?.includes('ZAMBIA-CLOUD-BETA') || false };
  check('actual RAG chat API responds', ragApi.status === 200); save();
  const baselineCount = await db.get('SELECT count(*) AS n FROM knowledge_records');
  check('deactivate only inventoried document', (await request('/api/admin/documents/' + source, undefined, 'admin', 'DELETE')).status === 200);
  check('source chunks removed without changing university corpus', (await require('../services/knowledgeService').getStore().list({ filter: m => m.source_file === source })).length === 0 && Number((await db.get('SELECT count(*) AS n FROM knowledge_records')).n) === 1447);
  check('document versions consistently inactive', Number((await db.get('SELECT count(*) AS n FROM managed_documents WHERE source_name=? AND active=1', [source])).n) === 0);
  const rollbackId = run + '-rollback';
  try { await db.transaction(async () => { await db.run('INSERT INTO chat_sessions VALUES (?,?,?,?)', [rollbackId,'guest','now','later']); throw Error('Synthetic rollback'); }); } catch {}
  check('transaction rollback verified', !(await db.get('SELECT id FROM chat_sessions WHERE id=?', [rollbackId])));
  let denied = false; try { await db.get('SELECT version FROM schema_migrations'); } catch (e) { denied = e.code === '42501'; }
  check('runtime ledger access denied', denied);
  const encrypted = require('../services/logicalBackup').open(JSON.parse(fs.readFileSync('C:/UNILUS-secrets/backups/unilus-integrated-2026-11-08-preknowledge-v2.encrypted.json'))).snapshot;
  result.originalPreservation = await readOnly('C:/UNILUS-secrets/backend.env', async client => {
   const preserved = {};
   for (const t of CORE) {
    const ids = encrypted.data[t].map(row => row.id);
    const row = (await client.query("SELECT count(*)::int AS n,md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,'[]')) AS digest FROM public." + ident(t) + ' t WHERE id=ANY($1::integer[])', [ids])).rows[0];
    preserved[t] = row.n === encrypted.metadata.counts[t] && row.digest === encrypted.metadata.fingerprints[t];
   }
   return preserved;
  });
  check('all original records and fingerprints preserved', Object.values(result.originalPreservation).every(Boolean));
  result.complete = true; result.completedAt = new Date().toISOString(); save();
  fs.writeFileSync(path.join(repo, 'deployment/cloud-application-latest.json'), JSON.stringify({ report: path.basename(reportFile), run, complete: true }, null, 2));
  console.log(JSON.stringify({ complete: true, report: path.basename(reportFile), checksPassed: result.checks.length, originalRecordsPreserved: true, memory: result.memoryAfterRetrieval, ragApi: result.ragApi }));
 } catch (e) {
  result.complete = false; result.failure = /^(Check failed:|Probe failed:|Probe timeout|Startup timeout)/.test(e.message) ? e.message : e.code || 'CLOUD_VERIFICATION_FAILED'; save();
  console.error(JSON.stringify({ complete: false, report: path.basename(reportFile), failure: result.failure })); process.exitCode = 1;
 } finally { await stop(); await db.close(); }
}
main().catch(() => { console.error(JSON.stringify({ event: 'cloud_test_refused' })); process.exitCode = 1; });
