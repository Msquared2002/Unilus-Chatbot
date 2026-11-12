const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../js/ticket-notifications.js'),'utf8');
test('actual widget exports the inbox controller consumed by the bell and morning brief',()=>{
 const context={document:{addEventListener(){}},UnilusAvatarEntitlements:{resolveEntitlements:()=>({})}};context.window=context;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../widget.js'),'utf8'),context);
 assert.equal(typeof context.window.UnilusWidget.showNotifications,'function');
});
const all=n=>n.children.flatMap(x=>[x,...all(x)]),content=n=>[n.textContent,...n.children.map(content)].join(' '),find=(n,label)=>all(n).find(x=>x.textContent===label);
function fixture(){
 const element=()=>({children:[],textContent:'',append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},setAttribute(){}});
 const main=element(),bellParent=element(),settings={before(n){bellParent.append(n);}},events={},calls=[],read=new Set();let current='synthetic-owner',interval,cleared=0;
 const items=[{id:5,category:'ticket',ticketRef:'UNI-2099-0001',message:'Staff replied.',createdAt:'2099-01-01T00:00:00Z',action:{type:'ticket',ticketRef:'UNI-2099-0001'}},{id:'timetable:change',category:'timetable',message:'Venue changed.',createdAt:'2099-01-02T00:00:00Z',action:{type:'timetable',programmeCode:'BIT41',group:'A1'}}];
 const document={hidden:false,createElement:element,querySelector:()=>main,getElementById:()=>settings,addEventListener:(event,fn)=>events[event]=fn};
 const window={UNILUS_API_BASE:'https://example.test/api',addEventListener:(event,fn)=>events[event]=fn};
 const context={document,window,Date,AbortController,sessionStorage:{getItem:()=>current},setInterval(fn){interval=fn;return 1;},clearInterval(){cleared++;},fetch:async(url,options)=>{
  calls.push({url,options});if(url.endsWith('/read'))read.add(decodeURIComponent(url.split('/').at(-2)));
  let data={unreadCount:items.filter(i=>!read.has(String(i.id))).length,items:items.map(i=>({...i,read:read.has(String(i.id))}))};
  if(url.includes('/ticket/'))data={ref:'UNI-2099-0001',status:'Resolved',department:'Academic Office',events:[{kind:'reply',body:'Actual synthetic staff reply'}]};
  if(url.includes('/notifications/timetable/'))data=[{course_code:'BIT400',class_group:'A1',day:'Monday',time:'10:00-12:00',venue_name:'Room B'},{course_code:'WRONG_GROUP',class_group:'A2'}];
  return{ok:true,json:async()=>data};
 }};
 vm.runInNewContext(source,context);return{main,bellParent,events,calls,context,document,flush:()=>new Promise(setImmediate),tick:()=>interval(),logout(){current=null;events['unilus-student-context-changed']();},cleared:()=>cleared};
}
test('one inbox shows both categories; selecting a ticket opens its details and marks it read',async()=>{
 const f=fixture();await f.flush();const box=f.main.children[0];assert.match(content(f.bellParent),/2/);assert.match(content(box),/Timetable/);assert.match(content(box),/Support/);
 await find(box,'Open ticket').onclick();await f.flush();assert.match(content(box),/Actual synthetic staff reply/);assert.match(content(f.bellParent),/1/);assert.ok(f.calls.some(c=>c.url.endsWith('/notifications/ticket/UNI-2099-0001')));
});
test('selecting a timetable alert opens the correct programme and group',async()=>{
 const f=fixture();await f.flush();const box=f.main.children[0];await find(box,'View updated timetable').onclick();await f.flush();assert.match(content(box),/Room B/);assert.doesNotMatch(content(box),/WRONG_GROUP/);assert.ok(f.calls.some(c=>c.url.endsWith('/notifications/timetable/timetable%3Achange')));
});
test('hidden/logout lifecycle clears polling and remount does not duplicate bells',async()=>{
 const f=fixture();await f.flush();const count=f.calls.length;f.document.hidden=true;f.events.visibilitychange();await f.tick();assert.equal(f.calls.length,count);assert.ok(f.cleared()>0);f.document.hidden=false;f.logout();await f.tick();assert.equal(f.calls.length,count);assert.equal(f.main.children[0].hidden,true);vm.runInNewContext(source,f.context);assert.equal(f.main.children.length,1);
});
test('responsive and keyboard styles retain mobile wrapping and visible focus',()=>{const css=fs.readFileSync(path.join(__dirname,'../../css/notifications.css'),'utf8');assert.match(css,/@media\(max-width:600px\)/);assert.match(css,/:focus-visible/);assert.match(css,/white-space:pre-wrap/);});
