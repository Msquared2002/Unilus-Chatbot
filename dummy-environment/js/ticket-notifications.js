// Poll only while the authenticated portal is visible. No permission prompt.
(() => {
 const box=document.createElement('details'),title=document.createElement('summary'),list=document.createElement('div');
 title.textContent='🔔 Support notifications';title.setAttribute('aria-label','Support notification inbox');list.setAttribute('aria-live','polite');box.append(title,list);box.hidden=true;
 document.querySelector('main')?.prepend(box);
 let busy=false,identity=null;
 async function update(){
  if(document.hidden||busy)return;
  const token=sessionStorage.getItem('unilusAuthToken');
  if(!token){box.hidden=true;list.replaceChildren();identity=null;return;}
  if(identity!==token){identity=token;list.replaceChildren();box.hidden=true;}
  busy=true;
  try{
   const base=window.UNILUS_API_BASE||'/api';
   const r=await fetch(base+'/notifications',{headers:{Authorization:'Bearer '+token}});
   if(!r.ok)throw Error('unavailable');
   const data=await r.json();if(sessionStorage.getItem('unilusAuthToken')!==token)return;
    title.textContent=`🔔 Support notifications (${data.unreadCount} unread)`;list.replaceChildren();box.hidden=false;
   if(!data.items.length)list.textContent='No support updates yet.';
   for(const item of data.items){
    const row=document.createElement('p'),text=document.createElement('span');
    text.textContent=`${item.ticketRef}: ${item.message} `;row.append(text);
    if(!item.read){const read=document.createElement('button');read.type='button';read.textContent='Mark read';
     read.onclick=async()=>{read.disabled=true;try{const result=await fetch(base+'/notifications/'+item.id+'/read',{method:'POST',headers:{Authorization:'Bearer '+token}});if(!result.ok)throw Error();await update();}catch{read.disabled=false;}};row.append(read);}
    list.append(row);
   }
  }catch{if(identity===token){box.hidden=false;title.textContent='Support notifications';list.textContent='Support updates are temporarily unavailable.';}}
  finally{busy=false;}
 }
 setInterval(update,30000);
 document.addEventListener('visibilitychange',update);
 window.addEventListener('unilus-student-context-changed',()=>{identity=null;box.hidden=true;list.replaceChildren();update();});
 update();
})();
