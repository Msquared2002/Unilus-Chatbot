const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {load}=require('../../../backend/node_modules/cheerio');
const {assessmentConfiguration,assessmentRecord,courseResults,semesterOutcome}=require('../../../backend/services/undergraduateAcademicPolicy');
const source=fs.readFileSync(path.join(__dirname,'../../js/demo-academics.js'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function course(code,scores,exam=null){const assessments=assessmentConfiguration().map((component,i)=>assessmentRecord(component,scores[i],scores[i]===null?'pending':'available'));return {code,name:'Synthetic '+code,assessments,...courseResults(assessments,exam)};}
function profile(){
 const current={key:'2-2',year:2,semester:2,academicYear:2026,completed:false,courses:[course('BIT214',[8,16,0,0]),course('BIT256',[0,0,0,0]),course('BIT242',[0,null,0,0])]};
 const previous={key:'2-1',year:2,semester:1,academicYear:2026,completed:true,courses:[course('BIT214',[8,16,0,0],44)]};previous.outcome=semesterOutcome(previous);
 return {id:'synthetic-profile-a',sessionId:'synthetic-session-a',accountUsername:'synthetic-a',name:'Fictional Student',studentNumber:'DEMO-SYNTHETIC',modelVersion:4,programme:'BIT',programmeId:'bachelor-of-science-in-information-systems-and-technology',programmeName:'Information Systems and Technology',activePeriod:'2-2',periods:[previous,current]};
}
async function portal(data=profile()){
 const values=new Map([['unilusAuthToken','synthetic-jwt']]),events={},calls=[],dispatched=[];let selectedPeriod=null;
 function element(){return {events:{},value:'',hidden:false,disabled:false,open:false,attributes:{},textContent:'',addEventListener(name,fn){this.events[name]=fn;},setAttribute(k,v){this.attributes[k]=v;},focus(){},classList:{toggle(){},remove(){},add(){}}};}
 const view=element(),period=element(),settings=element(),trigger=element(),mode=element(),programme=element();mode.value='keep';
 Object.defineProperty(view,'innerHTML',{get(){return this.html||'';},set(html){this.html=html;const selected=load(html)('[data-academic-period] option[selected]').attr('value');if(selected)selectedPeriod=selected;}});
 view.replaceChildren=()=>{view.innerHTML='';selectedPeriod=null;};
 Object.defineProperty(period,'value',{get:()=>selectedPeriod,set:value=>{selectedPeriod=value;}});
 view.querySelector=selector=>selector==='[data-academic-period]'?period:selector==='[data-print-results]'?load(view.innerHTML)('[data-print-results]').length?element():null:null;
 settings.querySelector=selector=>selector==='summary'?trigger:mode;
 const elements=new Map([['[data-academic-view]',view],['[data-profile-message]',element()],['[data-profile-controls] details',settings],['[data-profile-controls]',element()],['[data-profile-mode]',mode],['[data-profile-programme]',programme],['[data-new-demo-profile]',element()],['.portal-breadcrumb',element()],['.portal-sidebar',element()],['.portal-menu-toggle',element()]]);
 const ctx={location:{hash:'#ca-marks'},sessionStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},Event:class{constructor(type){this.type=type;}},document:{body:element(),querySelector:selector=>selector==='[data-academic-period]'?selectedPeriod?period:null:elements.get(selector)||null,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener:(name,fn)=>events[name]=fn,dispatchEvent:event=>dispatched.push(event.type),scrollTo(){},print(){}},fetch:async(url,options)=>{
  calls.push({url,...options});assert.ok(url.startsWith('/api/demo-academics/'));assert.equal(options.headers.Authorization,'Bearer synthetic-jwt');
  const result=url.endsWith('programmes')?[{code:'BIT',name:'Information Systems and Technology'}]:options.method==='POST'?{...data,id:'synthetic-profile-new',sessionId:'synthetic-session-new'}:data;
  return {ok:true,json:async()=>JSON.parse(JSON.stringify(result))};
 }};
 vm.createContext(ctx);vm.runInContext(source,ctx);await tick();return {view,period,ctx,calls,values,events,elements,dispatched};
}
test('portal assessment cells are plain numbers, recorded zeros are complete and missing marks are dashes',async()=>{
 const p=await portal(),$=load(p.view.innerHTML);
 assert.deepEqual($('table th').map((i,e)=>$(e).text()).get(),['Course','Status','Assignment 1','Midexam 1','Practical','Project 1','Total CA']);
 const rows=$('tbody tr').toArray().map(row=>$(row).find('td').map((i,e)=>$(e).text()).get());
 assert.deepEqual(rows[0].slice(2),['8','16','0','0','24']);assert.deepEqual(rows[1].slice(2),['0','0','0','0','0']);assert.equal(rows[1][1],'Ready to view');assert.deepEqual(rows[2].slice(2),['0','—','0','0','—']);assert.equal(rows[2][1],'Awaiting upload');
 assert.doesNotMatch($.root().text(),/partial|N\/A|class tests|out of|\/(?:10|20|30|40|60|70|100)/i);assert.ok(p.calls.every(c=>c.method==='GET'));
});
test('completed Final Results renders only course name, code and verified letter grade',async()=>{
 const p=await portal();p.period.value='2-1';p.ctx.location.hash='#final-results';p.events.hashchange();const $=load(p.view.innerHTML);
 assert.deepEqual($('table th').map((i,e)=>$(e).text()).get(),['Course Name','Course Code','Grade']);assert.deepEqual($('tbody td').map((i,e)=>$(e).text()).get(),['Synthetic BIT214','BIT214','B+']);assert.doesNotMatch($.root().text(),/68|\/100|final examination|overall score/i);
});
test('older profiles remain hidden until explicit regeneration with the existing JWT',async()=>{
 const old={...profile(),modelVersion:2,requiresNewProfile:true,periods:[]},p=await portal(old);
 assert.equal(load(p.view.innerHTML)('table').length,0);assert.match(p.view.innerHTML,/Choose New Profile/);assert.equal(p.calls.filter(c=>c.method==='POST').length,0);
 await p.elements.get('[data-new-demo-profile]').events.click();const post=p.calls.find(c=>c.method==='POST');assert.equal(JSON.parse(post.body).expectedProfileId,old.id);assert.equal(p.values.get('unilusAuthToken'),'synthetic-jwt');assert.ok(p.dispatched.includes('unilus-demo-profile-changing'));assert.equal(p.values.get('unilusDemoAcademicProfileId'),'synthetic-profile-new');
});
