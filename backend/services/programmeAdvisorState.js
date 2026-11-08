const crypto=require('node:crypto');
function createStore({ttl=30*60*1000,max=500,now=Date.now}={}) {
 const states=new Map();
 function sweep(){for(const [id,s] of states)if(now()-s.updated>=ttl)states.delete(id);}
 return {get(id){sweep();const s=states.get(id);return s?structuredClone(s.profile):null;},set(id,profile){if(typeof id!=='string'||!id)return;sweep();if(!states.has(id)&&states.size>=max)states.delete(states.keys().next().value);states.set(id,{updated:now(),profile:structuredClone(profile)});},clear(id){states.delete(id);},newId(){return crypto.randomUUID();}};
}
module.exports={createStore,store:createStore()};
