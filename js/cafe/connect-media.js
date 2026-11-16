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
 function inlineAttachment(kind,label,load,errorText){
  if(kind!=='photo'&&kind!=='video')return attachment(kind,label,load,errorText);
  const wrapper=document.createElement('div');
  wrapper.className='connect-inline-attachment connect-inline-'+kind;
  const media=player(kind,'',label);
  media.removeAttribute('src');
  if(kind==='video'){media.preload='metadata';media.controls=true;media.playsInline=true;}
  else {media.loading='lazy';media.decoding='async';media.tabIndex=0;media.setAttribute('role','button');}
  const status=document.createElement('small');
  status.setAttribute('role','status');
  const retry=document.createElement('button');
  retry.type='button';retry.textContent='↻';retry.hidden=true;
  retry.setAttribute('aria-label','Повторить загрузку');
  wrapper.append(media,status,retry);
  let loading=null,loaded=false;
  async function prepare(){
   if(loaded)return;
   if(loading)return loading;
   status.textContent='';
   retry.hidden=true;
   loading=(async()=>{
    try{
     const url=await load();
     if(!wrapper.isConnected)return;
     media.src=url;
     if(kind==='video')media.load();
     loaded=true;
    }catch{status.textContent=errorText;retry.hidden=false;}
    finally{loading=null;}
   })();
   return loading;
  }
  retry.onclick=()=>{loaded=false;void prepare();};
  media.addEventListener('error',()=>{loaded=false;status.textContent=errorText;retry.hidden=false;});
  if(kind==='photo'){
   const enlarge=()=>{
    if(!media.src)return;
    const overlay=document.createElement('div');
    overlay.className='connect-photo-lightbox';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-label',label);
    const image=document.createElement('img');
    image.src=media.src;image.alt=label;
    const close=document.createElement('button');
    close.type='button';close.textContent='×';close.setAttribute('aria-label','Закрыть');
    const dismiss=()=>overlay.remove();
    close.onclick=dismiss;overlay.onclick=e=>{if(e.target===overlay)dismiss();};
    overlay.append(image,close);document.body.append(overlay);close.focus();
   };
   media.addEventListener('click',enlarge);
   media.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();enlarge();}});
  }
  if('IntersectionObserver'in window){
   const observer=new IntersectionObserver(entries=>{
    if(!entries.some(entry=>entry.isIntersecting))return;
    observer.disconnect();void prepare();
   },{rootMargin:'240px'});
   observer.observe(wrapper);
  }else void prepare();
  return wrapper;
 }
 function videoCircle(load,errorText){
  const wrapper=document.createElement('div');
  wrapper.className='connect-video-circle';
  const video=document.createElement('video');
  video.className='connect-media connect-video-circle-player';
  video.playsInline=true;
  video.preload='auto';
  video.muted=true;
  video.setAttribute('aria-label','Видеосообщение');
  const toggle=document.createElement('button');
  toggle.type='button';
  toggle.className='connect-video-circle-toggle';
  toggle.textContent='▶';
  toggle.setAttribute('aria-label','Воспроизвести видеосообщение');
  const message=document.createElement('small');
  message.className='connect-video-circle-status';
  message.setAttribute('role','status');
  wrapper.append(video,toggle,message);
  let loaded=false,loading=null;
  async function prepare(){
   if(loaded)return true;
   if(loading)return loading;
   loading=(async()=>{
    try{
     const url=await load();
     if(!wrapper.isConnected)return false;
     video.src=url;
     video.load();
     loaded=true;
     return true;
    }catch{
     message.textContent=errorText;
     return false;
    }finally{loading=null;}
   })();
   return loading;
  }
  video.addEventListener('loadeddata',()=>{
   if(video.paused&&video.currentTime===0){
    try{video.currentTime=Math.min(0.08,Number.isFinite(video.duration)?Math.max(0,video.duration-0.01):0.08);}catch{}
   }
  });
  video.addEventListener('error',()=>{loaded=false;message.textContent=errorText;toggle.textContent='↻';});
  video.addEventListener('ended',()=>{video.muted=true;toggle.textContent='▶';toggle.hidden=false;});
  video.addEventListener('pause',()=>{if(!video.ended){toggle.textContent='▶';toggle.hidden=false;}});
  toggle.onclick=async()=>{
   if(!loaded&&!(await prepare()))return;
   if(!video.paused){video.pause();return;}
   try{
    video.muted=false;
    await video.play();
    toggle.hidden=true;
    message.textContent='';
   }catch{message.textContent=errorText;}
  };
  // Load the first video frame automatically when the message is on screen.
  if('IntersectionObserver'in window){
   const observer=new IntersectionObserver(entries=>{
    if(!entries.some(entry=>entry.isIntersecting))return;
    observer.disconnect();
    void prepare();
   },{rootMargin:'180px'});
   observer.observe(wrapper);
  }else void prepare();
  return wrapper;
 }
 const textTranslations=new Map();
 function translatedText(original,language,load){
  const wrapper=document.createElement('div');
  wrapper.className='connect-translated-text';
  const main=document.createElement('div');
  main.textContent=original;
  const originalText=document.createElement('div');
  originalText.className='connect-original-text';
  originalText.textContent=original;
  originalText.hidden=true;
  const toggle=document.createElement('button');
  toggle.type='button';
  toggle.textContent='Показать оригинал';
  toggle.hidden=true;
  toggle.onclick=()=>{originalText.hidden=!originalText.hidden;toggle.textContent=originalText.hidden?'Показать оригинал':'Скрыть оригинал';};
  wrapper.append(main,toggle,originalText);
  const key=language+'|'+original;
  async function translate(){
   try{
    let work=textTranslations.get(key);
    if(!work){work=load();textTranslations.set(key,work);}
    const result=await work;
    if(!wrapper.isConnected)return;
    if(result?.text&&result.text.trim()&&result.text.trim()!==original.trim()){
     main.textContent=result.text;
     main.lang=language;
     toggle.hidden=false;
    }
   }catch{textTranslations.delete(key);}
  }
  if('IntersectionObserver'in window){
   const observer=new IntersectionObserver(entries=>{
    if(!entries.some(e=>e.isIntersecting))return;
    observer.disconnect();void translate();
   },{rootMargin:'240px'});
   observer.observe(wrapper);
  }else void translate();
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
 window.ummaConnectMedia={player,attachment,inlineAttachment,videoCircle,translatedText,render,language,voiceTranslation,upload};
})();
