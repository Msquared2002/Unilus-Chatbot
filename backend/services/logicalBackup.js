const fs = require('node:fs'), crypto = require('node:crypto'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const { CORE, APPLICATION, ident, literal, inspect } = require('./postgresOperations');
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
function tablesFor(snapshot) {
  if (!snapshot.tableNames) return CORE;
  const expected = APPLICATION.concat('schema_migrations');
  if (JSON.stringify(snapshot.tableNames) !== JSON.stringify(expected)) throw Error('Unsupported backup scope');
  return expected;
}
const policyRoles = roles => Array.isArray(roles) ? roles : require('pg').types.getTypeParser(1009)(roles);
function validateSnapshot(snapshot) {
  if (snapshot.format !== 'unilus-core-logical-v1') throw Error('Unsupported backup');
  const names = tablesFor(snapshot);
  for (const name of names) {
    if (!Array.isArray(snapshot.data[name]) || snapshot.data[name].length !== snapshot.metadata.counts[name]) throw Error('Backup count mismatch');
    const columns = snapshot.metadata.columns.filter(c => c.table_name === name);
    if (!columns.length || columns.some(c => !['integer', 'text'].includes(c.type) || c.identity || c.generated)) throw Error('Schema requires native pg_dump review');
    if (snapshot.data[name].some(row => Object.keys(row).sort().join() !== columns.map(c => c.name).sort().join())) throw Error('Backup column mismatch');
  }
  if (snapshot.metadata.triggers.some(t => names.includes(t.table_name)) ||
      snapshot.metadata.constraints.some(c => names.includes(c.table_name) && !['p', 'u', 'n'].includes(c.type))) throw Error('Schema dependencies require native pg_dump');
}
function restoreSql(snapshot) {
  validateSnapshot(snapshot); const m = snapshot.metadata;
  const sql = ['-- Restore ONLY into a reviewed EMPTY recovery database. Never overwrite the shared project.', 'BEGIN;', 'SET LOCAL search_path = public, pg_catalog;', 'SET LOCAL standard_conforming_strings = on;'];
  for (const s of snapshot.sequences) {
    sql.push(`CREATE SEQUENCE public.${ident(s.sequencename)} AS ${s.data_type || 'integer'} INCREMENT BY ${s.increment_by} MINVALUE ${s.min_value} MAXVALUE ${s.max_value} START WITH ${s.start_value} CACHE ${s.cache_size} ${s.cycle ? 'CYCLE' : 'NO CYCLE'};`);
  }
  for (const name of tablesFor(snapshot)) {
    const columns = m.columns.filter(c => c.table_name === name);
    sql.push(`CREATE TABLE public.${ident(name)} (${columns.map(c => ident(c.name) + ' ' + c.type + (c.default_expression ? ' DEFAULT ' + c.default_expression : '') + (c.not_null ? ' NOT NULL' : '')).join(',')});`);
    for (const row of snapshot.data[name]) sql.push(`INSERT INTO public.${ident(name)} (${columns.map(c => ident(c.name)).join(',')}) VALUES (${columns.map(c => literal(row[c.name])).join(',')});`);
    // PG18 exposes NOT NULL constraints separately; column NOT NULL already restores them.
    for (const c of m.constraints.filter(c => c.table_name === name && c.type !== 'n')) sql.push(`ALTER TABLE public.${ident(name)} ADD CONSTRAINT ${ident(c.name)} ${c.definition};`);
    const constraintIndexes = new Set(m.constraints.filter(c => c.table_name === name).map(c => c.index_name));
    for (const i of m.indexes.filter(i => i.table_name === name && !constraintIndexes.has(i.name))) sql.push(i.definition + ';');
    sql.push(`ALTER TABLE public.${ident(name)} OWNER TO ${ident(m.tables.find(t => t.name === name).owner)};`);
    sql.push(`REVOKE ALL ON public.${ident(name)} FROM PUBLIC;`);
    for (const g of m.grants.filter(g => g.table_name === name)) sql.push(`GRANT ${g.privilege_type} ON public.${ident(name)} TO ${g.grantee === 'PUBLIC' ? 'PUBLIC' : ident(g.grantee)}${g.is_grantable ? ' WITH GRANT OPTION' : ''};`);
    for (const p of m.policies.filter(p => p.table_name === name)) sql.push(`CREATE POLICY ${ident(p.name)} ON public.${ident(name)} AS ${p.permissive} FOR ${p.cmd} TO ${policyRoles(p.roles).map(r => r === 'public' ? 'PUBLIC' : ident(r)).join(',')}${p.qual ? ' USING (' + p.qual + ')' : ''}${p.with_check ? ' WITH CHECK (' + p.with_check + ')' : ''};`);
    const table = m.tables.find(t => t.name === name);
    if (table.rls) sql.push(`ALTER TABLE public.${ident(name)} ENABLE ROW LEVEL SECURITY;`);
    if (table.force_rls) sql.push(`ALTER TABLE public.${ident(name)} FORCE ROW LEVEL SECURITY;`);
  }
  for (const s of snapshot.sequences) {
    sql.push(`ALTER SEQUENCE public.${ident(s.sequencename)} OWNED BY public.${ident(s.table_name)}.${ident(s.column_name)};`);
    sql.push(`ALTER SEQUENCE public.${ident(s.sequencename)} OWNER TO ${ident(s.sequenceowner)};`);
    sql.push(`SELECT pg_catalog.setval(${literal('public.' + ident(s.sequencename))}::regclass,${s.state.last_value},${s.state.is_called ? 'true' : 'false'});`);
    sql.push(`REVOKE ALL ON SEQUENCE public.${ident(s.sequencename)} FROM PUBLIC;`);
    for (const g of m.sequenceGrants.filter(g => g.name === s.sequencename)) sql.push(`GRANT ${g.privilege_type} ON SEQUENCE public.${ident(s.sequencename)} TO ${g.grantee === 'PUBLIC' ? 'PUBLIC' : ident(g.grantee)}${g.is_grantable ? ' WITH GRANT OPTION' : ''};`);
  }
  sql.push('COMMIT;'); return sql.join('\n');
}
async function capture(client, { integrated = false } = {}) {
  const metadata = await inspect(client), data = {}, sequences = [];
  const names = integrated ? APPLICATION.concat('schema_migrations') : CORE;
  for (const name of names) {
    if (!metadata.tables.some(t => t.name === name)) throw Error('Missing original core table');
    const key = name === 'schema_migrations' ? 'version' : name === 'ticket_assignments' ? 'ticket_ref' : 'id';
    data[name] = (await client.query('SELECT * FROM public.' + ident(name) + ' ORDER BY ' + ident(key))).rows;
    if (integrated) metadata.fingerprints[name] = (await client.query("SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t." + ident(key) + ")::text,'[]')) AS digest FROM public." + ident(name) + ' t')).rows[0].digest;
    for (const c of metadata.columns.filter(c => c.table_name === name && /nextval/.test(c.default_expression || ''))) {
      const qualified = (await client.query('SELECT pg_get_serial_sequence($1,$2) AS name', ['public.' + name, c.name])).rows[0].name;
      const sequence = metadata.sequences.find(s => qualified === 'public.' + s.sequencename || qualified === 'public.' + ident(s.sequencename));
      if (!sequence) throw Error('Missing sequence metadata');
      const state = (await client.query('SELECT last_value::text,is_called FROM public.' + ident(sequence.sequencename))).rows[0];
      sequences.push({ ...sequence, table_name: name, column_name: c.name, state });
    }
  }
  const snapshot = { format: 'unilus-core-logical-v1', metadata, data, sequences };
  if (integrated) snapshot.tableNames = names;
  snapshot.restoreSql = restoreSql(snapshot); return snapshot;
}
function dpapi(mode, bytes) {
  return execFileSync(process.env.BACKUP_PYTHON || 'python', [path.join(__dirname, '../scripts/protectBackup.py'), mode], { input: bytes, windowsHide: true, maxBuffer: 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
}
function seal(snapshot, protect = bytes => dpapi('protect', bytes)) {
  validateSnapshot(snapshot); const key = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const payload = Buffer.from(JSON.stringify(snapshot));
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const envelope = { format: 'unilus-dpapi-aes256gcm-v1', key: protect(key).toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
  key.fill(0); return { envelope, payloadSha256: sha256(payload) };
}
function open(envelope, unprotect = bytes => dpapi('unprotect', bytes)) {
  if (envelope.format !== 'unilus-dpapi-aes256gcm-v1') throw Error('Unsupported encrypted backup');
  const key = unprotect(Buffer.from(envelope.key, 'base64'));
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    const bytes = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
    const snapshot = JSON.parse(bytes); validateSnapshot(snapshot);
    if (snapshot.restoreSql !== restoreSql(snapshot)) throw Error('Recovery SQL mismatch');
    return { snapshot, payloadSha256: sha256(bytes) };
  } finally { key.fill(0); }
}
module.exports = { capture, restoreSql, validateSnapshot, seal, open, sha256, tablesFor };
