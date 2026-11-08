const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {PGlite}=require('@electric-sql/pglite');
test('paged PostgreSQL snapshots preserve all records and detect external same-ID updates',async()=>{
 const pg=new PGlite();let transaction=false,pages=0;
 const query=async(sql,p=[])=>{let n=0;return pg.query(sql.replace(/\?/g,()=>'$'+ ++n),p);};
 const adapter={dialect:'postgres',schema(){},inTransaction:()=>transaction,get:async(s,p)=>(await query(s,p)).rows[0],all:async(s,p)=>{if(s.startsWith('SELECT id,payload'))pages++;return(await query(s,p)).rows;},exec:s=>pg.exec(s),transaction:async fn=>{await pg.exec('BEGIN');transaction=true;try{const r=await fn();await pg.exec('COMMIT');return r;}catch(e){await pg.exec('ROLLBACK');throw e;}finally{transaction=false;}}};
 try{
  await pg.exec('CREATE TABLE knowledge_records(id text PRIMARY KEY,payload text NOT NULL)');
  const records=Array.from({length:401},(_,i)=>({id:String(i).padStart(4,'0'),text:'synthetic '+i,metadata:{access:i%2?'public':'restricted'},embedding:Array(384).fill(0)}));
  await query('INSERT INTO knowledge_records VALUES '+records.map(()=>'(?,?)').join(','),records.flatMap(r=>[r.id,JSON.stringify(r)]));
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../services/databaseVectorStore.js'),'utf8'),{module,Buffer,performance,process:{env:{}},require:name=>name==='./db'?adapter:require(path.join(__dirname,'../services',name))});
  const store=new module.exports.DatabaseVectorStore();
  assert.equal((await store.list()).length,401);assert.equal(pages,3);
  assert.equal((await store.list({filter:m=>m.access==='public'})).length,200);assert.equal(pages,3);
  const updated={...records[0],text:'updated synthetic source'};await query('UPDATE knowledge_records SET payload=? WHERE id=?',[JSON.stringify(updated),updated.id]);
  assert.equal((await store.list())[0].text,updated.text);assert.equal(pages,6);
 }finally{await pg.close();}
});
