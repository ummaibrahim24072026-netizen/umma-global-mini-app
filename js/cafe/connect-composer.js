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
 window.ummaConnectComposer=({lang,el,form,body,send,status,onChange,kinds=['photo','video']})=>{
  const labels=copy[lang]||copy.en;
  const bar=el('div',null,'connect-media-tools'),preview=el('div',null,'connect-media-preview');
  let draft=null,url=null,recording=null,generation=0,starting=false,working=false;
  const pickers=[];
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
   mic.textContent=recording?labels[3]:labels[2];
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
  }
  for(const kind of kinds){
   const label=labels[kind==='photo'?0:1];
   const input=el('input');
   input.type='file';
   input.hidden=true;
   input.accept=formats[kind].join(',');
   input.onchange=()=>{
    const file=input.files[0];
    input.value='';
    if(!file||working||recording||starting)return;
    if(!formats[kind].includes(file.type)){status.textContent=labels[10];return;}
    if(!file.size||file.size>limits[kind]*1024*1024){status.textContent=sizeError(kind);return;}
    setDraft(file,kind);
    status.textContent='';
   };
   const picker=button(label,()=>input.click());
   pickers.push(picker);
   bar.append(input,picker);
  }
  function release(r){
   clearTimeout(r.timer);
   r.stream.getTracks().forEach(track=>track.stop());
  }
  function stop(r,discard=false){
   r.discard=discard;
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
    status.textContent=labels[5];
   }catch{
    stream?.getTracks().forEach(track=>track.stop());
    if(current===generation){recording=null;status.textContent=labels[7];}
   }finally{
    if(current===generation){starting=false;controls();}
   }
  }
  const mic=button(labels[2],record),remove=button(labels[4],()=>{setDraft(null);status.textContent='';});
  bar.append(mic);
  form.insertBefore(bar,send);
  form.insertBefore(preview,send);
  return {
   get draft(){return draft;},
   get recording(){return starting||!!recording;},
   busy(value){working=value;controls();},
   clear(){setDraft(null);},
   close(){
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
