const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path');
test('malformed production configuration exits with sanitized metadata rather than leaking URL input',()=>{
 const sensitive='synthetic-private-value-that-must-not-be-logged';
 const r=spawnSync(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,NODE_ENV:'production',DATABASE_URL:sensitive},encoding:'utf8',timeout:10000});
 assert.equal(r.status,1);assert.ok(r.stderr.includes('backend_startup_failed'));assert.ok(!r.stderr.includes(sensitive));assert.ok(!r.stdout.includes(sensitive));
});
