const test=require('node:test'),assert=require('node:assert/strict');
const budget=require('../services/groqRequestBudget'),{askAI}=require('../services/aiService');
test('oversized evidence and history fit conservative 8K Free-tier allowance',async()=>{
  let calls=0;
  await askAI('Explain policy', 'Verified policy. '.repeat(30000),{history:Array.from({length:10},()=>({role:'user',content:'long history '.repeat(1000)})),completionFn:async(model,messages)=>{calls++;assert.ok(budget.fits(messages));assert.ok(budget.cost(messages)+budget.OUTPUT_TOKENS<8000);assert.match(messages.at(-1).content,/Evidence shortened/);assert.match(messages.at(-1).content,/Verified policy/);return{choices:[{message:{content:'Verified policy.'}}]};}});
  assert.equal(calls,1);
});
test('HTTP 413 is not repeated unchanged across fallback models',async()=>{
  let calls=0;await assert.rejects(askAI('policy','evidence',{completionFn:async()=>{calls++;throw Object.assign(Error('Request too large'),{status:413});}}));assert.equal(calls,1);
});
test('oversized-token 429 stops fallback while ordinary rate limiting retains model chain',async()=>{
  let calls=0;await assert.rejects(askAI('policy','evidence',{completionFn:async()=>{calls++;throw Object.assign(Error('Request too large for tokens per minute'),{status:429});}}));assert.equal(calls,1);
  calls=0;await askAI('policy','evidence',{completionFn:async()=>{if(++calls===1)throw Object.assign(Error('Rate limit'),{status:429});return{choices:[{message:{content:'Evidence.'}}]};}});assert.equal(calls,2);
});
test('UTF-8 clipping preserves complete codepoints and byte limit',()=>{const v=budget.clip('😀😀😀',9);assert.equal(v,'😀😀');assert.equal(Buffer.byteLength(v),8);});
test('planner history and question are bounded before its existing completion chain',async()=>{
  const {planQuery}=require('../services/queryUnderstandingService');let calls=0;
  await planQuery('Explain university conduct '.repeat(1000),{force:true,history:Array.from({length:20},()=>({role:'assistant',content:'Long prior turn '.repeat(1000)})),completionFn:async({messages})=>{calls++;assert.ok(budget.fits(messages));assert.equal(messages.length,6);assert.match(messages[0].content,/BIT means Bachelor of Science in Information Systems and Technology/);return '{}';}});
  assert.equal(calls,1);
});
