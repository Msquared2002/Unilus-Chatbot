// Run in the bounded Linux container with database forced read-only.
const fs=require('node:fs'),db=require('../services/db');
let stage='configuration';
async function main(){
 const queries=[];let parses=0,parseMs=0;
 const originalAll=db.all,originalParse=JSON.parse;
 db.all=async(sql,params)=>{const at=performance.now();const rows=await originalAll(sql,params);if(/^SELECT (?:id,)?payload FROM knowledge_records/.test(sql))queries.push({ms:performance.now()-at,rows:rows.length,bytes:rows.reduce((n,r)=>n+Buffer.byteLength(r.payload),0)});return rows;};
 JSON.parse=function(value,...args){const at=performance.now();try{return originalParse(value,...args);}finally{if(typeof value==='string'&&value.length>1000&&value.includes('"embedding"')){parses++;parseMs+=performance.now()-at;}}};
 try{
  stage='connections';const connections=[];for(let i=0;i<3;i++){let at=performance.now();await db.get('SELECT 1 AS ok');connections.push(performance.now()-at);}
  stage='explain';const explain=await db.get('EXPLAIN (ANALYZE,FORMAT JSON) SELECT payload FROM knowledge_records ORDER BY id');
  stage='model';let at=performance.now();await require('../services/embeddingService').createEmbedding('Model warmup');const modelLoadMs=performance.now()-at;
  const knowledge=require('../services/knowledgeService'),results=[];
  const question='What are the university student housing and residence policies?';
  for(let i=0;i<(process.env.PROFILE_VARIANT==='baseline'?1:3);i++){
   stage='retrieval-'+i;const stages=[],before=queries.length,p=parses,pm=parseMs;at=performance.now();
   const hits=await knowledge.searchKnowledge(question,{onTiming:m=>stages.push(m)});
   results.push({iteration:i,totalMs:performance.now()-at,stages,corpusQueries:queries.slice(before),payloadParses:parses-p,jsonParseMs:parseMs-pm,storeProfile:knowledge.getStore().profile||null,hitIds:hits.map(h=>h.id),memory:process.memoryUsage()});
  }
  stage='concurrent';const before=queries.length;at=performance.now();
  const pair=process.env.PROFILE_VARIANT==='baseline'?[[],[]]:await Promise.all([knowledge.searchKnowledge(question),knowledge.searchKnowledge(question)]);
  const result={connectionsMs:connections,postgresExecutionMs:explain['QUERY PLAN'][0]['Execution Time'],modelLoadMs,results,concurrent:{requests:process.env.PROFILE_VARIANT==='baseline'?0:2,skipped:process.env.PROFILE_VARIANT==='baseline',totalMs:performance.now()-at,corpusQueries:queries.slice(before),sameHits:JSON.stringify(pair[0].map(r=>r.id))===JSON.stringify(pair[1].map(r=>r.id))},maxRssKiB:process.resourceUsage().maxRSS};
  fs.writeFileSync('/tmp/retrieval-profile.json',JSON.stringify(result));console.log(JSON.stringify(result));
 }finally{JSON.parse=originalParse;await db.close();}
}
main().catch(e=>{console.error(JSON.stringify({event:'retrieval_profile_failed',stage,code:e.code||'PROFILE_FAILED',kind:e.name,location:(e.stack||'').match(/profileHostingRetrieval\.js:\d+:\d+/)?.[0]}));process.exitCode=1;});
