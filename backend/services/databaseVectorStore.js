const db=require('./db');const {cosineSimilarity}=require('./embeddingService');
db.schema({sqlite:[`CREATE TABLE IF NOT EXISTS knowledge_records(id TEXT PRIMARY KEY,payload TEXT NOT NULL)`],postgres:[`CREATE TABLE IF NOT EXISTS knowledge_records(id TEXT PRIMARY KEY,payload TEXT NOT NULL)`]});
async function lockWriter(){if(db.dialect==='postgres')await db.get('SELECT pg_advisory_xact_lock(hashtext(?))',['unilus-knowledge-writer']);}
class DatabaseVectorStore {
 constructor(){this.cache=new(require('./knowledgeSnapshotCache').KnowledgeSnapshotCache)(Number(process.env.KNOWLEDGE_CACHE_MAX_BYTES)||32*1024*1024);this.profile={};}
 invalidate(){this.cache.invalidate();}
 async loadRecords(){
  const load=async()=>{
   const records=[];let bytes=0,transferMs=0,parseMs=0,after=null;
   do{
    let at=performance.now();
    const rows=db.dialect==='postgres'
     ?await db.all('SELECT id,payload FROM knowledge_records'+(after===null?'':' WHERE id > ?')+' ORDER BY id LIMIT 200',after===null?[]:[after])
     :await db.all('SELECT payload FROM knowledge_records ORDER BY id');
    transferMs+=performance.now()-at;at=performance.now();
    for(const row of rows){records.push(JSON.parse(row.payload));bytes+=Buffer.byteLength(row.payload);}
    parseMs+=performance.now()-at;
    if(db.dialect!=='postgres'||rows.length<200)break;
    after=rows.at(-1).id;
   }while(true);
   return {records,bytes,transferMs,parseMs};
  };
  if(db.dialect==='postgres'&&!db.inTransaction())return db.transaction(async()=>{await db.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');return load();});
  return load();
 }

 async list({filter=null}={}){
  let revisionMs=0;
  const value=db.dialect==='postgres'&&!db.inTransaction()&&process.env.KNOWLEDGE_CACHE!=='off'
   ?await this.cache.get(async()=>{const at=performance.now();const r=await db.get("SELECT md5(COALESCE(string_agg(id||md5(payload),',' ORDER BY id),'')) AS revision FROM knowledge_records");revisionMs=performance.now()-at;return r.revision;},()=>this.loadRecords())
   :{...await this.loadRecords(),cacheHit:false};
  this.profile={revisionMs,cacheHit:value.cacheHit,payloadBytes:value.cacheHit?0:value.bytes,transferMs:value.cacheHit?0:value.transferMs,parseMs:value.cacheHit?0:value.parseMs};
  return filter?value.records.filter(r=>filter(r.metadata||{})):value.records;
 }
 async count(){return Number((await db.get('SELECT COUNT(*) AS n FROM knowledge_records')).n);}
 validate(records){for(const r of records)if(!r.id||!r.metadata||!Array.isArray(r.embedding)||r.embedding.length!==384||r.embedding.some(x=>!Number.isFinite(x)))throw Error('Expected a provenance-backed 384-dimensional embedding');}
 async upsert(records){this.validate(records);await db.transaction(async()=>{await lockWriter();for(const r of records)await db.run('INSERT INTO knowledge_records(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',[r.id,JSON.stringify(r)]);});this.invalidate();}
 async removeWhere(predicate){return db.transaction(async()=>{await lockWriter();const removed=(await this.list()).filter(predicate);for(const r of removed)await db.run('DELETE FROM knowledge_records WHERE id = ?',[r.id]);return removed.length;}).finally(()=>this.invalidate());}
 async replaceSource(source,records){this.validate(records);return db.transaction(async()=>{await lockWriter();const n=await this.removeWhere(r=>r.metadata.source_file===source);await this.upsert(records);return n;}).finally(()=>this.invalidate());}
 async clear(){await db.run('DELETE FROM knowledge_records');this.invalidate();}
 reload(){}
 async search(vector,{topK=5,filter=null,minScore=0,records=null}={}){return (records?(filter?records.filter(r=>filter(r.metadata||{})):records):await this.list({filter})).map(r=>({id:r.id,text:r.text,search_text:r.search_text,metadata:r.metadata,score:cosineSimilarity(vector,r.embedding)})).filter(r=>r.score>=minScore).sort((a,b)=>b.score-a.score).slice(0,topK);}
}
module.exports={DatabaseVectorStore};
