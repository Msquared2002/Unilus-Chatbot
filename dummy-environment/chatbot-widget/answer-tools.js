// Optional per-answer feedback and stateless PDF export, adapted from Pete's PR #5.
const identity=()=>[sessionStorage.getItem('unilusAuthToken'),sessionStorage.getItem('unilusDemoAcademicProfileId')].join('|');
window.UnilusAnswerTools={render(row,data){
  if(!data.sessionId||!data.answer)return;
  const owner=identity(), token=sessionStorage.getItem('unilusAuthToken'),ref=crypto.randomUUID();
  const tools=document.createElement('div');tools.className='answer-tools';tools.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin:8px 0';
  const status=document.createElement('span');status.setAttribute('role','status');
  const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.className='speak-btn';b.textContent=label;b.onclick=fn;tools.append(b);return b;};
  let pending=false,id;
  const request=async(path,body)=>{if(identity()!==owner)throw Error('Account changed');const res=await fetch((window.UNILUS_API_BASE||'/api')+path,{method:id&&path.startsWith('/feedback')?'PATCH':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});if(!res.ok)throw Error('Request unavailable');if(identity()!==owner)throw Error('Account changed');return res;};
  const submit=async(rating,reason,comment)=>{if(pending)return;pending=true;status.textContent='Saving…';try{const res=await request('/feedback'+(id?'/'+id:''),{sessionId:data.sessionId,answerRef:ref,rating,reason,comment,category:data.queryType?.isProgrammeAdvisor?'programme_advisor':data.queryType?.isTimetable?'timetable':'other'});id=(await res.json()).id||id;status.textContent='Thank you. Feedback saved.';}catch{status.textContent='Could not save feedback. Please retry.';}finally{pending=false;}};
  button('Helpful',()=>submit('up'));
  button('Not helpful',()=>{if(tools.querySelector('select'))return;const select=document.createElement('select');select.setAttribute('aria-label','Feedback reason');for(const [v,t]of [['unclear','Unclear'],['wrong','Incorrect'],['outdated','Outdated'],['not_answered','Did not answer'],['other','Other']])select.add(new Option(t,v));const comment=document.createElement('input');comment.maxLength=1000;comment.placeholder='Optional comment; omit private details';comment.setAttribute('aria-label','Optional feedback comment');tools.append(select,comment);button('Send feedback',()=>submit('down',select.value,comment.value));button('Skip comment',()=>submit('down',select.value));});
  button('Save PDF',async()=>{if(pending)return;pending=true;status.textContent='Preparing PDF…';try{const sources=(data.sources||[]).slice(0,12).map(s=>typeof s==='string'?s:[s.title||s.name||s.source,s.url].filter(Boolean).join(' — ')).map(s=>s.slice(0,500));const res=await request('/chat/pdf',{sessionId:data.sessionId,title:'UNILUS answer',markdown:data.answer,sources});const url=URL.createObjectURL(await res.blob()),a=document.createElement('a');a.href=url;a.download='unilus-answer.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='PDF ready.';}catch{status.textContent='Could not export this answer.';}finally{pending=false;}});
  tools.append(status);(row.querySelector('.bubble')||row).append(tools);
  const disable=()=>{tools.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);};
  window.addEventListener('unilus-student-context-changed',()=>{if(owner!==identity())disable();},{once:true});window.addEventListener('unilus-demo-profile-changing',disable,{once:true});
}};
