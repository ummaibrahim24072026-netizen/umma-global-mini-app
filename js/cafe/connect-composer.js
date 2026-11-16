/* Media drafts stay local until the customer presses Send. */
(() => {
 'use strict';
 const formats={
  photo:['image/jpeg','image/png','image/webp'],
  video:['video/mp4','video/webm','video/quicktime'],
  voice:['audio/webm','audio/mp4','audio/ogg']
 };
 const limits={photo:8,video:20,voice:5};
 const copy={
  ru:['Фото','Видео','Записать голосовое','Остановить запись','Убрать вложение','Идёт запись, до 60 секунд.','Разрешите доступ к микрофону.','Микрофон недоступен.','Прослушайте запись перед отправкой.','Размер файла превышает лимит','Формат файла не поддерживается.','Не удалось отправить вложение. Повторите попытку.'],
  en:['Photo','Video','Record voice message','Stop recording','Remove attachment','Recording, up to 60 seconds.','Allow microphone access.','Microphone unavailable.','Listen to the recording before sending.','File exceeds the size limit of','Unsupported file format.','Could not send attachment. Try again.'],
  vi:['Ảnh','Video','Ghi âm tin nhắn','Dừng ghi âm','Xóa tệp đính kèm','Đang ghi âm, tối đa 60 giây.','Cho phép truy cập micrô.','Micrô không khả dụng.','Nghe lại bản ghi trước khi gửi.','Tệp vượt quá giới hạn','Định dạng tệp không được hỗ trợ.','Không gửi được tệp. Hãy thử lại.']
 };
 const compactCopy={
  ru:['Прикрепить фото или видео','Снять фото','Снять видео','Отменить запись'],
  en:['Attach photo or video','Take photo','Record video','Cancel recording'],
  vi:['Đính kèm ảnh hoặc video','Chụp ảnh','Quay video','Hủy ghi âm']
 };
 const icons={
  clip:'M21 11.5l-8.8 8.8a5 5 0 0 1-7.1-7.1l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.2 9.2a2 2 0 0 1-2.8-2.8l8-8',
  mic:'M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0z M5 11v1a7 7 0 0 0 14 0v-1 M12 19v4 M9 23h6',
  stop:'M6 6h12v12H6z'
 };
 function iconButton(control,icon,label){
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('aria-hidden','true');
  path.setAttribute('d',icons[icon]);
  svg.append(path);
  control.replaceChildren(svg);
  control.setAttribute('aria-label',label);
  control.title=label;
 }
 function showWaveform(stream,bars){
  for(const bar of bars)bar.style.removeProperty('height');
  const AudioContext=window.AudioContext||window.webkitAudioContext;
  if(!AudioContext||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  let context,timer;
  const stop=()=>{
   clearInterval(timer);
   if(context)void context.close().catch(()=>{});
  };
  try{
   context=new AudioContext();
   const source=context.createMediaStreamSource(stream);
   const analyser=context.createAnalyser();
   analyser.fftSize=512;
   source.connect(analyser);
   const samples=new Uint8Array(analyser.fftSize);
   const levels=bars.map(()=>0);
   void context.resume().catch(()=>{});
   timer=setInterval(()=>{
    if(context.state!=='running')return;
    analyser.getByteTimeDomainData(samples);
    let energy=0;
    for(const sample of samples)energy+=((sample-128)/128)**2;
    const level=Math.sqrt(energy/samples.length);
    levels.shift();
    levels.push(Math.min(1,level*4));
    bars.forEach((bar,index)=>{bar.style.height=Math.round(3+levels[index]*23)+'px';});
   },70);
   return stop;
  }catch{
   stop();
  }
 }
 window.ummaConnectComposer=({lang,el,form,body,send,status,onChange,kinds=['photo','video'],compact=false})=>{
  const labels=copy[lang]||copy.en, compactLabels=compactCopy[lang]||compactCopy.en;
  const bar=el('div',null,'connect-media-tools'),preview=el('div',null,'connect-media-preview');
  let draft=null,url=null,recording=null,generation=0,starting=false,working=false;
  const pickers=[];
  let attach,recordPanel,elapsed,waveBars;
  function showAttachments(open){
   if(!attach)return;
   bar.hidden=!open;
   attach.setAttribute('aria-expanded',String(open));
  }
  function button(label,action){
   const control=el('button',label);
   control.type='button';
   control.onclick=action;
   return control;
  }
  function controls(){
   const active=starting||!!recording;
   for(const picker of pickers)picker.disabled=working||active;
   body.disabled=send.disabled=working||active;
   mic.disabled=working||starting;
   remove.disabled=working||active;
   const micLabel=recording?labels[3]:labels[2];
   if(compact){
    const canSend=!!draft||!!body.value.trim();
    attach.disabled=working||active;
    if(attach.disabled)showAttachments(false);
    send.hidden=active||!canSend;
    mic.hidden=!active&&canSend;
    recordPanel.hidden=!recording;
    iconButton(mic,recording?'stop':'mic',micLabel);
   }else mic.textContent=micLabel;
  }
  function sizeError(kind){return labels[9]+' '+limits[kind]+' MB.';}
  function setDraft(file,kind){
   if(url)URL.revokeObjectURL(url);
   url=null;
   draft=file?{file,kind}:null;
   onChange();
   preview.replaceChildren();
   if(file){
    url=URL.createObjectURL(file);
    preview.append(window.ummaConnectMedia.player(kind,url,labels[kind==='photo'?0:kind==='video'?1:2]),remove);
   }
   controls();
  }
  function addPicker(kind,label,capture=false){
   const input=el('input');
   input.type='file';
   input.hidden=true;
   input.accept=formats[kind].join(',');
   if(capture)input.setAttribute('capture','environment');
   input.onchange=()=>{
    const file=input.files[0];
    input.value='';
    if(!file||working||recording||starting)return;
    if(!formats[kind].includes(file.type)){status.textContent=labels[10];return;}
    if(!file.size||file.size>limits[kind]*1024*1024){status.textContent=sizeError(kind);return;}
    setDraft(file,kind);
    status.textContent='';
   };
   const picker=button(label,()=>{showAttachments(false);attach?.focus();input.click();});
   pickers.push(picker);
   bar.append(input,picker);
  }
  for(const kind of kinds)addPicker(kind,labels[kind==='photo'?0:1]);
  if(compact){
   addPicker('photo',compactLabels[1],true);
   addPicker('video',compactLabels[2],true);
  }
  function release(r){
   clearTimeout(r.timer);
   clearInterval(r.clock);
   r.stopWaveform?.();
   r.stopWaveform=null;
   r.stream.getTracks().forEach(track=>track.stop());
  }
  function stop(r,discard=false){
   r.discard=r.discard||discard;
   if(r.recorder.state!=='inactive')r.recorder.stop();
   release(r);
  }
  async function record(){
   if(recording){stop(recording);return;}
   if(starting||working)return;
   const mime=formats.voice.find(type=>window.MediaRecorder?.isTypeSupported(type));
   if(!mime||!navigator.mediaDevices?.getUserMedia){status.textContent=labels[7];return;}
   const current=++generation;
   starting=true;
   controls();
   status.textContent=labels[6];
   let stream;
   try{
    stream=await navigator.mediaDevices.getUserMedia({audio:true});
    if(current!==generation){stream.getTracks().forEach(track=>track.stop());return;}
    const recorder=new MediaRecorder(stream,{mimeType:mime}),chunks=[];
    const r={recorder,stream,timer:null,discard:false};
    recording=r;
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onerror=()=>{status.textContent=labels[7];stop(r,true);};
    recorder.onstop=()=>{
     release(r);
     if(recording!==r)return;
     recording=null;
     controls();
     if(r.discard)return;
     const type=(recorder.mimeType||mime).split(';')[0];
     const audio=new Blob(chunks,{type});
     if(!audio.size||!formats.voice.includes(type)){status.textContent=labels[10];return;}
     if(audio.size>limits.voice*1024*1024){status.textContent=sizeError('voice');return;}
     setDraft(audio,'voice');
     status.textContent=labels[8];
    };
    recorder.start();
    r.timer=setTimeout(()=>stop(r),60000);
    if(compact){
     const started=performance.now();
     elapsed.textContent='0:00';
     r.stopWaveform=showWaveform(stream,waveBars);
     r.clock=setInterval(()=>{
      const seconds=Math.min(60,Math.floor((performance.now()-started)/1000));
      elapsed.textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
     },250);
    }
    status.textContent=labels[5];
   }catch{
    stream?.getTracks().forEach(track=>track.stop());
    if(current===generation){recording=null;status.textContent=labels[7];}
   }finally{
    if(current===generation){starting=false;controls();}
   }
  }
  const mic=button(labels[2],record),remove=button(labels[4],()=>{setDraft(null);status.textContent='';});
  if(compact){
   form.classList.add('connect-compose-compact');
   attach=button(compactLabels[0],()=>showAttachments(bar.hidden));
   attach.className='connect-attach';
   iconButton(attach,'clip',compactLabels[0]);
   bar.id='umma-connect-attachments';
   attach.setAttribute('aria-controls',bar.id);
   showAttachments(false);
   mic.className='primary connect-mic';
   elapsed=el('span','0:00','connect-record-time');
   recordPanel=el('div',null,'connect-record-panel');
   const waveform=el('div',null,'connect-record-wave');
   waveform.setAttribute('aria-hidden','true');
   waveBars=Array.from({length:22},()=>el('span'));
   waveform.append(...waveBars);
   recordPanel.append(elapsed,waveform,button(compactLabels[3],()=>{
    if(recording)stop(recording,true);
    status.textContent='';
   }));
   form.prepend(attach,bar,preview,recordPanel);
   form.append(mic);
   form.addEventListener('focusout',event=>{
    if(event.relatedTarget!==attach&&!bar.contains(event.relatedTarget))showAttachments(false);
   });
   form.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||bar.hidden)return;
    event.preventDefault();
    showAttachments(false);
    attach.focus();
   });
   body.addEventListener('input',controls);
   controls();
  }else{
   bar.append(mic);
   form.insertBefore(bar,send);
   form.insertBefore(preview,send);
  }
  return {
   get draft(){return draft;},
   get recording(){return starting||!!recording;},
   busy(value){working=value;controls();},
   clear(){setDraft(null);},
   close(){
    showAttachments(false);
    generation++;
    starting=false;
    if(recording){stop(recording,true);recording=null;}
    preview.querySelector('audio,video')?.pause();
    controls();
   },
   error(code,kind){return code==='MEDIA_SIZE'?sizeError(kind):code==='MEDIA_FORMAT'?labels[10]:labels[11];}
  };
 };
})();
