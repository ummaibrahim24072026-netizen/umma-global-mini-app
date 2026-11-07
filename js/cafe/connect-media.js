/* Shared attachment rendering for the guest chat and the staff inbox. */
(() => {
 'use strict';
 function player(kind,url,label){
  const media=document.createElement(kind==='photo'?'img':kind==='video'?'video':'audio');
  media.className='connect-media';
  media.setAttribute('aria-label',label);
  if(kind==='photo')media.alt=label;
  else{
   media.controls=true;
   media.preload='metadata';
   if(kind==='video')media.playsInline=true;
  }
  media.src=url;
  return media;
 }
 function attachment(kind,label,load,errorText){
  const wrapper=document.createElement('div'),open=document.createElement('button'),status=document.createElement('small');
  open.type='button';
  open.textContent=label;
  status.setAttribute('role','status');
  open.onclick=async()=>{
   open.disabled=true;
   status.textContent='';
   try{
    const url=await load();
    const media=player(kind,url,label);
    media.addEventListener('error',()=>{
     media.remove();
     open.hidden=false;
     status.textContent=errorText;
    },{once:true});
    open.hidden=true;
    wrapper.prepend(media);
   }catch{status.textContent=errorText;}
   finally{open.disabled=false;}
  };
  wrapper.append(open,status);
  return wrapper;
 }
 function render(list,messages,create,receipt){
  const rows=new Map(Array.from(list.children,row=>[row.dataset.connectMessage,row]));
  messages.forEach((message,index)=>{
   const row=rows.get(message.id)||create(message);
   row.dataset.connectMessage=message.id;
   const read=row.querySelector('.connect-receipt');
   if(read)read.textContent=receipt(message);
   if(list.children[index]!==row)list.insertBefore(row,list.children[index]||null);
   rows.delete(message.id);
  });
  for(const row of rows.values())row.remove();
 }
 window.ummaConnectMedia={player,attachment,render};
})();
