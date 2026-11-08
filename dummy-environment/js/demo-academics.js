(function(){
  const api=window.UNILUS_API_BASE||'/api';
  const token=()=>sessionStorage.getItem('unilusAuthToken');
  let profile=null,changing=false;
  const view=document.querySelector('[data-academic-view]'),message=document.querySelector('[data-profile-message]');
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function request(path,body){const r=await fetch(api+'/demo-academics/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(data.error||'Demonstration profile unavailable');return data;}
  function install(data){
    if(profile&&profile.id!==data.id)view.replaceChildren();
    document.querySelector('[data-profile-controls] details').open=false;
    profile=data;document.querySelector('[data-profile-programme]').value=data.programme;sessionStorage.setItem('unilusDemoAcademicProfile',JSON.stringify(data));sessionStorage.setItem('unilusDemoAcademicProfileId',data.id);sessionStorage.setItem('unilusChatSession',data.sessionId);sessionStorage.setItem('unilusDemoProgramme',data.programmeId);
    document.querySelectorAll('[data-demo-identity]').forEach(el=>el.textContent=data.studentNumber);
    document.querySelectorAll('[data-demo-name]').forEach(el=>el.textContent=data.name);
    document.querySelectorAll('[data-demo-programme]').forEach(el=>el.textContent=data.programmeName);
    document.querySelector('[data-profile-controls]').hidden=false;
    message.textContent='Independent demonstration using fictional student data. '+data.mappingNotice;
    window.dispatchEvent(new Event('unilus-student-context-changed'));render();
  }
  function selectPeriod(){return profile.periods.find(p=>p.key===(document.querySelector('[data-academic-period]')?.value||profile.activePeriod));}
  function periodOptions(selected){return profile.periods.map(p=>`<option value="${esc(p.key)}" ${p.key===selected?'selected':''}>Year ${p.year}, Semester ${p.semester} · ${p.academicYear}${p.completed?' · completed demo period':' · current demo period'}</option>`).join('');}
  function render(){
    const type=location.hash==='#final-results'?'final':location.hash==='#ca-marks'?'ca':null;
    document.body.classList.toggle('academic-view',!!type);view.hidden=!type;
    if(!type)return;
    if(!profile){view.innerHTML='<p>Academic simulation is unavailable for this account or is still loading.</p>';return;}
    const chosen=document.querySelector('[data-academic-period]')?.value||profile.activePeriod;
    const period=profile.periods.find(p=>p.key===chosen)||profile.periods.find(p=>p.key===profile.activePeriod);
    document.querySelector('.portal-breadcrumb').textContent='Home > Grades > '+(type==='ca'?'CA Marks':'Final Results');
    let content=`<div class="academic-toolbar"><h1>${type==='ca'?'CA Marks':'Final Results'}</h1><label>Demo academic period <select data-academic-period>${periodOptions(period.key)}</select></label></div>`;
    if(type==='ca'){
      const ready=period.courses.filter(c=>c.ready),uploaded=period.courses.filter(c=>c.assessments.some(a=>a.status==='available'));
      const average=ready.length?(ready.reduce((n,c)=>n+c.totalCA,0)/ready.length).toFixed(1):'--';
      content+=`<div class="ca-hero"><small>COURSEWORK OVERVIEW · SIMULATED</small><h2>Your Coursework Breakdown</h2><p>Weighted fictional assessment contributions for your selected demonstration period.</p><span>Year ${period.academicYear} · Semester ${period.semester}</span> <span>4 assessment types</span> <span>Total CA /40</span></div><div class="ca-summary">${[['COURSES',period.courses.length,'Observed timetabled courses'],['MARKS UPLOADED · DEMO',uploaded.length,'Simulated assessment availability'],['READY TO VIEW',ready.length,'All four contributions visible'],['AVERAGE VISIBLE CA',average,'Fully available CA only, out of 40']].map(([a,b,c])=>`<article><small>${a}</small><strong>${b}</strong><p>${c}</p></article>`).join('')}</div><p class="academic-hint">These columns show weighted contributions, not raw percentages. Pending and locked states are fictional; they are not lecturer upload events.</p><section class="coursework-card"><h2>Coursework Matrix</h2><p>Simulation weights: each assessment contributes up to 10 points. The total is the sum of visible contributions.</p><div class="academic-table-scroll"><table><thead><tr><th>Course</th><th>Status</th>${['Assignment 1','Midexam 1','Practical','Project 1','Total CA'].map(n=>`<th>${n}<small>Weighted CA</small></th>`).join('')}</tr></thead><tbody>${period.courses.map(c=>`<tr><td><b>${esc(c.code)}</b><small>${esc(c.name)}</small></td><td><span class="assessment-status">${c.ready?'Ready · simulated':'Pending / locked · simulated'}</span></td>${c.assessments.map(a=>`<td>${a.status==='available'?a.contribution.toFixed(1):esc(a.status)}</td>`).join('')}<td><b>${c.ready?c.totalCA.toFixed(1):c.visibleCA.toFixed(1)+' partial'}</b></td></tr>`).join('')}</tbody></table></div></section>`;
    }else{
      content+=`<section class="final-paper"><div class="final-identity"><img src="assets/unilus-logo.png" alt="UNILUS crest"><div><h2>${esc(profile.name)}</h2><p>ID: ${esc(profile.studentNumber)}</p><p><b>Programme:</b> ${esc(profile.programmeName)}</p><p><b>Period:</b> ${period.academicYear}, Year ${period.year}, Semester ${period.semester}</p></div><strong class="simulation-stamp">FICTIONAL DEMO<br>NOT A TRANSCRIPT</strong></div>`;
      content+=period.completed?`<div class="academic-table-scroll"><table><thead><tr><th>Course Name</th><th>Course Code</th><th>Simulated mark</th><th>Simulated grade</th></tr></thead><tbody>${period.courses.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.code)}</td><td>${c.finalMark}/100</td><td>${c.finalGrade}</td></tr>`).join('')}</tbody></table></div><p class="simulated-comment">Demonstration comment: completed simulated period. No official pass, progression or graduation decision is made.</p><p>Official semester GPA: not calculated. Course credit and university grade-point rules have not been verified.</p><button class="print-results" data-print-results>Print Demo Results</button>`:'<p class="unpublished-results">Final results are not published for this unfinished demonstration semester.</p>';
      content+='</section>';
    }
    view.innerHTML=content+`<p class="academic-policy">${esc(profile.policy)}</p>`;
    view.querySelector('[data-academic-period]').addEventListener('change',render);
    view.querySelector('[data-print-results]')?.addEventListener('click',()=>window.print());
  }
  async function renew(){if(changing||!profile)return;changing=true;document.querySelectorAll('[data-profile-controls] button').forEach(b=>b.disabled=true);window.dispatchEvent(new Event('unilus-demo-profile-changing'));message.textContent='Creating a new fictional scenario…';
    try{const mode=document.querySelector('[data-profile-mode]').value;install(await request('profile',{mode,programme:document.querySelector('[data-profile-programme]').value,expectedProfileId:profile.id}));}
    catch(e){const error=e.message;try{install(await request('profile'));}catch{ /* Never manufacture a fallback profile. */ }message.textContent=error;}
    finally{changing=false;document.querySelectorAll('[data-profile-controls] button').forEach(b=>b.disabled=false);}}
  document.querySelector('[data-new-demo-profile]')?.addEventListener('click',renew);
  window.addEventListener('hashchange',()=>{render();document.querySelector('.portal-sidebar')?.classList.remove('is-open');document.querySelector('.portal-menu-toggle')?.setAttribute('aria-expanded','false');window.scrollTo(0,0);});
  if(token())Promise.all([request('profile'),request('programmes')]).then(([data,programmes])=>{document.querySelector('[data-profile-programme]').innerHTML=programmes.map(p=>`<option value="${esc(p.code)}">${esc(p.name)}</option>`).join('');install(data);}).catch(e=>{message.textContent=e.message;render();});
  else{message.textContent='Sign in with an authorized fictional student account to use the academic simulator.';render();}
})();
