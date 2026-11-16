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
 const cameraCopy={
  ru:['Отмена','Выбрать из галереи','Открываем камеру…','Камера недоступна. Разрешите доступ к камере или выберите фото из галереи.','Не удалось сделать снимок. Попробуйте ещё раз.'],
  en:['Cancel','Choose from gallery','Opening camera…','Camera unavailable. Allow camera access or choose a photo from the gallery.','Could not take the photo. Try again.'],
  vi:['Hủy','Chọn từ thư viện','Đang mở camera…','Không mở được camera. Hãy cấp quyền hoặc chọn ảnh từ thư viện.','Không chụp được ảnh. Hãy thử lại.']
 };
 const videoCopy={
  ru:['Остановить видео','Идёт видеозапись, до 60 секунд.','Видеозапись недоступна. Проверьте доступ к камере и микрофону или выберите видео из галереи.','Не удалось сохранить видео. Попробуйте ещё раз.'],
  en:['Stop video','Recording video, up to 60 seconds.','Video recording is unavailable. Check camera and microphone permissions or choose a video from the gallery.','Could not save the video. Try again.'],
  vi:['Dừng quay video','Đang quay video, tối đa 60 giây.','Không thể quay video. Hãy kiểm tra quyền camera và micrô hoặc chọn video từ thư viện.','Không lưu được video. Hãy thử lại.']
 };
 const videoDuration=60000;
 const expressionCopy={
  ru:['Эмодзи','Стикеры','Не удалось добавить стикер'],
  en:['Emoji','Stickers','Could not add sticker'],
  vi:['Biểu tượng cảm xúc','Nhãn dán','Không thể thêm nhãn dán']
 };
 const emoji='😀 😄 😂 🤣 😊 😍 🥰 😎 🤔 😅 😋 🙃 😮 😢 😭 😡 👍 👎 👏 🙌 🤝 👋 🤲 ❤️ 🔥 ✅ 🎉 ✨ 💯 ☕ 🍽️ 🥤 🥟'.split(' ');
 const stickers='👋 👍 ❤️ 😊 🎉 🙌 🔥 😍 😋 🤝 ☕ 🥟'.split(' ');
 function stickerImage(symbol){
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=192;
  const context=canvas.getContext('2d');
  context.fillStyle='#dbf6f2';
  context.beginPath();
  context.arc(96,96,90,0,2*Math.PI);
  context.fill();
  context.lineWidth=4;
  context.strokeStyle='#d2ab60';
  context.stroke();
  context.font='112px system-ui, "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  context.textAlign='center';
  context.textBaseline='middle';
  context.fillText(symbol,96,99);
  const bytes=Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]),char=>char.charCodeAt(0));
  return new Blob([bytes],{type:'image/png'});
 }
 const icons={
  clip:'M21 11.5l-8.8 8.8a5 5 0 0 1-7.1-7.1l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.2 9.2a2 2 0 0 1-2.8-2.8l8-8',
  mic:'M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0z M5 11v1a7 7 0 0 0 14 0v-1 M12 19v4 M9 23h6',
  stop:'M6 6h12v12H6z',
  smile:'M21 10v3l-7 8h-4a7 7 0 0 1-7-7v-4a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7z M14 21v-4a4 4 0 0 1 4-4h3 M8 9h.01 M15 9h.01 M8 14c1 2 3 2 5 1',
  camera:'M3 7h4l2-3h6l2 3h4v13H3z M16 13a4 4 0 1 1-8 0 4 4 0 1 1 8 0z'
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
 window.ummaConnectComposer=({lang,el,form,body,send,status,onChange,kinds=['photo','video'],compact=false,onInstantVideo=null})=>{
  const labels=copy[lang]||copy.en, compactLabels=compactCopy[lang]||compactCopy.en;
  const bar=el('div',null,'connect-media-tools'),preview=el('div',null,'connect-media-preview');
  let draft=null,url=null,recording=null,generation=0,starting=false,working=false;
  const pickers=[];
  const cameraLabels=cameraCopy[lang]||cameraCopy.en;
  const videoLabels=videoCopy[lang]||videoCopy.en;
  const gallery={};
  let cameraSession=null,cameraPanel,cameraPreview,shutter,flipCamera;let circleFacing='user';
  let attach,expression,camera,expressionPanel,recordPanel,elapsed,waveBars,circleButton,circlePanel,circlePreview,circleTimer,circleSession=null;
  function showExpressions(open){
   if(!expression)return;
   if(open)showAttachments(false);
   expressionPanel.hidden=!open;
   expression.setAttribute('aria-expanded',String(open));
  }
  function showAttachments(open){
   if(!attach)return;
   if(open)showExpressions(false);
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
   const active=starting||!!recording||!!cameraSession||!!circleSession;
   for(const picker of pickers)picker.disabled=working||active;
   body.disabled=send.disabled=working||active;
   mic.disabled=working||starting||!!cameraSession;
   remove.disabled=working||active;
   const micLabel=recording?labels[3]:labels[2];
   if(compact){
    const canSend=!!draft||!!body.value.trim();
    attach.disabled=expression.disabled=camera.disabled=working||active;
    if(circleButton)circleButton.disabled=working||starting||!!recording||!!cameraSession;
    if(attach.disabled){
     showAttachments(false);
     showExpressions(false);
    }
    send.hidden=active||!canSend;
    mic.hidden=!!cameraSession||(!active&&canSend);
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
  function addPicker(kind,label){
   const input=el('input');
   input.type='file';
   input.hidden=true;
   input.accept=formats[kind].join(',');
   input.onchange=()=>{
    const file=input.files[0];
    input.value='';
    if(!file||working||recording||starting||cameraSession)return;
    if(!formats[kind].includes(file.type)){status.textContent=labels[10];return;}
    if(!file.size||file.size>limits[kind]*1024*1024){status.textContent=sizeError(kind);return;}
    setDraft(file,kind);
    status.textContent='';
   };
   const picker=button(label,()=>{showAttachments(false);attach?.focus();input.click();});
   pickers.push(picker);
   bar.append(input,picker);
   return input;
  }
  for(const kind of kinds)gallery[kind]=addPicker(kind,labels[kind==='photo'?0:1]);
  function releaseCamera(session){
   session.stream?.getTracks().forEach(track=>track.stop());
   session.stream=null;
   cameraPreview.srcObject=null;
  }
  function closeCamera(){
   if(!cameraSession)return;
   const session=cameraSession;
   cameraSession=null;
   clearTimeout(session.timer);
   if(session.recorder&&session.recorder.state!=='inactive')session.recorder.stop();
   releaseCamera(session);
   cameraPanel.hidden=true;
   controls();
  }
  async function openCamera(kind,facing='environment'){
   if(cameraSession||working||starting||recording)return;
   const video=kind==='video';
   const session={kind,stream:null,recorder:null,timer:null,facing};
   if(video)session.mime=['video/webm','video/mp4'].find(type=>window.MediaRecorder?.isTypeSupported?.(type));
   cameraSession=session;
   cameraPanel.hidden=false;
   cameraPreview.hidden=true;
   shutter.disabled=true;
   shutter.textContent=compactLabels[video?2:1];
   controls();
   if(video&&!session.mime){status.textContent=videoLabels[2];return;}
   status.textContent=cameraLabels[2];
   try{
    const stream=await navigator.mediaDevices.getUserMedia({
     audio:video,
     video:{
      facingMode:{ideal:session.facing},
      width:{ideal:1280},height:{ideal:video?720:960},
      ...(video?{frameRate:{ideal:24,max:30}}:{})
     }
    });
    if(cameraSession!==session){
     stream.getTracks().forEach(track=>track.stop());
     return;
    }
    session.stream=stream;
    cameraPreview.srcObject=stream;
    cameraPreview.hidden=false;
    await cameraPreview.play();
    if(cameraSession!==session)return;
    shutter.disabled=false;
    if(flipCamera)flipCamera.disabled=false;
    status.textContent='';
   }catch{
    if(cameraSession!==session)return;
    releaseCamera(session);
    cameraPreview.hidden=true;
    status.textContent=video?videoLabels[2]:cameraLabels[3];
   }
  }
  function takePhoto(){
   const session=cameraSession;
   const {videoWidth:width,videoHeight:height}=cameraPreview;
   if(!session?.stream||!width||!height)return;
   shutter.disabled=true;
   function finish(file){
    if(cameraSession!==session)return;
    shutter.disabled=false;
    if(!file?.size){status.textContent=cameraLabels[4];return;}
    if(file.size>limits.photo*1024*1024){status.textContent=sizeError('photo');return;}
    closeCamera();
    setDraft(file,'photo');
    status.textContent='';
   }
   try{
    const canvas=el('canvas');
    const scale=Math.min(1,1600/Math.max(width,height));
    canvas.width=Math.max(1,Math.round(width*scale));
    canvas.height=Math.max(1,Math.round(height*scale));
    canvas.getContext('2d').drawImage(cameraPreview,0,0,canvas.width,canvas.height);
    canvas.toBlob(finish,'image/jpeg',0.85);
   }catch{finish(null);}
  }
  function recordVideo(session){
   function stopVideo(){
    clearTimeout(session.timer);
    shutter.disabled=true;
    if(session.recorder.state!=='inactive')session.recorder.stop();
   }
   if(session.recorder){stopVideo();return;}
   const chunks=[];
   const maxBytes=limits.video*1024*1024;
   let size=0;
   try{
    const recorder=new MediaRecorder(session.stream,{
     mimeType:session.mime,videoBitsPerSecond:1800000,audioBitsPerSecond:96000
    });
    session.recorder=recorder;
    recorder.ondataavailable=event=>{
     if(cameraSession!==session||!event.data.size)return;
     size+=event.data.size;
     if(size>maxBytes){
      closeCamera();
      status.textContent=sizeError('video');
      return;
     }
     chunks.push(event.data);
    };
    recorder.onerror=()=>{
     if(cameraSession!==session)return;
     closeCamera();
     status.textContent=videoLabels[3];
    };
    recorder.onstop=()=>{
     if(cameraSession!==session)return;
     closeCamera();
     const type=(recorder.mimeType||session.mime).split(';')[0];
     if(!size||!formats.video.includes(type)){status.textContent=videoLabels[3];return;}
     setDraft(new Blob(chunks,{type}),'video');
     status.textContent='';
    };
    recorder.start(1000);
    session.timer=setTimeout(stopVideo,videoDuration);
    shutter.textContent=videoLabels[0];
    status.textContent=videoLabels[1];
   }catch{
    closeCamera();
    status.textContent=videoLabels[3];
   }
  }
  if(compact){
   for(const kind of kinds){
    const picker=button(compactLabels[kind==='photo'?1:2],()=>openCamera(kind));
    pickers.push(picker);
    bar.append(picker);
   }
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

  // Hold to record, release to send. Camera permissions are requested directly
  // from the pointer gesture; a pending permission request can be cancelled safely.
  async function beginCircle(event){
   if(circleSession){if(circleSession.tapMode)finishCircle(circleSession,false);return;}
   if(working||starting||recording||cameraSession||!onInstantVideo)return;
   if(event?.button!==undefined&&event.button!==0)return;
   event?.preventDefault();
   const session={held:true,pressAt:performance.now(),tapMode:false,cancelled:false,stream:null,recorder:null,chunks:[],bytes:0,timer:null,clock:null};
   circleSession=session;
   try{circleButton.setPointerCapture?.(event.pointerId);}catch{}
   circlePanel.hidden=false;
   circleTimer.textContent='0:00';
   circleButton.classList.add('is-recording');
   if(flipCamera)flipCamera.disabled=false;
   controls();
   try{
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('camera');
    const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:{facingMode:circleFacing,width:{ideal:480},height:{ideal:480},frameRate:{ideal:24}}});
    if(circleSession!==session||session.cancelled||!session.held){stream.getTracks().forEach(t=>t.stop());finishCircle(session,true);return;}
    session.stream=stream;
    circlePreview.srcObject=stream;
    await circlePreview.play();
    if(circleSession!==session||!session.held){finishCircle(session,true);return;}
    const mime=['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
    if(!mime)throw Error('format');
    const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:850000,audioBitsPerSecond:64000});
    session.recorder=recorder;
    recorder.ondataavailable=e=>{
     if(!e.data.size)return;
     session.bytes+=e.data.size;
     if(session.bytes>limits.video*1024*1024){session.cancelled=true;finishCircle(session,true);return;}
     session.chunks.push(e.data);
    };
    recorder.onerror=()=>{session.cancelled=true;finishCircle(session,true);status.textContent=videoLabels[3];};
    recorder.onstop=async()=>{
     const valid=!session.cancelled&&session.bytes>0;
     const type=(recorder.mimeType||mime).split(';')[0];
     const file=valid?new Blob(session.chunks,{type}):null;
     finishCircle(session,true);
     session.stream?.getTracks().forEach(t=>t.stop());
     if(!file||!formats.video.includes(type))return;
     try{await onInstantVideo(file);}catch(e){status.textContent=e?.message||labels[11];}
    };
    recorder.start(250);
    const start=performance.now();
    session.clock=setInterval(()=>{
     const seconds=Math.floor((performance.now()-start)/1000);
     circleTimer.textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
    },250);
    session.timer=setTimeout(()=>finishCircle(session,false),videoDuration);
    status.textContent='';
   }catch{
    finishCircle(session,true);
    status.textContent=videoLabels[2];
   }
  }
  async function flipCurrentCamera(){
   if(cameraSession){
    if(cameraSession.recorder)return;
    const session=cameraSession;
    session.facing=session.facing==='user'?'environment':'user';
    session.stream?.getTracks().forEach(track=>track.stop());
    session.stream=null;
    cameraPreview.srcObject=null;
    cameraSession=null;
    cameraPanel.hidden=true;
    controls();
    await openCamera(session.kind,session.facing);
    return;
   }
   if(circleSession){
    const old=circleSession;
    if(old.recorder?.state==='recording')return;
    circleFacing=circleFacing==='user'?'environment':'user';
    finishCircle(old,true);
    beginCircle();
   }else circleFacing=circleFacing==='user'?'environment':'user';
  }
  function finishCircle(session,discard){
   if(!session)return;
   session.held=false;
   session.cancelled ||= discard;
   clearTimeout(session.timer);
   clearInterval(session.clock);
   if(circleSession===session){
    circleSession=null;
    circlePanel.hidden=true;
    circleButton.classList.remove('is-recording');
    circlePreview.pause();
    circlePreview.srcObject=null;
    controls();
   }
   if(session.recorder?.state==='recording'){
    try{session.recorder.stop();}catch{}
   }
   if(session.recorder?.state!=='recording')session.stream?.getTracks().forEach(t=>t.stop());
  }
  function endCircle(event){
   const session=circleSession;
   if(!session)return;
   if(event?.type==='pointercancel')session.cancelled=true;
   if(event?.clientX!==undefined){
    const rect=circleButton.getBoundingClientRect();
    if(event.clientX<rect.left-70)session.cancelled=true;
   }
   if(session.cancelled){finishCircle(session,true);return;}
   if(performance.now()-session.pressAt<450){session.tapMode=true;return;}
   session.held=false;
   if(session.recorder)finishCircle(session,false);
   // If permissions are still pending, beginCircle will discard after resolution.
  }

  const mic=button(labels[2],record),remove=button(labels[4],()=>{setDraft(null);status.textContent='';});
  if(compact){
   form.classList.add('connect-compose-compact');
   attach=button(compactLabels[0],()=>showAttachments(bar.hidden));
   attach.className='connect-attach';
   iconButton(attach,'clip',compactLabels[0]);
   bar.id='umma-connect-attachments';
   attach.setAttribute('aria-controls',bar.id);
   const words=expressionCopy[lang]||expressionCopy.en;
   expression=button(words[0],()=>showExpressions(expressionPanel.hidden));
   expression.className='connect-expression';
   iconButton(expression,'smile',words[0]+' / '+words[1]);
   expressionPanel=el('div',null,'connect-expression-panel');
   expressionPanel.id='umma-connect-expressions';
   expression.setAttribute('aria-controls',expressionPanel.id);
   showExpressions(false);
   showAttachments(false);
   const tabs=el('div',null,'connect-expression-tabs');
   const choices=el('div',null,'connect-expression-choices');
   function selectExpressions(useStickers){
    emojiTab.setAttribute('aria-pressed',String(!useStickers));
    stickerTab.setAttribute('aria-pressed',String(useStickers));
    choices.replaceChildren(...(useStickers?stickers:emoji).map(symbol=>button(symbol,()=>{
     if(useStickers){
      try{
       setDraft(stickerImage(symbol),'photo');
       status.textContent='';
       showExpressions(false);
       expression.focus();
      }catch{status.textContent=words[2];}
     }else{
      const start=body.selectionStart,end=body.selectionEnd;
      if(body.value.length-(end-start)+symbol.length>body.maxLength)return;
      body.setRangeText(symbol,start,end,'end');
      body.dispatchEvent(new Event('input',{bubbles:true}));
     }
    })));
   }
   const emojiTab=button(words[0],()=>selectExpressions(false));
   const stickerTab=button(words[1],()=>selectExpressions(true));
   tabs.append(emojiTab,stickerTab);
   expressionPanel.append(tabs,choices);
   selectExpressions(false);
   camera=button(compactLabels[1],()=>openCamera('photo'));
   cameraPanel=el('div',null,'connect-camera-panel');
   cameraPanel.hidden=true;
   cameraPreview=el('video');
   cameraPreview.muted=true;
   cameraPreview.playsInline=true;
   shutter=button(compactLabels[1],()=>{
    if(cameraSession?.kind==='video')recordVideo(cameraSession);
    else takePhoto();
   });
   flipCamera=button('↻ Камера',flipCurrentCamera);
   cameraPanel.append(cameraPreview,flipCamera,shutter,button(cameraLabels[1],()=>{
    const input=gallery[cameraSession?.kind];
    closeCamera();
    status.textContent='';
    input?.click();
   }),button(cameraLabels[0],()=>{
    closeCamera();
    status.textContent='';
    camera.focus();
   }));
   camera.className='connect-camera';
   if(onInstantVideo){
    circleButton=button(lang==='ru'?'Удерживайте для видеокружка':'Hold for video note',()=>{});
    circleButton.className='connect-circle-button';
    iconButton(circleButton,'camera',lang==='ru'?'Удерживайте для видеокружка':'Hold for video note');
    circleButton.addEventListener('pointerdown',beginCircle);
    circleButton.addEventListener('pointerup',endCircle);
    circleButton.addEventListener('pointercancel',endCircle);
   circleButton.addEventListener('contextmenu',e=>e.preventDefault());
    circleButton.addEventListener('lostpointercapture',()=>{});
    circleButton.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(circleSession)finishCircle(circleSession,false);else beginCircle();}});
    circlePanel=el('div',null,'connect-circle-panel');
    circlePanel.hidden=true;
    circlePreview=el('video');
    circlePreview.muted=true;circlePreview.playsInline=true;
    circleTimer=el('span','0:00','connect-circle-timer');
    circlePanel.append(circlePreview,circleTimer);
    const flip=button('↻ Камера',flipCurrentCamera);
    flip.className='connect-flip-camera';
    circlePanel.append(flip);
   }
   iconButton(camera,'camera',compactLabels[1]);
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
   const entry=el('div',null,'connect-entry');
   entry.append(expression,body,attach,circleButton||camera);
   if(circleButton)form.prepend(circlePanel);
   form.prepend(bar,expressionPanel,preview,cameraPanel,recordPanel,entry);
   form.append(mic);
   form.addEventListener('focusout',event=>{
    if(event.relatedTarget!==attach&&!bar.contains(event.relatedTarget))showAttachments(false);
    if(event.relatedTarget!==expression&&!expressionPanel.contains(event.relatedTarget))showExpressions(false);
   });
   form.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    if(cameraSession){
     event.preventDefault();
     closeCamera();
     status.textContent='';
     camera.focus();
     return;
    }
    if(bar.hidden&&expressionPanel.hidden)return;
    event.preventDefault();
    const trigger=bar.hidden?expression:attach;
    showAttachments(false);
    showExpressions(false);
    trigger.focus();
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
   get recording(){return starting||!!recording||!!cameraSession||!!circleSession;},
   busy(value){working=value;controls();},
   clear(){setDraft(null);},
   close(){
    closeCamera();
    if(circleSession)finishCircle(circleSession,true);
    showAttachments(false);
    showExpressions(false);
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
