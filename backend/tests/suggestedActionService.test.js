const test = require('node:test');
const assert = require('node:assert/strict');
const {selectActions} = require('../services/suggestedActionService');
const {validateAction} = require('../services/suggestedActionRegistry');
test('unsupported questions produce no actions',()=>assert.deepEqual(selectActions('hello',{}),[]));
test('counts vary with available timetable days and preserve scope',()=>{
 for(let n=0;n<=4;n++) {
 const result={queryType:{isTimetable:true,entities:{programmeFamily:'BIT',year:3,semester:2}}};
 const actions=selectActions('timetable',result,['Monday','Tuesday','Wednesday','Thursday'].slice(0,n).map(day=>({day})));
 assert.equal(actions.length,n);
 for(const a of actions) assert.match(a.payload.question,/BIT year 3 semester 2/);
 }
});
test('programme actions require evidence and identified programme',()=>{
 const p=require('../../dummy-environment/js/demo-programmes').programmes[0];
 assert.equal(selectActions(p.name,{sources:[{}]}).length,2);
 assert.equal(selectActions(p.name,{sources:[]}).length,0);
});
test('malformed and unknown actions rejected independently of labels',()=>{
 assert.equal(validateAction({id:'evil',type:'quick_reply',label:'View on map',payload:{question:'x'}}),false);
 assert.equal(validateAction({id:'timetable.day',type:'quick_reply',label:'Anything',payload:{question:'Show BIT Wednesday'}}),true);
 assert.equal(validateAction({id:'campus.map',type:'navigation',label:'Map',payload:{placeId:'x',campus:'silverest',url:'javascript:x'}}),false);
});
test('browser and server registries remain identical',()=>assert.equal(require('node:fs').readFileSync(require('node:path').join(__dirname,'../services/suggestedActionRegistry.js'),'utf8'),require('node:fs').readFileSync(require('node:path').join(__dirname,'../../dummy-environment/chatbot-widget/suggested-action-registry.js'),'utf8')));

test('programme recognition uses verified LLB alias and punctuation',()=>{
 const {recognizeProgramme}=require('../services/suggestedActionService');
 assert.equal(recognizeProgramme('Tell me about LLB').id,'bachelor-of-laws');
 assert.equal(recognizeProgramme('BACHELOR OF LAWS').id,'bachelor-of-laws');
 assert.equal(recognizeProgramme('unrelated query'),null);
});
