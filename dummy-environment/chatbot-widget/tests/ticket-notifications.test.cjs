const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('portal notifications poll only signed-in visible pages and persist read acknowledgement through API',async()=>{
 const node=()=>({children:[],textContent:'',hidden:false,append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},setAttribute(){}});
 const main=node(),events={},calls=[];let token='synthetic-token',tick,read=false;
 const document={hidden:false,createElement:node,querySelector:()=>({prepend(box){main.children.unshift(box);}}),addEventListener:(name,fn)=>events[name]=fn};
 const window={UNILUS_API_BASE:'https://example.test/api',addEventListener:(name,fn)=>events[name]=fn};
 const context={document,window,sessionStorage:{getItem:()=>token},setInterval(fn,ms){tick=fn;assert.equal(ms,30000);},fetch:async(url,options)=>{calls.push({url,options});if(options.method==='POST')read=true;return{ok:true,json:async()=>({unreadCount:read?0:1,items:[{id:7,ticketRef:'UNI-2099-0001',message:'Staff replied to your support ticket.',read}]})};}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../js/ticket-notifications.js'),'utf8'),context);
 const flush=async()=>{await new Promise(setImmediate);};await flush();
 const box=main.children[0];assert.match(box.children[0].textContent,/1 unread/);assert.equal(box.hidden,false);
 const button=box.children[1].children[0].children[1];await button.onclick();await flush();assert.match(box.children[0].textContent,/0 unread/);
 assert.equal(calls.filter(c=>c.options.method==='POST').length,1);
 const count=calls.length;document.hidden=true;await tick();assert.equal(calls.length,count);
 document.hidden=false;token=null;events['unilus-student-context-changed']();await tick();assert.equal(calls.length,count);assert.equal(box.hidden,true);assert.equal(box.children[1].children.length,0);
});
