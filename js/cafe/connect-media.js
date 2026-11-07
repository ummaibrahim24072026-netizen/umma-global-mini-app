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
 const languages=new Set('ar de en fr id ja ko ms pt ru tg th tk tr ug uz vi zh'.split(' '));
 const language=value=>{
  const code=value?.toLowerCase().split(/[-_]/)[0];
  return languages.has(code)?code:'en';
 };
 const voiceCopy={
  ru:['Перевод голоса','Переводим…','Перевод недоступен. Можно прослушать оригинал.','Перевод ИИ','Озвучка ИИ','Расшифровка','Повторить перевод','Перевод готовится…'],
  en:['Voice translation','Translating…','Translation unavailable. You can play the original.','AI translation','AI-generated audio','Transcript','Retry translation','Preparing translation…'],
  vi:['Dịch tin nhắn thoại','Đang dịch…','Không thể dịch. Bạn có thể nghe bản gốc.','Bản dịch AI','Giọng đọc AI','Bản chép lời','Thử dịch lại','Đang chuẩn bị bản dịch…']
 };
 const startWhenVisible=new WeakMap();
 const observer=window.IntersectionObserver?new IntersectionObserver(entries=>{
  for(const entry of entries){
   if(!entry.isIntersecting)continue;
   observer.unobserve(entry.target);
   startWhenVisible.get(entry.target)?.();
  }
 }):null;
 let voiceWork=Promise.resolve();
 function voiceTranslation(locale,target,load,enabled){
  const labels=voiceCopy[locale]||voiceCopy.en;
  const section=document.createElement('div'),button=document.createElement('button'),status=document.createElement('small');
  section.className='connect-voice-translation';
  button.type='button';
  button.textContent=labels[0];
  status.setAttribute('role','status');
  section.append(button,status);
  if(!enabled){button.hidden=true;status.textContent=labels[2];return section;}
  let pendingRetries=0;
  const request=()=>{
   if(button.disabled)return;
   button.disabled=true;
   status.textContent=labels[1];
   voiceWork=voiceWork.then(async()=>{
    if(!section.isConnected){button.disabled=false;return;}
    try{
     const result=await load();
     if(result.status==='ready'){
      status.textContent=result.url?labels[3]:labels[5];
      const text=document.createElement('div');
      text.lang=target;
      text.dir='auto';
      text.textContent=result.text;
      section.append(text);
      if(result.url){
       const audio=player('voice',result.url,labels[4]);
       audio.addEventListener('error',()=>{
        audio.remove();text.remove();button.hidden=false;button.textContent=labels[6];
        status.textContent=labels[2];
       },{once:true});
       section.append(audio);
      }
      button.hidden=true;
     }else{
      status.textContent=result.status==='pending'?labels[7]:labels[2];
      button.textContent=labels[6];
      if(result.status==='pending'&&pendingRetries++<4)setTimeout(()=>{if(section.isConnected)request();},12000);
     }
    }catch{
     status.textContent=labels[2];
     button.textContent=labels[6];
    }finally{button.disabled=false;}
   });
  };
  button.onclick=()=>{observer?.unobserve(section);request();};
  if(observer){startWhenVisible.set(section,request);observer.observe(section);}
  return section;
 }
 async function upload(api,identity,draft,requestKey,body,error){
  const response=await fetch(api,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(120000),
   headers:{'Content-Type':draft.file.type,'X-Umma-Request':requestKey,...identity},
   body:new Blob([JSON.stringify(body),'\n',draft.file])});
  const result=await response.json();
  if(!response.ok||!result.ok)throw Error(result.error||error(result.code,draft.kind));
  return result;
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
 window.ummaConnectMedia={player,attachment,render,language,voiceTranslation,upload};
})();
