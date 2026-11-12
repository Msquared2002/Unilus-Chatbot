// One authenticated widget inbox. Automatic eligibility is controlled by the server.
(() => {
 function mount(){
 if(!document.querySelector(".panel-body"))return;
 if(window.unilusNotificationsMounted)return;window.unilusNotificationsMounted=true;
 const box=document.createElement('section'),title=document.createElement('button'),list=document.createElement('div'),detail=document.createElement('section'),settings=document.createElement('section');
 box.id='view-notifications';box.className='notification-inbox panel-view';title.id='notification-bell';title.type='button';title.className='icon-btn notification-bell';title.textContent='🔔 Notifications';title.setAttribute('aria-label','Notification inbox');list.setAttribute('aria-live','polite');box.append(list,detail);box.hidden=true;
 document.querySelector('.panel-body').append(box);document.getElementById('settings-btn').before(title);title.hidden=true;title.onclick=()=>{window.UnilusWidget.showNotifications();list.querySelector('button')?.focus();};
 let busy=false,identity=null,timer=null,authRejected=false;
 const token=()=>sessionStorage.getItem('unilusAuthToken');
 const base=()=>window.UNILUS_API_BASE||'/api';
 let controller=new AbortController();
 async function api(path,auth,options={}){const r=await fetch(base()+path,{...options,signal:controller.signal,headers:{Authorization:'Bearer '+auth,...(options.body?{'Content-Type':'application/json'}:{})}});if(r.status===401||r.status===403){authRejected=true;stop();title.hidden=true;box.hidden=true;list.replaceChildren();detail.replaceChildren();throw Error('Sign in required');}if(!r.ok)throw Error('unavailable');return r.json();}
 const text=(parent,tag,value)=>{const el=document.createElement(tag);el.textContent=value;parent.append(el);return el;};
 const button=(parent,label,action)=>{const b=text(parent,'button',label);b.type='button';b.onclick=action;return b;};
 async function mark(item,auth){await api('/notifications/'+encodeURIComponent(item.id)+'/read',auth,{method:'POST'});if(token()===auth)await update();}
 async function open(item,auth){
  if(token()!==auth)return;detail.replaceChildren();text(detail,'p','Loading notification details…');
  try{
   const action=item.action||{type:'ticket',ticketRef:item.ticketRef};let heading,body;
   if(action.type==='ticket'){const ticket=await api('/notifications/ticket/'+encodeURIComponent(action.ticketRef),auth);heading='Ticket '+ticket.ref;body='Status: '+ticket.status+'\nDepartment: '+ticket.department+'\n\n'+ticket.events.map(e=>(e.kind==='reply'?'Staff reply: ':'Status: ')+e.body).join('\n\n');}
   else if(action.type==='timetable'){const rows=await api('/notifications/timetable/'+encodeURIComponent(item.id),auth);const group=String(action.group||'').toUpperCase().replace(/\s/g,'');const matched=rows.filter(r=>(String(r.class_group||'').trim().toUpperCase().replace(/\s/g,'')||(String(r.programme_name||'').trim().toUpperCase().match(/\b([A-Z]\d+)$/)?.[1]||''))===group);heading='Updated timetable: '+action.programmeCode;body='Africa/Lusaka local times. Profile-matched timetable. Group-specific eligibility is applied only when known; demonstrations are simulated.\n\n'+(matched.map(r=>[r.course_code,r.course_name,r.day,r.time,r.venue_name,r.lecturer_name].filter(Boolean).join(' | ')).join('\n')||'No sessions currently listed for this group.');}
   else if(action.type==='announcement'){if(token()!==auth)return;detail.replaceChildren();const opened=await window.UnilusAcademicInfo?.open(detail,action.publicationId);if(opened&&token()===auth)await mark(item,auth);return;}
   else if(action.type==='reminder'){if(token()!==auth)return;detail.replaceChildren();const opened=await window.UnilusMorning?.openReminder(detail,action.reminderId);if(opened&&token()===auth)await mark(item,auth);return;}
   else if(action.type==='peer'){if(token()!==auth)return;detail.replaceChildren();const opened=await window.UnilusPeerTutors?.open(detail,action.requestId);if(opened&&token()===auth)await mark(item,auth);return;}
   else throw Error('Unsupported action');
   if(token()!==auth)return;detail.replaceChildren();text(detail,'h3',heading);text(detail,'pre',body);button(detail,'Close details',()=>detail.replaceChildren());if(action.type==='ticket')window.UnilusFrontDesk?.attachments(detail,action.ticketRef);await mark(item,auth);
  }catch{if(token()===auth){detail.replaceChildren();text(detail,'p','Details are temporarily unavailable. Please try again.');}}
 }
 async function update(){
  if(document.hidden||busy)return;const auth=token();
  if(!auth){box.hidden=true;title.hidden=true;list.replaceChildren();detail.replaceChildren();settings.replaceChildren();identity=null;stop();return;}
  if(identity!==auth){identity=auth;list.replaceChildren();detail.replaceChildren();settings.replaceChildren();box.hidden=true;}
  busy=true;
  try{const data=await api('/notifications',auth);if(token()!==auth)return;title.replaceChildren();text(title,'span','🔔');const badge=text(title,'span',String(data.unreadCount>99?'99+':data.unreadCount));badge.className='notification-badge';badge.hidden=!data.unreadCount;list.replaceChildren();title.hidden=false;title.setAttribute('aria-label','Notifications, '+data.unreadCount+' unread');
   if(!data.items.length)text(list,'p','No updates yet.');
   for(const item of data.items){const row=document.createElement('article');row.className=item.read?'notification-read':'notification-unread';const category=item.category==='announcement'?'Announcement':item.category==='reminder'?'Reminder':item.category==='peer'?'Peer tutoring':item.category==='timetable'?'Timetable':'Support';text(row,'strong',category+' · '+(item.read?'Read':'Unread'));const date=new Date(item.createdAt);text(row,'p',(item.ticketRef?item.ticketRef+': ':'')+item.message);if(!Number.isNaN(date.getTime()))text(row,'small',date.toLocaleString('en-GB',{timeZone:'Africa/Lusaka'})+' Africa/Lusaka');
    button(row,item.category==='announcement'?'Open announcement':item.category==='reminder'?'Open reminder':item.category==='peer'?'Open tutoring request':item.category==='timetable'?'View updated timetable':'Open ticket',()=>open(item,auth));
    if(!item.read){const b=button(row,'Mark read',async()=>{b.disabled=true;try{await mark(item,auth);}catch{b.disabled=false;}});}list.append(row);}
  }catch{if(!authRejected&&identity===auth){title.hidden=false;title.textContent='🔔';list.replaceChildren();text(list,'p','Updates are temporarily unavailable. Your ticket and timetable remain accessible.');}}
  finally{if(identity===auth)busy=false;}
 }
 function stop(){if(timer!==null){clearInterval(timer);timer=null;}}
 function start(){stop();if(!document.hidden&&token()){update();timer=setInterval(update,30000);}else update();}
 document.addEventListener('visibilitychange',start);
 window.addEventListener('unilus-student-context-changed',()=>{controller.abort();controller=new AbortController();busy=false;authRejected=false;identity=null;box.hidden=true;title.hidden=true;list.replaceChildren();detail.replaceChildren();settings.replaceChildren();start();});
 window.addEventListener('pagehide',stop);window.addEventListener('pageshow',start);start();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
