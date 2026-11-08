const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
function node(){return{children:[],events:{},dataset:{},hidden:true,appendChild(x){this.children.push(x);},replaceChildren(){this.children=[];},addEventListener(k,f){this.events[k]=f;}};}
test('D1 map reopens after a failed load, deduplicates concurrent requests and caches success',async()=>{
 let calls=0,reject,resolve,mapCount=0,rendered=0;
 const ctx={window:{},console:{error(){}},document:{},requestAnimationFrame:f=>f(),CampusDataClient:{load:()=>{calls++;return new Promise((a,b)=>{resolve=a;reject=b;});}},L:{map:()=>{mapCount++;return{invalidateSize(){},setMaxBounds(){},setView(){rendered++;}};},tileLayer:()=>({addTo(){}}),layerGroup:()=>({addTo(){return this;},clearLayers(){}})}};
 vm.runInNewContext(read('campus-map.js'),ctx);const map=ctx.window.CampusMap;
 const element={dataset:{wrapped:true},closest:()=>null};const first=map.init({mapEl:element});map.show();assert.equal(calls,1);reject(Error('startup 503'));await first;await tick();
 map.show();map.show();assert.equal(calls,2);resolve({silverest:{available:true,center:[0,0],zoom:17,buildings:[]}});await tick();assert.ok(rendered>0);assert.equal(mapCount,1);
 map.show();await map.openCampus('silverest');assert.equal(calls,2);
});
function gps(geolocation){const statuses=[],ctx={window:{},navigator:geolocation?{geolocation}:{},L:{circleMarker:()=>({addTo(){return this;}}),circle:()=>({addTo(){return this;}})}};vm.runInNewContext(read('campus-location.js'),ctx);return{service:ctx.window.CampusLocation,statuses};}
test('D2 repeated cached recenter completes every time without another GPS request',()=>{
 let requests=0,flies=0,disabled=false;const g=gps({getCurrentPosition(ok){requests++;ok({coords:{latitude:0,longitude:0,accuracy:5}});}}),map={flyTo(){flies++;},getZoom:()=>17,removeLayer(){}};
 for(let i=0;i<3;i++){disabled=true;g.service.recenter(map,[[-1,-1],[-1,1],[1,1],[1,-1]],message=>{g.statuses.push(message);if(!message.includes('Finding'))disabled=false;});assert.equal(disabled,false);}
 assert.equal(requests,1);assert.equal(flies,3);
});
test('D2 unsupported GPS, denial, unavailable and timeout all finish the control status',()=>{
 for(const code of [null,1,2,3]){const g=gps(code===null?null:{getCurrentPosition(ok,fail){fail({code});}});let disabled=true;g.service.recenter({},[],message=>{if(!message.includes('Finding'))disabled=false;g.statuses.push(message);});assert.equal(disabled,false);assert.match(g.statuses.at(-1),code===1?/denied/:code===3?/timed out/:/unavailable/);}
});
function search(){const box=node(),input=node(),results=node(),toolbar=node(),view=node(),timers=[],pending=[],statuses=[];box.querySelector=s=>s==='input'?input:results;view.querySelector=s=>s==='.map-search'?null:toolbar;
 const ctx={window:{},document:{createElement:tag=>tag==='div'?box:node()},setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout(){},CampusDataClient:{API_BASE:'/api/campus'},fetch:url=>new Promise((resolve,reject)=>pending.push({url,resolve,reject}))};vm.runInNewContext(read('campus-search.js'),ctx);ctx.window.CampusSearch.mount(view,()=>{},s=>statuses.push(s));return{input,results,timers,pending,statuses};}
test('D4 clearing input invalidates an already-running response',async()=>{const s=search();s.input.value='library';s.input.events.input();const task=s.timers.at(-1)();s.input.value='';s.input.events.input();s.pending[0].resolve({ok:true,json:async()=>[{place:{id:'library',name:'Library'}}]});await task;assert.equal(s.results.hidden,true);assert.equal(s.results.children.length,0);});
test('D4 changed input invalidates results before debounce; only latest query appears',async()=>{const s=search();s.input.value='library';s.input.events.input();const old=s.timers.at(-1)();s.input.value='hospital';s.input.events.input();s.pending[0].resolve({ok:true,json:async()=>[{place:{id:'library',name:'Library'}}]});await old;assert.equal(s.results.hidden,true);const latest=s.timers.at(-1)();s.pending[1].resolve({ok:true,json:async()=>[{place:{id:'hospital',name:'Hospital'}}]});await latest;assert.equal(s.results.hidden,false);assert.equal(s.results.children[0].textContent,'Hospital');});
test('D4 stale failures do not override a newer query status',async()=>{const s=search();s.input.value='library';s.input.events.input();const old=s.timers.at(-1)();s.input.value='hospital';s.input.events.input();s.pending[0].reject(Error('offline'));await old;assert.equal(s.statuses.length,0);});
