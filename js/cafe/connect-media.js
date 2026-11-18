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
  const wave=document.createElement('div');
  wave.style.cssText='height:46px;width:100%;position:relative;cursor:pointer;align-self:stretch;transform:translateY(4px)';
  const ns='http://www.w3.org/2000/svg';
  const waveform=document.createElementNS(ns,'svg');waveform.setAttribute('viewBox','0 0 652 91');waveform.setAttribute('preserveAspectRatio','xMidYMid meet');
  waveform.setAttribute('aria-hidden','true');waveform.style.cssText='display:block;width:100%;height:100%;overflow:visible';
  const heights=[14,82,34,40,14,28,62,26,90,32,65,32,18,82,18,84,40,40,18,26,62,22,90,34,65,34,17,34,28,82,20,84,42,42,20,26,60,20,90,36,65,40];
  const positions=[0,15,30,45,60,74,89,104,119,134,149,164,179,194,239,254,269,284,299,314,329,344,358,373,388,403,418,433,448,463,478,493,508,523,538,553,568,583,598,613,627,642];
  const bars=heights.map((h,i)=>{const bar=document.createElementNS(ns,'rect');bar.setAttribute('x',positions[i]);bar.setAttribute('y',(91-h)/2);bar.setAttribute('width',9);bar.setAttribute('height',h);bar.setAttribute('rx',4.5);bar.setAttribute('fill',i<14?'#0a9998':'#a4c5c1');waveform.append(bar);return bar;});
  const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx','218');dot.setAttribute('cy','45.5');dot.setAttribute('r','17');dot.setAttribute('fill','#168fe0');waveform.append(dot);
  wave.append(waveform);
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
   time.textContent=audio.currentTime>0?fmt(audio.currentTime):fmt(duration);dot.setAttribute('cx',String(17+Number(seek.value)/1000*618));
   const count=Math.round(Number(seek.value)/1000*bars.length);
   bars.forEach((bar,i)=>bar.setAttribute('fill',i<count?'#0a9998':'#a4c5c1'));
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
 let activeVoice;
 function formatVoiceTime(seconds){
  const value=Math.max(0,Math.floor(seconds));
  return Math.floor(value/60)+':'+String(value%60).padStart(2,'0');
 }
 function publicVoice(load,errorText,{lang,avatar,levels=[],duration=0}){
  const words=({
   ru:['Воспроизвести','Пауза','Перемотать запись','Скорость воспроизведения'],
   vi:['Phát','Tạm dừng','Tua tin nhắn thoại','Tốc độ phát']
  })[lang]||['Play','Pause','Seek voice message','Playback speed'];
  const node=(tag,className)=>Object.assign(document.createElement(tag),{className});
  const button=(className,label,value)=>{
   const control=node('button',className);
   control.type='button';control.textContent=value;control.setAttribute('aria-label',label);
   return control;
  };
  const wrapper=node('div','connect-public-voice');
  const play=button('connect-voice-play',words[0],'▶');
  const track=node('div','connect-voice-track');
  const bars=node('div','connect-voice-bars');
  bars.setAttribute('aria-hidden','true');
  const columns=Array.from({length:40},()=>node('span',''));
  bars.append(...columns);
  const seek=node('input','connect-voice-seek');
  seek.type='range';seek.min='0';seek.max='1000';seek.value='0';seek.disabled=true;
  seek.setAttribute('aria-label',words[2]);
  const thumb=node('span','connect-voice-position');
  thumb.setAttribute('aria-hidden','true');
  track.append(bars,thumb,seek);
  const time=node('small','connect-voice-duration');
  const speed=button('connect-voice-speed',words[3],'1×');
  const status=node('small','connect-voice-error');
  status.setAttribute('role','status');
  const audio=node('audio','');
  audio.preload='metadata';
  wrapper.append(play,track,speed,time,status,audio);
  if(avatar){
   const badge=node('span','connect-voice-avatar');
   const image=node('img','');
   image.src=avatar;image.alt='';
   badge.append(image);
   wrapper.prepend(badge);
  }
  let loading,url,decoding,pendingSeek;
  function draw(samples){
   columns.forEach((column,index)=>{
    const start=Math.floor(index*samples.length/columns.length);
    const end=Math.max(start+1,Math.floor((index+1)*samples.length/columns.length));
    let peak=0;
    for(let i=start;i<end;i++)peak=Math.max(peak,samples[i]||0);
    column.style.setProperty('--level',String(peak));
   });
  }
  draw(levels);
  function update(){
   const length=Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:duration;
   if(pendingSeek!==undefined&&length&&audio.readyState>=1){
    try{audio.currentTime=length*pendingSeek;pendingSeek=undefined;}catch{}
   }
   seek.disabled=!length||audio.readyState<1;
   const fraction=pendingSeek??(length?Math.min(1,audio.currentTime/length):0);
   seek.value=String(Math.round(fraction*1000));
   thumb.style.setProperty('--position',fraction*100+'%');
   columns.forEach((column,i)=>column.classList.toggle('is-played',(i+.5)/columns.length<=fraction));
   time.textContent=length?formatVoiceTime(!audio.paused||audio.currentTime>0?audio.currentTime:length):'–:––';
  }
  async function decode(source){
   const AudioContext=window.AudioContext||window.webkitAudioContext;
   if(!AudioContext)return;
   let context;
   try{
    const response=await fetch(source,{signal:AbortSignal.timeout(15000)});
    if(!response.ok||!wrapper.isConnected)return;
    const bytes=await response.arrayBuffer();
    context=new AudioContext();
    const buffer=await context.decodeAudioData(bytes);
    if(!wrapper.isConnected)return;
    const peaks=new Array(80).fill(0);
    for(let channel=0;channel<buffer.numberOfChannels;channel++){
     const samples=buffer.getChannelData(channel);
     for(let index=0;index<samples.length;index+=4){
      const bin=Math.floor(index/samples.length*peaks.length);
      peaks[bin]=Math.max(peaks[bin],Math.abs(samples[index]));
     }
    }
    const max=Math.max(.12,...peaks);
    draw(peaks.map(peak=>Math.sqrt(peak/max)));
    duration=buffer.duration;
    update();
   }catch{}finally{
    if(context)void context.close().catch(()=>{});
   }
  }
  function prepare(){
   if(url)return Promise.resolve(true);
   if(loading)return loading;
   loading=(async()=>{
    try{
     const source=await load();
     if(!wrapper.isConnected)return false;
     url=source;
     audio.src=source;
     status.textContent='';
     if(!levels.length&&decoding!==source){decoding=source;void decode(source);}
     return true;
    }catch{status.textContent=errorText;return false;}
    finally{loading=null;}
   })();
   return loading;
  }
  play.onclick=async()=>{
   if(!(await prepare()))return;
   try{if(audio.paused)await audio.play();else audio.pause();}
   catch{status.textContent=errorText;}
  };
  for(const event of ['loadedmetadata','durationchange','timeupdate'])audio.addEventListener(event,update);
  audio.addEventListener('play',()=>{
   if(activeVoice&&activeVoice!==audio)activeVoice.pause();
   activeVoice=audio;
   play.textContent='Ⅱ';play.setAttribute('aria-label',words[1]);update();
  });
  audio.addEventListener('pause',()=>{
   if(activeVoice===audio)activeVoice=null;
   play.textContent='▶';play.setAttribute('aria-label',words[0]);update();
  });
  audio.addEventListener('ended',()=>{audio.currentTime=0;update();});
  audio.addEventListener('error',()=>{url=null;status.textContent=errorText;});
  seek.oninput=()=>{pendingSeek=Number(seek.value)/1000;update();};
  speed.onclick=()=>{
   const speeds=[1,1.5,2];
   audio.playbackRate=speeds[(speeds.indexOf(audio.playbackRate)+1)%speeds.length];
   speed.textContent=audio.playbackRate+'×';
  };
  update();
  if(window.IntersectionObserver){
   const observer=new IntersectionObserver(entries=>{
    if(!entries.some(entry=>entry.isIntersecting))return;
    observer.disconnect();void prepare();
   });
   observer.observe(wrapper);
  }
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
   if(read)read.textContent=receipt(message,row);
   if(list.children[index]!==row)list.insertBefore(row,list.children[index]||null);
   rows.delete(message.id);
  });
  for(const row of rows.values()){
   releaseAlbums(row);
   row.remove();
  }
 }
 window.ummaConnectMedia={player,attachment,publicVoice,formatVoiceTime,inlineAttachment,inlineAlbum,albumFiles,releaseAlbums,videoCircle,translatedText,render,language,voiceTranslation,upload};
})();
