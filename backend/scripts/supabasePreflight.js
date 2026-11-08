const fs = require('node:fs');
const { readOnly, inspect } = require('../services/postgresOperations');
const args = process.argv.slice(2); const option = key => args[args.indexOf(key) + 1];
(async () => {
  if (!args.includes('--env') || !args.includes('--out')) throw Error('Use --env private-config --out metadata-report');
  const report = await readOnly(option('--env'), inspect);
  fs.writeFileSync(option('--out'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ project: report.project, role: report.identity.role, readOnly: report.identity.read_only, counts: report.counts,
    duplicateActiveTicketGroups: report.duplicateActiveTicketGroups, tables: report.tables.map(t => ({ name: t.name, rls: t.rls })), buckets: report.buckets.length }));
})().catch(e => { console.error(JSON.stringify({ event: 'preflight_failed', code: e.code || 'CONFIGURATION_OR_QUERY_ERROR' })); process.exitCode = 1; });
