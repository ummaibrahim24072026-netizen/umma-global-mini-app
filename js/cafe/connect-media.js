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
 function voiceBubble(load,errorText){
  const wrapper=document.createElement('div');
  wrapper.className='connect-voice-bubble';
  wrapper.style.cssText='display:flex;align-items:center;gap:8px;width:min(84vw,350px);max-width:100%;padding:9px 12px;border-radius:17px;background:#d9f3ee;color:#125b59;box-sizing:border-box';
  const play=document.createElement('button');play.type='button';play.textContent='▶';
  play.setAttribute('aria-label','Воспроизвести голосовое сообщение');
  play.style.cssText='flex:none;width:36px;height:36px;border:0;border-radius:50%;background:transparent;color:#0a9998;font-size:25px;align-self:center;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;cursor:pointer';
  const middle=document.createElement('div');middle.style.cssText='flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:2px';
  const wave=document.createElement('div');wave.setAttribute('aria-hidden','true');
  wave.style.cssText='height:32px;width:100%;display:flex;align-items:center;gap:2px;overflow:hidden;position:relative;cursor:pointer;align-self:stretch';
  const heights=[8,15,26,19,30,12,23,28,17,9,25,14,29,21,11,24,30,18,8,19,27,13,29,16,9,22,28,12,24,17,7,15,25,10,20,12,6,15,8,5];
  const bars=heights.map(h=>{const bar=document.createElement('span');bar.style.cssText='flex:1 1 0;min-width:1.5px;height:'+h+'px;border-radius:3px;background:#76aaa5';wave.append(bar);return bar;});
  const dot=document.createElement('span');dot.style.cssText='position:absolute;left:0;top:50%;width:12px;height:12px;transform:translate(-2px,-50%);background:#168fe0;border:1px solid #d9f3ee;border-radius:50%;box-sizing:border-box;pointer-events:none';wave.append(dot);
  const time=document.createElement('small');time.textContent='0:00';time.style.cssText='font:12px system-ui;color:#527c77;line-height:16px';
  const seek=document.createElement('input');seek.type='range';seek.min='0';seek.max='1000';seek.value='0';seek.setAttribute('aria-label','Перемотать голосовое сообщение');seek.style.cssText='position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer';wave.append(seek);
  const speed=document.createElement('button');speed.type='button';speed.textContent='1×';speed.setAttribute('aria-label','Скорость воспроизведения');
  speed.style.cssText='border:0;background:transparent;color:#126c6b;font:700 11px system-ui;padding:3px;cursor:pointer;align-self:center';
  const status=document.createElement('small');status.setAttribute('role','status');status.style.cssText='color:#9b3939';
  const audio=document.createElement('audio');audio.preload='metadata';
  middle.append(wave,time,status);wrapper.append(play,middle,speed,audio);
  let loading=null,loaded=false;
  const fmt=n=>{if(!Number.isFinite(n))return '0:00';const v=Math.max(0,Math.floor(n));return Math.floor(v/60)+':'+String(v%60).padStart(2,'0');};
  async function prepare(){
   if(loaded)return true;if(loading)return loading;
   loading=(async()=>{try{const url=await load();if(!wrapper.isConnected)return false;audio.src=url;audio.load();loaded=true;status.textContent='';return true;}catch{status.textContent=errorText;return false;}finally{loading=null;}})();
   return loading;
  }
  function update(){
   const duration=audio.duration;
   seek.value=Number.isFinite(duration)&&duration>0?String(Math.round(audio.currentTime/duration*1000)):'0';
   time.textContent=audio.currentTime>0?fmt(audio.currentTime):fmt(duration);dot.style.left=(Number(seek.value)/10)+'%';
   const count=Math.round(Number(seek.value)/1000*bars.length);
   bars.forEach((bar,i)=>bar.style.background=i<count?'#0a9998':'#76aaa5');
  }
  play.onclick=async()=>{if(!loaded&&!(await prepare()))return;try{if(audio.paused)await audio.play();else audio.pause();}catch{status.textContent=errorText;}};
  audio.addEventListener('play',()=>{play.textContent='Ⅱ';play.setAttribute('aria-label','Приостановить голосовое сообщение');});
  audio.addEventListener('pause',()=>{play.textContent='▶';play.setAttribute('aria-label','Воспроизвести голосовое сообщение');});
  audio.addEventListener('ended',()=>{play.textContent='▶';update();});
  audio.addEventListener('timeupdate',update);audio.addEventListener('loadedmetadata',update);
  audio.addEventListener('error',()=>{status.textContent=errorText;loaded=false;});
  seek.oninput=async()=>{if(!loaded&&!(await prepare()))return;if(Number.isFinite(audio.duration))audio.currentTime=Number(seek.value)/1000*audio.duration;update();};
  speed.onclick=()=>{const speeds=[1,1.5,2];const next=speeds[(speeds.indexOf(audio.playbackRate)+1)%speeds.length];audio.playbackRate=next;speed.textContent=next+'×';};
  return wrapper;
 }
 function inlineAttachment(kind,label,load,errorText){
  if(kind==='voice')return voiceBubble(load,errorText);
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
 function translatedText(original,language,load,translateLabel,statusCopy){
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
  const state=document.createElement('small');state.className='connect-local-status';
  if(statusCopy)state.setAttribute('role','status');
  wrapper.append(state);
  const start=translateLabel?document.createElement('button'):null;
  async function translate(){
   if(start)start.disabled=true;
   try{
    state.textContent=statusCopy?.loading||'Перевод на устройстве · первая загрузка может занять несколько минут';
    let work=textTranslations.get(key);
    if(!work){work=load();textTranslations.set(key,work);}
    const result=await work;
    if(!wrapper.isConnected)return;
    if(result?.text&&result.text.trim()&&result.text.trim()!==original.trim()){
     main.textContent=result.text;
     main.lang=language;
     toggle.hidden=false;
     state.textContent='';
    }else state.textContent='';
    if(start)start.hidden=true;
   }catch{state.textContent=statusCopy?.error||'Перевод недоступен на этом устройстве. Показан оригинал.';textTranslations.delete(key);}
   finally{if(start)start.disabled=false;}
  }
  if(start){
   start.type='button';
   start.textContent=translateLabel;
   start.onclick=translate;
   wrapper.insertBefore(start,state);
  }else if('IntersectionObserver'in window){
   const observer=new IntersectionObserver(entries=>{
    if(!entries.some(e=>e.isIntersecting))return;
    observer.disconnect();void translate();
   },{rootMargin:'240px'});
   observer.observe(wrapper);
  }else void translate();
  return wrapper;
 }
 const languages=new Set('ar de en fr id ja ko ms pt ru tg th tk tr ug uz vi zh bn hi ur fa es it nl pl uk sw fil my km lo ne si he el ro cs hu sv no da fi am ka mn ta te ml pa gu mr bg sr hr sk sl et lv lt az kk ky ps so sq af ca eu gl is ga mt cy hy be bs mk sq'.split(' '));
 const language=value=>{
  const code=value?.toLowerCase().split(/[-_]/)[0];
  return languages.has(code)?code:(/^[a-z]{2,3}$/.test(code||'')?code:'en');
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
 const voiceRequests=new Map();
 function voiceTranslation(locale,target,load,enabled){
  const labels=voiceCopy[locale]||voiceCopy.en;
  const section=document.createElement('div'),button=document.createElement('button'),status=document.createElement('small');
  section.className='connect-voice-translation';
  button.type='button';
  button.textContent='🌐 Перевести голос';
  status.setAttribute('role','status');
  const source=document.createElement('select');source.className='connect-voice-language';source.setAttribute('aria-label','Язык голосового сообщения');
  for(const [code,name] of [['auto','Автоязык'],['ru','Русский'],['vi','Tiếng Việt'],['en','English']]){const option=document.createElement('option');option.value=code;option.textContent=name;source.append(option);}
  section.append(source,button,status);
  if(!enabled){button.hidden=true;status.textContent=labels[2];return section;}
  let timer=null,attempts=0,loading=false;
  const request=async()=>{
   if(loading||!section.isConnected)return;
   loading=true;button.disabled=true;button.textContent=labels[1];status.textContent='Загружаем модели и распознаём речь на телефоне. Первый запуск может занять несколько минут…';
   try{
    const result=await load(source.value);
    if(!section.isConnected)return;
    if(result.status==='ready'){
     status.textContent=result.url?labels[3]:labels[5];
     const text=document.createElement('div');
     text.lang=target;text.dir='auto';text.textContent=result.text||'';
     section.querySelectorAll('.connect-voice-result').forEach(x=>x.remove());
     const resultBox=document.createElement('div');resultBox.className='connect-voice-result';
     if(result.transcript){const original=document.createElement('div');original.className='connect-voice-original';original.textContent='Распознано ('+({ru:'RU',vi:'VI',en:'EN'}[result.source]||'?')+'): '+result.transcript;resultBox.append(original);}
     resultBox.append(text);
     if(result.url){
      const audio=player('voice',result.url,labels[4]);
      audio.addEventListener('error',()=>{status.textContent=labels[2];button.hidden=false;button.textContent=labels[6];},{once:true});
      resultBox.append(audio);
     }
     if(result.local&&window.ummaLocalTranslate?.speak){const speak=document.createElement('button');speak.type='button';speak.textContent='▶ Озвучить перевод';speak.onclick=()=>window.ummaLocalTranslate.speak(result.text,target);resultBox.append(speak);}
     section.append(resultBox);button.hidden=true;
    }else if(result.status==='pending'&&attempts++<3){
     status.textContent=labels[7];
     timer=setTimeout(request,7000);
    }else{
     status.textContent=result.reason==='service_unavailable'?(locale==='ru'?'Сервис перевода временно недоступен. Оригинал можно прослушать.':labels[2]):labels[2];
     button.textContent='Повторить перевод';
    }
   }catch(error){
    console.warn('UMMA local voice translation',error);
    const details=String(error?.message||error||'').slice(0,100);
    status.textContent=labels[2]+(details?' · '+details:'');
    button.textContent='Повторить перевод';
   }finally{loading=false;button.disabled=false;}
  };
  button.onclick=()=>{if(timer)clearTimeout(timer);attempts=0;void request();};
  source.onchange=()=>{button.hidden=false;button.disabled=false;button.textContent='🌐 Перевести голос';status.textContent='Выбран язык: '+source.options[source.selectedIndex].textContent;};
  status.textContent='Бесплатный перевод на телефоне. Нажмите кнопку; при первом запуске загрузятся модели.';
  return section;
 }
 const albumType='application/octet-stream';
 async function albumFiles(url){
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error('Album unavailable');
  const blob=await response.blob();
  const header=await blob.slice(0,2048).text();
  const boundary=header.indexOf('\n');
  if(boundary<0)throw Error('Invalid album');
  const entries=JSON.parse(header.slice(0,boundary));
  if(!Array.isArray(entries)||entries.length<2||entries.length>10)throw Error('Invalid album');
  let offset=boundary+1;
  const files=entries.map(({type,size},index)=>{
   if(typeof type!=='string'||!/^(image|video)\//.test(type)||!Number.isSafeInteger(size)||size<=0||offset+size>blob.size)throw Error('Invalid album');
   const item=blob.slice(offset,offset+size,type);
   offset+=size;
   const extension=({'image/jpeg':'jpg','video/quicktime':'mov'})[type]||type.split('/')[1];
   return new File([item],'UMMA-'+(index+1)+'.'+extension,{type});
  });
  if(offset!==blob.size)throw Error('Invalid album');
  return files;
 }
 function inlineAlbum(labels,load){
  const wrapper=document.createElement('div'),open=document.createElement('button'),status=document.createElement('small');
  open.type='button';
  open.textContent=labels.album;
  status.setAttribute('role','status');
  const urls=[];
  const release=()=>{for(const url of urls)URL.revokeObjectURL(url);urls.length=0;};
  wrapper.releaseAlbum=release;
  const grid=document.createElement('div');
  Object.assign(grid.style,{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:'6px'});
  open.onclick=async()=>{
   open.disabled=true;
   status.textContent='';
   try{
    const files=await albumFiles(await load());
    if(!wrapper.isConnected)return;
    for(const file of files){
     const url=URL.createObjectURL(file),kind=file.type.startsWith('image/')?'photo':'video';
     urls.push(url);
     const media=inlineAttachment(kind,labels[kind],async()=>url,labels.error);
     media.style.minWidth='0';
     grid.append(media);
    }
    open.hidden=true;
   }catch{release();grid.replaceChildren();status.textContent=labels.error;}
   finally{open.disabled=false;}
  };
  wrapper.className='connect-inline-album';
  wrapper.append(open,status,grid);
  return wrapper;
 }
 async function upload(api,identity,draft,requestKey,body,error){
  const album=draft.kind==='album';
  const files=album?draft.items.map(item=>item.file):[draft.file];
  const manifest=album?[JSON.stringify(files.map(({type,size})=>({type,size}))),'\n']:[];
  const response=await fetch(api,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(120000),
   headers:{'Content-Type':album?albumType:draft.file.type,'X-Umma-Request':requestKey,...identity},
   body:new Blob([JSON.stringify(body),'\n',...manifest,...files])});
  const result=await response.json();
  if(!response.ok||!result.ok)throw Error(result.error||error(result.code,draft.kind));
  return result;
 }
 function releaseAlbums(container){
  for(const album of container.querySelectorAll('.connect-inline-album'))album.releaseAlbum();
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
  for(const row of rows.values()){
   releaseAlbums(row);
   row.remove();
  }
 }
 window.ummaConnectMedia={player,attachment,inlineAttachment,inlineAlbum,albumFiles,releaseAlbums,videoCircle,translatedText,render,language,voiceTranslation,upload};
})();
