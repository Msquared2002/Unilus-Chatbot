const test=require('node:test'),assert=require('node:assert/strict');
const {searchRecords,prepareRecords}=require('../services/lexicalSearchService');
test('prepared lexical documents preserve exact BM25 scores, ranking and filtered IDF',()=>{
 const records=[{id:'a',text:'student housing residence policy housing',metadata:{access:'public'}},{id:'b',text:'student housing policy fees',metadata:{access:'restricted'}}];
 prepareRecords(records);
 for(const filter of [null,m=>m.access==='public'])assert.deepEqual(searchRecords('housing policy',records,{filter}),searchRecords('housing policy',records,{filter,cache:false}));
});
test('record changes and replacement snapshots do not reuse obsolete term counts',()=>{
 const r={id:'a',search_text:'housing',metadata:{}};searchRecords('housing',[r]);r.search_text='library';
 assert.deepEqual(searchRecords('housing',[r]),[]);assert.equal(searchRecords('library',[{...r}])[0].id,'a');
});
