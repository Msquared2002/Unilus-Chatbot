const test=require('node:test'),assert=require('node:assert/strict');process.env.SQLITE_FILE=':memory:';const db=require('../services/db');const {DatabaseVectorStore}=require('../services/databaseVectorStore');
test.after(()=>db.close());
test('request snapshot dense ranking preserves scores and filters without another read',async()=>{
 const s=new DatabaseVectorStore();const records=[{id:'yes',text:'a',metadata:{source_file:'a'},embedding:Array(384).fill(1)},{id:'no',text:'b',metadata:{source_file:'b'},embedding:Array(384).fill(0)}];
 s.list=()=>{throw Error('Redundant corpus read');};
 const hits=await s.search(Array(384).fill(1),{records,filter:m=>m.source_file==='a'});
 assert.deepEqual(hits.map(r=>r.id),['yes']);assert.ok(Math.abs(hits[0].score-1)<1e-12);
});
test('transaction rollback leaves valid knowledge intact',async()=>{const s=new DatabaseVectorStore();const original={id:'original',text:'verified source',metadata:{source_file:'a.txt'},embedding:Array(384).fill(0)};await s.upsert([original]);await assert.rejects(db.transaction(async()=>{await s.removeWhere(()=>true);throw Error('simulated failure');}));assert.equal(await s.count(),1);await s.replaceSource('a.txt',[{...original,id:'new'}]);assert.equal((await s.list())[0].id,'new');await assert.rejects(s.replaceSource('a.txt',[{...original,id:'bad',embedding:[1]}]));assert.equal((await s.list())[0].id,'new');});
