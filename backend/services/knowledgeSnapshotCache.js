// One bounded raw corpus snapshot, never a cache of user-specific answers.
class KnowledgeSnapshotCache {
 constructor(maxBytes=32*1024*1024){this.maxBytes=maxBytes;this.epoch=0;this.value=null;this.pending=null;}
 invalidate(){this.epoch++;this.value=null;this.pending=null;}
 async get(revision,load){
  if(this.pending)return this.pending;
  const epoch=this.epoch;
  const pending=(async()=>{
   const version=await revision();
   if(this.value?.version===version)return {...this.value,cacheHit:true};
   const value={...await load(),version,cacheHit:false};
   if(epoch===this.epoch)this.value=value.bytes<=this.maxBytes?value:null;
   return value;
  })();
  this.pending=pending;
  try{return await pending;}finally{if(this.pending===pending)this.pending=null;}
 }
}
module.exports={KnowledgeSnapshotCache};
