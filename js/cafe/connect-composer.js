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
  ru:['Остановить видео','Осталось','Видеозапись недоступна. Проверьте доступ к камере и микрофону или выберите видео из галереи.','Не удалось сохранить видео. Попробуйте ещё раз.'],
  en:['Stop video','Time left','Video recording is unavailable. Check camera and microphone permissions or choose a video from the gallery.','Could not save the video. Try again.'],
  vi:['Dừng quay video','Còn lại','Không thể quay video. Hãy kiểm tra quyền camera và micrô hoặc chọn video từ thư viện.','Không lưu được video. Hãy thử lại.']
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
  gallery:'M3 7V3h15m-8 9h.01M7 8h14v13H7z M7 18l4-4 3 3 2-2 5 5',
  video:'M3 6h13v12H3z M16 10l5-3v10l-5-3',
  flash:'M13 2L4 14h7l-1 8 10-12h-7l1-8z',
  flashOff:'M3 3l18 18M13 2l-2 3m-3 4-4 5h7l-1 8 5-6m2-3 3-3h-6l1-8',
  flip:'M20 9a8 8 0 0 0-13-3L4 9m0-5v5h5 M4 15a8 8 0 0 0 13 3l3-3m0 5v-5h-5',
  close:'M6 6l12 12M18 6L6 18',
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
  if(label){
   control.setAttribute('aria-label',label);
   control.title=label;
  }
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
 window.ummaConnectComposer=({lang,el,form,body,send,status,onChange,kinds=['photo','video'],compact=false,onInstantVideo=null,albums=false})=>{
  const labels=copy[lang]||copy.en, compactLabels=compactCopy[lang]||compactCopy.en;
  const bar=el('div',null,'connect-media-tools'),preview=el('div',null,'connect-media-preview');
  let drafts=[],recording=null,generation=0,starting=false,working=false;
  const pickers=[];
  const cameraLabels=cameraCopy[lang]||cameraCopy.en;
  const videoLabels=videoCopy[lang]||videoCopy.en;
  const gallery={};
  const attachmentLabels=({
   ru:['Вложения','Галерея','Камера','Видео','Закрыть вложения'],
   en:['Attachments','Gallery','Camera','Video','Close attachments'],
   vi:['Tệp đính kèm','Thư viện','Máy ảnh','Video','Đóng tệp đính kèm']
  })[lang]||['Attachments','Gallery','Camera','Video','Close attachments'];
  let cameraSession=null,cameraPanel,cameraPreview,cameraTimer,shutter,flipCamera,torch,cancelCamera;
  const modeButtons=new Map();
  const cameraModes=({ru:['Видео','Фото','Видеозаметка','Фонарик'],vi:['Video','Ảnh','Tin nhắn video','Đèn pin']})[lang]||['Video','Photo','Video note','Torch'];let circleFacing='user';
  let attach,expression,camera,expressionPanel,recordPanel,elapsed,waveBars,circleButton,circlePanel,circlePreview,circleTimer,circleSession=null,circleStop,circleSend,circleCancel,circleRing;
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
   if(albums)form.classList.toggle('connect-attachments-open',open);
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
   for(const remove of preview.querySelectorAll('.connect-draft-remove'))remove.disabled=working||active;
   const micLabel=recording?labels[3]:labels[2];
   if(compact){
    const canSend=drafts.length>0||!!body.value.trim();
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
  const albumLimit=20*1024*1024;
  function renderDrafts(){
   onChange();
   preview.style.display=drafts.length>1?'grid':'';
   preview.style.gridTemplateColumns=drafts.length>1?'repeat(2,minmax(0,1fr))':'';
   preview.replaceChildren(...drafts.map(item=>item.thumbnail));
   controls();
  }
  function clearDrafts(){
   for(const item of drafts)URL.revokeObjectURL(item.url);
   drafts=[];
  }
  function addDrafts(items){
   const batch=albums&&items[0].kind!=='voice'&&drafts[0]?.kind!=='voice';
   const existing=batch?drafts:[];
   const combined=[...existing,...items];
   if(combined.length>10||combined.length>1&&combined.reduce((size,item)=>size+item.file.size,0)>albumLimit-2048){
    status.textContent=({ru:'До 10 фото и видео, не более 20 МБ вместе.',vi:'Tối đa 10 ảnh và video, tổng dung lượng tối đa 20 MB.'}[lang]||'Up to 10 photos and videos, 20 MB total.');
    return;
   }
   if(!batch)clearDrafts();
   for(const {file,kind} of items){
    const url=URL.createObjectURL(file);
    const thumbnail=el('div',null,'connect-draft-thumbnail');
    Object.assign(thumbnail.style,{position:'relative',display:'inline-block',maxWidth:'100%',verticalAlign:'top'});
    const item={file,kind,url,thumbnail};
    thumbnail.append(window.ummaConnectMedia.player(kind,url,labels[kind==='photo'?0:kind==='video'?1:2]),removeButton(item));
    drafts.push(item);
   }
   status.textContent='';
   renderDrafts();
  }
  function setDraft(file,kind){addDrafts([{file,kind}]);}
  function addPicker(kind,label){
   const input=el('input');
   input.type='file';
   input.hidden=true;
   input.multiple=albums;
   const accepted=kind==='album'?[...formats.photo,...formats.video]:formats[kind];
   input.accept=accepted.join(',');
   input.onchange=()=>{
    const files=Array.from(input.files);
    input.value='';
    if(!files.length||working||recording||starting||cameraSession||circleSession)return;
    const items=[];
    for(const file of files){
     if(!accepted.includes(file.type)){status.textContent=labels[10];return;}
     const itemKind=file.type.startsWith('image/')?'photo':'video';
     if(!file.size||file.size>limits[itemKind]*1024*1024){status.textContent=sizeError(itemKind);return;}
     items.push({file,kind:itemKind});
    }
    addDrafts(items);
   };
   bar.append(input);
   if(!albums){
    const picker=button(label,()=>{showAttachments(false);attach?.focus();input.click();});
    pickers.push(picker);
    bar.append(picker);
   }
   return input;
  }
  for(const kind of kinds)gallery[kind]=addPicker(kind,labels[kind==='photo'?0:1]);
  function updateTorch(){
   if(!torch)return;
   const track=cameraSession?.stream?.getVideoTracks?.()[0];
   torch.hidden=!track?.getCapabilities?.().torch;
   const enabled=Boolean(track?.getSettings?.().torch);
   iconButton(torch,enabled?'flash':'flashOff',cameraModes[3]);
   torch.setAttribute('aria-pressed',String(enabled));
  }
  async function toggleTorch(){
   const track=cameraSession?.stream?.getVideoTracks?.()[0];
   if(!track)return;
   torch.disabled=true;
   try{await track.applyConstraints({advanced:[{torch:!track.getSettings().torch}]});}
   catch{torch.hidden=true;return;}
   finally{torch.disabled=false;}
   updateTorch();
  }
  function selectCameraMode(kind){
   if(!cameraSession||cameraSession.recorder||cameraSession.kind===kind)return;
   const {facing}=cameraSession;
   closeCamera();
   void openCamera(kind,facing);
  }
  function startVideoCountdown(session,timer){
   const deadline=performance.now()+videoDuration;
   const update=()=>{
    const seconds=Math.max(0,Math.ceil((deadline-performance.now())/1000));
    timer.textContent=videoLabels[1]+' '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
   };
   timer.hidden=false;
   update();
   session.clock=setInterval(update,250);
  }
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
   clearInterval(session.clock);
   cameraTimer.hidden=true;
   if(session.recorder&&session.recorder.state!=='inactive')session.recorder.stop();
   session.stopDrawing?.();
   session.recordStream?.getVideoTracks().forEach(t=>t.stop());
   releaseCamera(session);
   const restoreFocus=cameraPanel.contains(document.activeElement);
   cameraPanel.hidden=true;
   controls();
   if(restoreFocus)(albums?attach:camera).focus({preventScroll:true});
  }
  async function openCamera(kind,facing='environment'){
   if(cameraSession||working||starting||recording)return;
   const video=kind!=='photo';
   const session={kind,stream:null,recorder:null,timer:null,facing,flipping:false,recordStream:null,stopDrawing:null};
   if(video)session.mime=['video/webm','video/mp4'].find(type=>window.MediaRecorder?.isTypeSupported?.(type));
   cameraSession=session;
   cameraPanel.dataset.kind=kind;
   cameraPanel.hidden=false;
   cameraPreview.hidden=true;
   cameraPanel.setAttribute('aria-label',cameraModes[kind==='photo'?1:kind==='note'?2:0]);
   for(const [mode,button] of modeButtons){
    button.disabled=false;
    button.setAttribute('aria-pressed',String(kind===mode));
   }
   updateTorch();
   cancelCamera.focus({preventScroll:true});
   shutter.disabled=true;
   flipCamera.disabled=true;
   shutter.dataset.mode=video?'video':'photo';
   shutter.setAttribute('aria-label',compactLabels[video?2:1]);
   shutter.title=compactLabels[video?2:1];
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
    flipCamera.disabled=false;
    updateTorch();
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
  function createStableVideo(session,source,square){
   const canvas=document.createElement('canvas');
   if(square){
    canvas.width=canvas.height=480;
   }else{
    const {videoWidth:width,videoHeight:height}=source;
    if(!width||!height)throw Error('camera frame unavailable');
    const scale=Math.min(1,720/Math.max(width,height));
    canvas.width=Math.max(2,2*Math.round(width*scale/2));
    canvas.height=Math.max(2,2*Math.round(height*scale/2));
   }
   const ctx=canvas.getContext('2d');
   if(!ctx||!canvas.captureStream)throw Error('canvas unavailable');
   let active=true,frame=0;
   const draw=()=>{
    if(!active)return;
    if(source.readyState>=2&&source.videoWidth&&source.videoHeight){
     const w=source.videoWidth,h=source.videoHeight,cw=canvas.width,ch=canvas.height;
     const scale=square?Math.max(cw/w,ch/h):Math.min(cw/w,ch/h);
     const dw=w*scale,dh=h*scale;
     ctx.fillStyle='#000';
     ctx.fillRect(0,0,cw,ch);
     ctx.save();
     if(session.facing==='user'){ctx.translate(cw,0);ctx.scale(-1,1);}
     try{ctx.drawImage(source,(cw-dw)/2,(ch-dh)/2,dw,dh);}catch{}
     ctx.restore();
    }
    frame=requestAnimationFrame(draw);
   };
   draw();
   session.stopDrawing=()=>{active=false;cancelAnimationFrame(frame);};
   const stream=canvas.captureStream(24);
   session.recordStream=new MediaStream([...stream.getVideoTracks(),...session.stream.getAudioTracks()]);
   return session.recordStream;
  }
  // Keep the last real frame visible while Android releases and opens its camera.
  // The recorder captures a separate canvas, so its audio and timeline stay intact.
  async function switchStreamCamera(session,source){
   if(session.flipping||!session.stream)return;
   session.flipping=true;
   const next=session.facing==='user'?'environment':'user';
   const old=session.stream.getVideoTracks()[0];
   const active=()=>session.kind==='circle'?circleSession===session:cameraSession===session;
   const parent=source.parentElement;
   let freeze=null,replacement=null;
   try{
    if(parent&&source.videoWidth&&source.videoHeight){
     freeze=document.createElement('canvas');
     freeze.width=source.videoWidth;freeze.height=source.videoHeight;
     freeze.getContext('2d')?.drawImage(source,0,0,freeze.width,freeze.height);
     freeze.className='connect-camera-freeze';
     Object.assign(freeze.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:getComputedStyle(source).objectFit||'cover',pointerEvents:'none',zIndex:'2'});
     if(getComputedStyle(parent).position==='static')parent.style.position='relative';
     parent.append(freeze);
    }
    // Mobile browsers often cannot open the other camera until this track stops.
    old?.stop();
    replacement=await navigator.mediaDevices.getUserMedia({audio:false,video:{
     facingMode:{ideal:next},width:{ideal:session.kind==='circle'?480:1280},
     height:{ideal:session.kind==='circle'?480:720},frameRate:{ideal:24,max:30}
    }});
    if(!active())return;
    const track=replacement.getVideoTracks()[0];
    if(!track)throw Error('No camera video track');
    session.stream.getVideoTracks().forEach(t=>{session.stream.removeTrack(t);t.stop();});
    session.stream.addTrack(track);
    replacement=null; // The live session now owns the new track.
    source.srcObject=null;
    source.srcObject=session.stream;
    await source.play();
    if(!active())return;
    // Wait for the new camera's first frame, not just play() resolving.
    if(source.requestVideoFrameCallback){
     await Promise.race([
      new Promise(resolve=>source.requestVideoFrameCallback(()=>resolve())),
      new Promise(resolve=>setTimeout(resolve,650))
     ]);
    }else if(source.readyState<2){
     await Promise.race([
      new Promise(resolve=>source.addEventListener('loadeddata',resolve,{once:true})),
      new Promise(resolve=>setTimeout(resolve,650))
     ]);
    }
    session.facing=next;
    if(session.kind==='circle')circleFacing=next;
    status.textContent='';
   }catch(error){
    if(active()){
     status.textContent=lang==='ru'?'Переключение не удалось. Восстанавливаем камеру…':'Camera switch failed. Restoring camera…';
     try{
      const restored=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:session.facing}}});
      if(active()){
       session.stream.getVideoTracks().forEach(t=>{session.stream.removeTrack(t);t.stop();});
       session.stream.addTrack(restored.getVideoTracks()[0]);
       source.srcObject=null;source.srcObject=session.stream;
       await source.play();
       status.textContent='';
      }else restored.getTracks().forEach(t=>t.stop());
     }catch{status.textContent=lang==='ru'?'Камера недоступна. Остановите запись и попробуйте снова.':'Camera unavailable. Restart recording.';}
    }
   }finally{
    replacement?.getTracks().forEach(t=>t.stop());
    freeze?.remove();
    session.flipping=false;
   }
  }
  function recordVideo(session){
   if(session.recorder){
    clearTimeout(session.timer);
    shutter.disabled=true;
    if(session.recorder.state==='recording')session.recorder.stop();
    return;
   }
   const chunks=[];
   let size=0;
   try{
    const recordStream=createStableVideo(session,cameraPreview,session.kind==='note');
    const recorder=new MediaRecorder(recordStream,{
     mimeType:session.mime,videoBitsPerSecond:1800000,audioBitsPerSecond:96000
    });
    session.recorder=recorder;
    recorder.ondataavailable=e=>{
     if(cameraSession!==session||!e.data.size)return;
     size+=e.data.size;
     if(size>limits.video*1024*1024){closeCamera();status.textContent=sizeError('video');return;}
     chunks.push(e.data);
    };
    recorder.onerror=()=>{closeCamera();status.textContent=videoLabels[3];};
    recorder.onstop=async()=>{
     session.stopDrawing?.();
     session.recordStream?.getVideoTracks().forEach(t=>t.stop());
     if(cameraSession!==session)return;
     const type=(recorder.mimeType||session.mime).split(';')[0];
     closeCamera();
     if(!size||!formats.video.includes(type)){status.textContent=videoLabels[3];return;}
     const file=new Blob(chunks,{type});
     if(session.kind==='note'){
      try{await onInstantVideo(file);}catch(error){status.textContent=error?.message||labels[11];}
     }else setDraft(file,'video');
    };
    recorder.start(250);
    session.timer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},videoDuration);
    shutter.dataset.mode='recording';
    shutter.setAttribute('aria-label',videoLabels[0]);
    shutter.title=videoLabels[0];
    for(const button of modeButtons.values())button.disabled=true;
    startVideoCountdown(session,cameraTimer);
    status.textContent='';
   }catch{closeCamera();status.textContent=videoLabels[3];}
  }
  if(albums){
   const mixed=addPicker('album',attachmentLabels[1]);
   bar.classList.add('connect-attachment-sheet');
   bar.setAttribute('role','group');
   bar.setAttribute('aria-label',attachmentLabels[0]);
   const handle=button(null,()=>{showAttachments(false);attach.focus();});
   handle.className='connect-attachment-handle';
   handle.setAttribute('aria-label',attachmentLabels[4]);
   const actions=el('div',null,'connect-attachment-actions');
   function sheetAction(label,icon,action){
    const control=button(null,action);
    control.className='connect-attachment-action connect-attachment-'+icon;
    const iconTile=el('span',null,'connect-attachment-icon');
    iconButton(iconTile,icon);
    iconTile.setAttribute('aria-hidden','true');
    control.append(iconTile,el('span',label));
    actions.append(control);
    pickers.push(control);
   }
   sheetAction(attachmentLabels[1],'gallery',()=>mixed.click());
   sheetAction(attachmentLabels[2],'camera',()=>openCamera('photo'));
   sheetAction(attachmentLabels[3],'video',()=>openCamera('video'));
   bar.append(handle,actions);
  }else if(compact){
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
   const session={kind:'circle',facing:circleFacing,held:true,pressAt:performance.now(),tapMode:false,cancelled:false,stream:null,recordStream:null,canvas:null,drawFrame:null,recorder:null,chunks:[],bytes:0,timer:null,clock:null,flipping:false};
   circleSession=session;
   // Do not capture the pointer: the camera switch is a separate touch target.
   circlePanel.hidden=false;
   circleTimer.hidden=false;
   circlePanel.classList.add('is-active');
   circleRing?.style.setProperty('--circle-progress','0');
   circleButton.classList.add('is-recording');
   if(flipCamera)flipCamera.disabled=false;
   controls();
   try{
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('camera');
    const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:{facingMode:circleFacing,width:{ideal:480},height:{ideal:480},frameRate:{ideal:24}}});
    if(circleSession!==session||session.cancelled){stream.getTracks().forEach(t=>t.stop());finishCircle(session,true);return;}
    session.stream=stream;
    circlePreview.srcObject=stream;
    await circlePreview.play();
    if(circleSession!==session||session.cancelled){finishCircle(session,true);return;}
    const mime=['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
    if(!mime)throw Error('format');
    const recordStream=createStableVideo(session,circlePreview,true);
    const recorder=new MediaRecorder(recordStream,{mimeType:mime,videoBitsPerSecond:850000,audioBitsPerSecond:64000});
    session.recorder=recorder;
    recorder.ondataavailable=e=>{
     if(!e.data.size)return;
     session.bytes+=e.data.size;
     if(session.bytes>limits.video*1024*1024){session.cancelled=true;finishCircle(session,true);return;}
     session.chunks.push(e.data);
    };
    recorder.onerror=()=>{session.cancelled=true;finishCircle(session,true);status.textContent=videoLabels[3];};
    recorder.onstop=async()=>{
     session.stopDrawing?.();
     session.recordStream?.getVideoTracks().forEach(t=>t.stop());
     const valid=!session.cancelled&&session.bytes>0;
     const type=(recorder.mimeType||mime).split(';')[0];
     const file=valid?new Blob(session.chunks,{type}):null;
     finishCircle(session,true);
     session.stream?.getTracks().forEach(t=>t.stop());
     if(!file||!formats.video.includes(type))return;
     try{await onInstantVideo(file);}catch(e){status.textContent=e?.message||labels[11];}
    };
    recorder.start(250);
    startVideoCountdown(session,circleTimer);
    const ringStart=performance.now();
    session.ringClock=setInterval(()=>circleRing?.style.setProperty('--circle-progress',String(Math.min(100,(performance.now()-ringStart)/videoDuration*100))),100);
    session.timer=setTimeout(()=>finishCircle(session,false),videoDuration);
    status.textContent='';
   }catch{
    finishCircle(session,true);
    status.textContent=videoLabels[2];
   }
  }
  async function flipCurrentCamera(){
   if(circleSession){
    await switchStreamCamera(circleSession,circlePreview);
    return;
   }
   if(cameraSession){
    await switchStreamCamera(cameraSession,cameraPreview);
    updateTorch();
    return;
   }
   circleFacing=circleFacing==='user'?'environment':'user';
  }
  function finishCircle(session,discard){
   if(!session)return;
   session.held=false;
   session.cancelled ||= discard;
   clearTimeout(session.timer);
   clearInterval(session.clock);
   clearInterval(session.ringClock);
   if(!session.recorder||session.recorder.state==='inactive'){
    session.stopDrawing?.();
    session.recordStream?.getVideoTracks().forEach(t=>t.stop());
   }
   if(circleSession===session){
    circleSession=null;
    circlePanel.hidden=true;
    circlePanel.classList.remove('is-active');
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

  const mic=button(labels[2],record);
  function removeButton(item){
   const remove=button(null,()=>{
    drafts=drafts.filter(draft=>draft!==item);
    URL.revokeObjectURL(item.url);
    status.textContent='';
    renderDrafts();
   });
   remove.className='connect-draft-remove';
   iconButton(remove,'close',labels[4]);
   Object.assign(remove.style,{
    position:'absolute',top:'6px',right:'6px',width:'28px',height:'28px',
    minHeight:'0',minWidth:'0',boxSizing:'border-box',padding:'0',
    borderRadius:'50%',border:'1px solid rgba(255,255,255,.22)',
    background:'rgba(24,24,24,.82)',color:'#fff',
    display:'grid',placeItems:'center',cursor:'pointer',zIndex:'2'
   });
   const removeIcon=remove.firstElementChild;
   removeIcon.setAttribute('width','14');
   removeIcon.setAttribute('height','14');
   removeIcon.setAttribute('fill','none');
   removeIcon.setAttribute('stroke','currentColor');
   removeIcon.setAttribute('stroke-width','2.5');
   removeIcon.setAttribute('stroke-linecap','round');
   return remove;
  }
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
   shutter=button(null,()=>{
    if(cameraSession&&cameraSession.kind!=='photo')recordVideo(cameraSession);
    else takePhoto();
   });
   shutter.className='connect-camera-shutter';
   const flipLabel=({ru:'Переключить камеру',vi:'Đổi máy ảnh'})[lang]||'Switch camera';
   flipCamera=button(null,flipCurrentCamera);
   flipCamera.className='connect-camera-icon';
   iconButton(flipCamera,'flip',flipLabel);
   const choose=button(null,()=>{
    const input=gallery[cameraSession?.kind==='photo'?'photo':'video'];
    closeCamera();
    status.textContent='';
    input?.click();
   });
   choose.className='connect-camera-icon';
   iconButton(choose,'gallery',cameraLabels[1]);
   cancelCamera=button(null,()=>{
    closeCamera();
    status.textContent='';
    (albums?attach:camera).focus();
   });
   cancelCamera.className='connect-camera-icon connect-camera-dismiss';
   iconButton(cancelCamera,'close',cameraLabels[0]);
   const stage=el('div',null,'connect-camera-stage');
   cameraTimer=el('span',null,'connect-camera-timer');
   cameraTimer.setAttribute('role','timer');
   cameraTimer.hidden=true;
   stage.append(cameraPreview,cancelCamera,cameraTimer);
   const cameraControls=el('div',null,'connect-camera-controls');
   cameraControls.append(choose,shutter,flipCamera);
   stage.append(cameraControls);
   cameraPanel.append(stage);
   if(albums){
    cameraPanel.setAttribute('role','dialog');
    cameraPanel.setAttribute('aria-modal','true');
    torch=button(null,toggleTorch);
    torch.className='connect-camera-icon connect-camera-torch';
    torch.hidden=true;
    stage.append(torch);
    const modes=el('div',null,'connect-camera-modes');
    for(const [kind,label] of ['video','photo','note'].map((kind,index)=>[kind,cameraModes[index]])){
     if(kind==='note'&&!onInstantVideo)continue;
     const mode=button(label,()=>selectCameraMode(kind));
     modeButtons.set(kind,mode);
     modes.append(mode);
    }
    cameraPanel.append(modes);
   }

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
    circlePanel.setAttribute('role','dialog');
    circlePanel.setAttribute('aria-label',lang==='ru'?'Запись видеосообщения':'Record video message');
    circlePreview=el('video');
    circlePreview.muted=true;circlePreview.playsInline=true;
    circleTimer=el('span',null,'connect-circle-timer');
    circleTimer.setAttribute('role','timer');
    circleTimer.hidden=true;
    circleRing=el('div',null,'connect-circle-ring');
    circleRing.append(circlePreview);
    circleCancel=button('×',()=>finishCircle(circleSession,true));
    circleCancel.className='connect-circle-cancel';
    circleCancel.setAttribute('aria-label',lang==='ru'?'Отменить запись':'Cancel recording');
    circleStop=button('■',()=>finishCircle(circleSession,false));
    circleStop.className='connect-circle-stop';
    circleStop.setAttribute('aria-label',lang==='ru'?'Остановить и отправить':'Stop and send');
    circleSend=button('➤',()=>finishCircle(circleSession,false));
    circleSend.className='connect-circle-send';
    circleSend.setAttribute('aria-label',lang==='ru'?'Отправить видеосообщение':'Send video message');
    const flip=button('⟳',flipCurrentCamera);
    flip.className='connect-flip-camera';
    flip.setAttribute('aria-label',lang==='ru'?'Переключить камеру':'Switch camera');
    const actions=el('div',null,'connect-circle-actions');
    actions.append(flip,circleStop,circleSend);
    circlePanel.append(circleCancel,circleTimer,circleRing,actions);
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
   form.prepend(expressionPanel,preview,cameraPanel,recordPanel,entry);
   form.append(mic);
   if(albums)form.append(bar);
   else form.prepend(bar);
   form.addEventListener('focusout',event=>{
    const next=event.relatedTarget;
    const leavesAttachments=albums?next&&!form.contains(next):next!==attach&&!bar.contains(next);
    if(leavesAttachments)showAttachments(false);
    if(event.relatedTarget!==expression&&!expressionPanel.contains(event.relatedTarget))showExpressions(false);
   });
   form.addEventListener('keydown',event=>{
    if(event.key==='Tab'&&cameraSession&&albums){
     const controls=[...cameraPanel.querySelectorAll('button:not([hidden]):not(:disabled)')];
     const first=controls[0],last=controls.at(-1),current=document.activeElement;
     if(!controls.includes(current)||(event.shiftKey?current===first:current===last)){
      event.preventDefault();
      (event.shiftKey?last:first)?.focus();
     }
     return;
    }
    if(event.key!=='Escape')return;
    if(cameraSession){
     event.preventDefault();
     closeCamera();
     status.textContent='';
     (albums?attach:camera).focus();
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
   get draft(){return drafts.length>1?{kind:'album',items:drafts}:drafts[0]||null;},
   get recording(){return starting||!!recording||!!cameraSession||!!circleSession;},
   busy(value){working=value;controls();},
   clear(){clearDrafts();renderDrafts();},
   close(){
    closeCamera();
    if(circleSession)finishCircle(circleSession,true);
    showAttachments(false);
    showExpressions(false);
    generation++;
    starting=false;
    if(recording){stop(recording,true);recording=null;}
    for(const media of preview.querySelectorAll('audio,video'))media.pause();
    controls();
   },
   error(code,kind){return code==='MEDIA_SIZE'?sizeError(kind):code==='MEDIA_FORMAT'?labels[10]:labels[11];}
  };
 };
})();
