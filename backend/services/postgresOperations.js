// Standalone operations tooling: never imports app.js or registers application schemas.
const fs = require('node:fs');
const { Client } = require('pg');
const CORE = ['conversations', 'feedback', 'staff_answers', 'tickets'];
const APPLICATION = [...CORE, 'chat_sessions', 'ticket_events', 'ticket_assignments', 'knowledge_records', 'managed_documents'];
const PROJECT = 'qhnspcstqvazxkqshuir';
const ident = value => '"' + String(value).replace(/"/g, '""') + '"';
const literal = value => value == null ? 'NULL' : typeof value === 'number' ? String(value) : "'" + String(value).replace(/'/g, "''") + "'";
function configuration(file, { migration = false } = {}) {
  const env = require('dotenv').parse(fs.readFileSync(file));
  const key = migration ? 'MIGRATION_DATABASE_URL' : 'DATABASE_URL';
  if (!env[key]) throw Error(key + ' must be explicitly configured');
  const url = new URL(env[key]);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname.endsWith('.pooler.supabase.com') ||
      !decodeURIComponent(url.username).endsWith('.' + PROJECT) || url.port !== '5432') throw Error('Expected this project session pooler on port 5432');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'options']) url.searchParams.delete(key);
  const caFile = env[migration ? 'MIGRATION_DATABASE_CA_FILE' : 'DATABASE_CA_FILE'] || env.DATABASE_CA_FILE || 'C:/UNILUS-secrets/supabase-ca.crt';
  return { env, options: { connectionString: url.toString(), ssl: { ca: fs.readFileSync(caFile, 'utf8'), rejectUnauthorized: true, servername: url.hostname },
    connectionTimeoutMillis: 10000, application_name: 'unilus_' + (migration ? 'approved_migration' : 'readonly_preflight'),
    options: '-c statement_timeout=60000 -c lock_timeout=5000' + (migration ? '' : ' -c default_transaction_read_only=on') } };
}
async function readOnly(file, fn) {
  const { options } = configuration(file); const client = new Client(options);
  try {
    await client.connect(); await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const value = await fn(client); await client.query('ROLLBACK'); return value;
  } finally { await client.end().catch(() => {}); }
}
async function inspect(client) {
  const names = APPLICATION.concat('schema_migrations');
  const q = async (sql, params = []) => (await client.query(sql, params)).rows;
  const identity = (await q("SELECT current_database() AS database,current_user AS role,current_setting('server_version') AS version,current_setting('transaction_read_only') AS read_only"))[0];
  const tables = await q("SELECT c.relname AS name,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname");
  const columns = await q("SELECT c.relname AS table_name,a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null,pg_get_expr(d.adbin,d.adrelid) AS default_expression,a.attidentity AS identity,a.attgenerated AS generated FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relname=ANY($1) AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum", [names]);
  const indexes = await q("SELECT tablename AS table_name,indexname AS name,indexdef AS definition FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname");
  const constraints = await q("SELECT c.relname AS table_name,x.conname AS name,x.contype AS type,pg_get_constraintdef(x.oid) AS definition,i.relname AS index_name FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_class i ON i.oid=x.conindid WHERE n.nspname='public' ORDER BY c.relname,x.conname");
  const policies = await q("SELECT tablename AS table_name,policyname AS name,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname");
  const grants = await q("SELECT c.relname AS table_name,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname='public' AND c.relkind='r' ORDER BY 1,2,3");
  const defaults = await q("SELECT pg_get_userbyid(a.defaclrole) AS owner,n.nspname AS schema,a.defaclobjtype AS type,a.defaclacl::text AS acl FROM pg_default_acl a LEFT JOIN pg_namespace n ON n.oid=a.defaclnamespace WHERE n.nspname='public' OR a.defaclnamespace=0");
  const roles = await q("SELECT rolname AS name,rolsuper,rolbypassrls,rolcanlogin,rolcreaterole,rolcreatedb,rolinherit FROM pg_roles WHERE rolname IN (current_user,'unilus_backend','anon','authenticated','service_role') ORDER BY rolname");
  const memberships = await q("SELECT r.rolname AS role,m.rolname AS member FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member WHERE m.rolname='unilus_backend'");
  const counts = {}, fingerprints = {};
  for (const t of tables.filter(t => names.includes(t.name))) {
    counts[t.name] = Number((await q('SELECT count(*) AS n FROM public.' + ident(t.name)))[0].n);
    if (CORE.includes(t.name)) fingerprints[t.name] = (await q("SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,'[]')) AS digest FROM public." + ident(t.name) + ' t'))[0].digest;
  }
  const duplicates = tables.some(t => t.name === 'tickets') ? Number((await q("SELECT count(*) AS n FROM (SELECT 1 FROM public.tickets WHERE status IN ('Open','In Progress') GROUP BY session_id,lower(question) HAVING count(*)>1) d"))[0].n) : 0;
  const buckets = await q('SELECT id,name,public,file_size_limit,allowed_mime_types FROM storage.buckets');
  const sequences = await q("SELECT schemaname,sequencename,sequenceowner,data_type::text,start_value,min_value,max_value,increment_by,cycle,cache_size FROM pg_sequences WHERE schemaname='public'");
  const sequenceGrants = await q("SELECT c.relname AS name,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('S',c.relowner))) a WHERE n.nspname='public' AND c.relkind='S'");
  const schemaGrants = await q("SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable FROM pg_namespace n CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='public'");
  const triggers = await q("SELECT c.relname AS table_name,t.tgname AS name,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal");
  return { project: PROJECT, capturedAt: new Date().toISOString(), identity, tables, columns, indexes, constraints, policies, grants, defaults, roles, memberships, counts, fingerprints, duplicateActiveTicketGroups: duplicates, buckets, sequences, sequenceGrants, schemaGrants, triggers };
}
module.exports = { CORE, APPLICATION, PROJECT, ident, literal, configuration, readOnly, inspect };
