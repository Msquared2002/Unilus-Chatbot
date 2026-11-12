(function(){
  const api=window.UNILUS_API_BASE||'/api';
  const token=()=>sessionStorage.getItem('unilusAuthToken');
  let profile=null,changing=false;
  const view=document.querySelector('[data-academic-view]'),message=document.querySelector('[data-profile-message]');
  const settings=document.querySelector('[data-profile-controls] details'),trigger=settings.querySelector('summary');
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function closeSettings(restoreFocus=false){settings.open=false;trigger.setAttribute('aria-expanded','false');document.body.classList.remove('profile-settings-open');if(restoreFocus)trigger.focus();}
  settings.addEventListener('toggle',()=>{trigger.setAttribute('aria-expanded',String(settings.open));document.body.classList.toggle('profile-settings-open',settings.open);if(settings.open)settings.querySelector('select').focus();});
  document.addEventListener('click',event=>{if(settings.open&&!settings.contains(event.target))closeSettings();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&settings.open){event.preventDefault();closeSettings(true);}});
  settings.addEventListener('focusout',event=>{if(event.relatedTarget&&!settings.contains(event.relatedTarget))closeSettings();});
  async function request(path,body){const r=await fetch(api+'/demo-academics/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(data.error||'Profile unavailable');return data;}
  function install(data){
    if(profile&&profile.id!==data.id)view.replaceChildren();closeSettings();profile=data;
    document.querySelector('[data-profile-programme]').value=data.programme;
    sessionStorage.setItem('unilusDemoAcademicProfile',JSON.stringify(data));sessionStorage.setItem('unilusDemoAcademicProfileId',data.id);sessionStorage.setItem('unilusChatSession',data.sessionId);sessionStorage.setItem('unilusDemoProgramme',data.programmeId);
    document.querySelectorAll('[data-demo-identity]').forEach(el=>el.textContent=data.studentNumber);
    document.querySelectorAll('[data-demo-name]').forEach(el=>el.textContent=data.name);
    document.querySelectorAll('[data-demo-programme]').forEach(el=>el.textContent=data.programmeName);
    document.querySelector('[data-profile-controls]').hidden=!!data.fixed;
    message.textContent='Independent demonstration · fictional student data';
    window.dispatchEvent(new Event('unilus-student-context-changed'));render();
  }
  function periodOptions(selected){return profile.periods.map(p=>`<option value="${esc(p.key)}" ${p.key===selected?'selected':''}>${p.academicYear} · Year ${p.year}, Semester ${p.semester}${p.completed?'':' · current'}</option>`).join('');}
  function render(){
    const type=location.hash==='#final-results'?'final':location.hash==='#ca-marks'?'ca':null;
    document.body.classList.toggle('academic-view',!!type);view.hidden=!type;if(!type)return;
    if(!profile){view.innerHTML='<p>Results are unavailable or still loading.</p>';return;}
    if(profile.requiresNewProfile){view.innerHTML='<p>Choose New Profile to start with the corrected assessment scheme.</p>';return;}
    const chosen=document.querySelector('[data-academic-period]')?.value||profile.activePeriod;
    const period=profile.periods.find(p=>p.key===chosen)||profile.periods.find(p=>p.key===profile.activePeriod);
    document.querySelector('.portal-breadcrumb').textContent='Home > Grades > '+(type==='ca'?'CA Marks':'Final Results');
    let content=`<div class="academic-toolbar"><h1>${type==='ca'?'CA Marks':'Final Results'}</h1><label>Academic period <select data-academic-period>${periodOptions(period.key)}</select></label></div>`;
    if(type==='ca'){
      const ready=period.courses.filter(c=>c.ready),uploaded=period.courses.filter(c=>c.assessments.some(a=>a.status==='available'));
      const average=ready.length?(ready.reduce((n,c)=>n+c.totalCA,0)/ready.length).toFixed(1):'--';
      const columns=period.courses[0].assessments;
      content+=`<div class="ca-hero"><small>COURSEWORK OVERVIEW</small><h2>Your Coursework Breakdown</h2><p>Track your coursework contributions and see which results are ready to view.</p><span>Year ${period.academicYear} · Semester ${period.semester}</span></div><div class="ca-summary">${[['COURSES',period.courses.length,'Courses in this period'],['MARKS UPLOADED',uploaded.length,'Courses with available marks'],['READY TO VIEW',ready.length,'Complete coursework results'],['AVERAGE VISIBLE CA',average,'Complete coursework totals']].map(([a,b,c])=>`<article><small>${a}</small><strong>${b}</strong><p>${c}</p></article>`).join('')}</div><section class="coursework-card"><div class="coursework-heading"><h2>Coursework Matrix</h2></div><div class="academic-table-scroll"><table><thead><tr><th>Course</th><th>Status</th>${columns.map(a=>`<th>${esc(a.name)}</th>`).join('')}<th>Total CA</th></tr></thead><tbody>${period.courses.map(c=>`<tr><td><b>${esc(c.code)}</b><small>${esc(c.name)}</small></td><td><span class="assessment-status">${c.ready?'Ready to view':'Awaiting upload'}</span></td>${c.assessments.map(a=>`<td${a.status==='available'?'':' title="Awaiting upload"'}>${a.status==='available'?esc(a.score):'—'}</td>`).join('')}<td><b>${c.ready?esc(c.totalCA):'—'}</b></td></tr>`).join('')}</tbody></table></div></section>`;
    }else{
      content+=`<section class="final-paper"><div class="final-identity"><img src="assets/unilus-logo.png" alt="UNILUS crest"><div><h2>${esc(profile.name)}</h2><p>ID: ${esc(profile.studentNumber)}</p><p><b>Programme:</b> ${esc(profile.programmeName)}</p><p><b>Period:</b> ${period.academicYear}, Year ${period.year}, Semester ${period.semester}</p></div></div>`;
      content+=period.completed?`<div class="academic-table-scroll"><table><thead><tr><th>Course Name</th><th>Course Code</th><th>Grade</th></tr></thead><tbody>${period.courses.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.code)}</td><td>${esc(c.finalGrade)}</td></tr>`).join('')}</tbody></table></div><p class="semester-comment" title="${esc(period.outcome.detail)}">Comment: ${esc(period.outcome.label)}</p><button class="print-results" data-print-results>Print Results</button>`:'<p class="unpublished-results">Final results have not been published for this semester.</p>';
      content+='</section>';
    }
    view.innerHTML=content;
    view.querySelector('[data-academic-period]').addEventListener('change',render);
    view.querySelector('[data-print-results]')?.addEventListener('click',()=>window.print());
  }
  async function renew(){
    if(changing||!profile)return;changing=true;closeSettings();document.querySelectorAll('[data-profile-controls] button').forEach(b=>b.disabled=true);window.dispatchEvent(new Event('unilus-demo-profile-changing'));message.textContent='Creating profile…';
    try{const mode=document.querySelector('[data-profile-mode]').value;install(await request('profile',{mode,programme:document.querySelector('[data-profile-programme]').value,expectedProfileId:profile.id}));}
    catch(e){const error=e.message;try{install(await request('profile'));}catch{ /* Never manufacture a fallback profile. */ }message.textContent=error;}
    finally{changing=false;document.querySelectorAll('[data-profile-controls] button').forEach(b=>b.disabled=false);}
  }
  document.querySelector('[data-new-demo-profile]')?.addEventListener('click',renew);
  window.addEventListener('hashchange',()=>{render();document.querySelector('.portal-sidebar')?.classList.remove('is-open');document.querySelector('.portal-menu-toggle')?.setAttribute('aria-expanded','false');window.scrollTo(0,0);});
  if(token())Promise.all([request('profile'),request('programmes')]).then(([data,programmes])=>{document.querySelector('[data-profile-programme]').innerHTML=programmes.map(p=>`<option value="${esc(p.code)}">${esc(p.name)}</option>`).join('');install(data);}).catch(e=>{message.textContent=e.message;render();});
  else{message.textContent='Independent demonstration · sign in with a demo account.';render();}
})();
