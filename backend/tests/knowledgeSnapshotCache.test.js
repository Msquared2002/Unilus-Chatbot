const test=require('node:test'),assert=require('node:assert/strict');
const {KnowledgeSnapshotCache}=require('../services/knowledgeSnapshotCache');
test('bounded snapshot coalesces reads, detects external updates and invalidates publication',async()=>{
 const c=new KnowledgeSnapshotCache(20);let version='a',loads=0;
 const revision=async()=>version,load=async()=>({records:[version],bytes:10,serial:++loads});
 const first=await Promise.all([c.get(revision,load),c.get(revision,load)]);assert.equal(loads,1);assert.equal(first[0].serial,first[1].serial);
 assert.equal((await c.get(revision,load)).cacheHit,true);
 version='b';assert.deepEqual((await c.get(revision,load)).records,['b']);assert.equal(loads,2);
 c.invalidate();await c.get(revision,load);assert.equal(loads,3);
 const small=new KnowledgeSnapshotCache(1);await small.get(revision,load);await small.get(revision,load);assert.equal(small.value,null);
});
test('a load crossing invalidation cannot repopulate an obsolete snapshot',async()=>{
 const c=new KnowledgeSnapshotCache();let release;
 const pending=c.get(async()=>1,()=>new Promise(r=>release=r));await new Promise(setImmediate);
 c.invalidate();release({records:['obsolete'],bytes:1});await pending;assert.equal(c.value,null);
 await assert.rejects(c.get(async()=>{throw Error('database unavailable');},async()=>({})));assert.equal(c.pending,null);
});
