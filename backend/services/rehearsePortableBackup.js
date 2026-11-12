const { PGlite } = require('@electric-sql/pglite');
const { CORE, ident, inspect } = require('./postgresOperations');
const { open } = require('./portableBackup');
const { tablesFor,orderColumns } = require('./logicalBackup');
const canonical = rows => JSON.stringify(rows.map(row => JSON.stringify(Object.fromEntries(Object.entries(row).sort()))).sort());
async function rehearse(envelope, key) {
  const { snapshot } = open(envelope, key);
  return { ...await rehearseSnapshot(snapshot), dpapiUsedForRecovery: false };
}
async function rehearseSnapshot(snapshot) {
  // No DPAPI, filesystem database, network client or application startup.
  const db = new PGlite(), names = tablesFor(snapshot);
  try {
    const roles = new Set([...snapshot.metadata.grants, ...snapshot.metadata.sequenceGrants].map(g => g.grantee));
    for (const role of roles) if (!['PUBLIC', 'postgres'].includes(role)) await db.exec('CREATE ROLE ' + ident(role) + ' NOLOGIN');
    await db.exec('CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])');
    await db.exec(snapshot.restoreSql);
    const client = { query: (sql, params) => db.query(sql, params) }, actual = await inspect(client);
    for (const t of names) {
      if (!actual.fingerprints[t]) {
        const key = orderColumns(t).map(k=>'t.'+ident(k)).join(',');
        actual.fingerprints[t] = (await db.query("SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY " + key + ")::text,'[]')) AS digest FROM public." + ident(t) + ' t')).rows[0].digest;
      }
      if (actual.counts[t] !== snapshot.metadata.counts[t] || actual.fingerprints[t] !== snapshot.metadata.fingerprints[t]) throw Error('Recovery data mismatch');
    }
    for (const section of ['columns', 'constraints', 'indexes', 'tables', 'policies', 'grants', 'sequenceGrants']) {
      const normalize = rows => rows.filter(r => {
        // inspect() also inventories unrelated shared-project tables. Only the
        // explicitly captured application tables are part of this recovery.
        if (section === 'sequenceGrants') {
          if (!snapshot.sequences.some(s => s.sequencename === r.name)) return false;
        } else if (!names.includes(section === 'tables' ? r.name : r.table_name)) return false;
        if (section === 'constraints' && r.type === 'n') return false; // PG18 adds NOT NULL metadata.
        // Implicit owner sequence ACL expands when first made explicit. Owner rights
        // are intrinsic; preserve/compare every non-owner ACL and sequence owner.
        if (section === 'sequenceGrants' && snapshot.sequences.some(s => s.sequencename === r.name && s.sequenceowner === r.grantee)) return false;
        return true;
      }).map(r => section === 'policies' ? { ...r, roles: Array.isArray(r.roles) ? r.roles : require('pg').types.getTypeParser(1009)(r.roles) } : r);
      if (canonical(normalize(actual[section])) !== canonical(normalize(snapshot.metadata[section]))) throw Error('Recovery metadata mismatch: ' + section);
    }
    for (const sequence of snapshot.sequences) {
      const restored = actual.sequences.find(s => s.sequencename === sequence.sequencename);
      const expected = Object.fromEntries(Object.keys(restored || {}).map(k => [k, sequence[k]]));
      // pg returns bigint catalog fields as strings; PGlite returns safe numbers.
      const sequenceShape = row => Object.fromEntries(Object.entries(row).map(([k,v]) => [k,
        ['start_value','min_value','max_value','increment_by','cache_size'].includes(k) ? String(v) : v]));
      if (!restored || canonical([sequenceShape(restored)]) !== canonical([sequenceShape(expected)])) throw Error('Recovery sequence definition mismatch');
      const state = (await db.query('SELECT last_value::text,is_called FROM public.' + ident(sequence.sequencename))).rows[0];
      if (canonical([state]) !== canonical([sequence.state])) throw Error('Recovery sequence state mismatch');
    }
    return { verified: true, tableCounts: actual.counts, contentFingerprintsMatched: true,
      tableDefinitionsConstraintsIndexesMatched: true, sequenceDefinitionsAndStateMatched: true,
      rlsAndGrantsMatched: true, plaintextFilesWritten: false,
      remoteConnectionOpened: false, engine: 'in-memory PGlite PostgreSQL 18' };
  } finally { await db.close(); }
}
module.exports = { rehearse, rehearseSnapshot };
