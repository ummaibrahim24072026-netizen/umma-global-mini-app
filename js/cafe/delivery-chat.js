/* Order-scoped customer/courier chat. Polling never replaces playing media elements. */
(() => {
 'use strict';
 const endpoint='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/delivery-chat';
 const language=()=>window.ummaI18n?.language||window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code?.split('-')[0]||'en';
 const t=s=>window.ummaI18n?.t(s)||s;
 let view=null,recording=null,recordGeneration=0;
 async function api(v,action,args={}){
  const initData=window.Telegram?.WebApp?.initData;if(!initData)throw Error(t('Откройте приложение через Telegram'));
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,orderId:v.id,language:language(),...args,initData}),signal:AbortSignal.timeout(action==='translate'?100000:20000)});
  const data=await r.json();if(!r.ok||!data.ok){const e=Error(t(data.error||'Не удалось открыть чат.'));e.code=data.code;throw e;}return data;
 }
 function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=t(text);if(cls)e.className=cls;return e;}
 function status(v,s){if(view===v)v.status.textContent=t(s);}
 function stopRecording(discard=false){recordGeneration++;if(!recording)return;const r=recording;r.discard=discard;clearTimeout(r.timeout);if(r.recorder.state!=='inactive')r.recorder.stop();r.stream.getTracks().forEach(track=>track.stop());recording=null;}
 function close(){const v=view;if(!v)return;view=null;window.speechSynthesis?.cancel();clearTimeout(v.timer);stopRecording(true);v.dialog.querySelectorAll('audio,video').forEach(m=>m.pause?.());if(v.previewUrl)URL.revokeObjectURL(v.previewUrl);v.dialog.remove();v.opener?.focus();}
 function busy(v,value){v.sending=value;v.send.disabled=value||!v.canSend;v.attach.disabled=value||!v.canSend;v.record.disabled=value||!v.canSend;v.input.disabled=value||!v.canSend;v.cancel.disabled=value;v.send.textContent=t(value?'Отправляем…':'Отправить');}
 function selected(v,file,kind){if(v.sending)return;if(v.previewUrl)URL.revokeObjectURL(v.previewUrl);v.preview.replaceChildren();v.previewUrl=null;v.file=file;v.kind=kind;v.pending=null;v.cancel.hidden=!file;
  if(!file)return;
  v.preview.append(el('span',file.name+' · '+Math.ceil(file.size/1024)+' KB'));
  if(kind==='voice'){const audio=el('audio');audio.controls=true;v.previewUrl=URL.createObjectURL(file);audio.src=v.previewUrl;v.preview.append(audio);}
 }
 async function record(v){
  if(v.sending)return;
  if(recording){stopRecording();return;}
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){status(v,'Запись недоступна. Отправьте текстовое сообщение.');return;}
  const generation=++recordGeneration;
  v.record.disabled=true;status(v,'Разрешите микрофон для записи голосового сообщения.');
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   if(view!==v||generation!==recordGeneration){stream.getTracks().forEach(track=>track.stop());return;}
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
   const recorder=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:64000}:undefined),chunks=[];
   const r={recorder,stream,discard:false,timeout:null,started:Date.now()};recording=r;
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onerror=()=>{status(v,'Не удалось записать голосовое сообщение.');stopRecording(true);};
   recorder.onstop=()=>{stream.getTracks().forEach(track=>track.stop());clearTimeout(r.timeout);if(recording===r)recording=null;if(view!==v)return;v.record.textContent=t('Записать голосовое');v.record.disabled=!v.canSend;busy(v,false);
    if(r.discard)return;const type=(recorder.mimeType||mime||'audio/webm').split(';')[0],blob=new Blob(chunks,{type});
    if(!blob.size||blob.size>5242880){status(v,'Файл слишком большой или имеет неподдерживаемый формат.');return;}
    selected(v,new File([blob],'voice.'+(type==='audio/mp4'?'m4a':type==='audio/ogg'?'ogg':'webm'),{type}),'voice');status(v,'Прослушайте запись и нажмите «Отправить».');
   };
   recorder.start(1000);v.send.disabled=true;v.attach.disabled=true;v.input.disabled=true;v.record.disabled=false;v.record.textContent=t('Остановить запись');status(v,'Идёт запись. Максимум 60 секунд.');r.timeout=setTimeout(()=>stopRecording(),60000);
  }catch{if(view===v){v.record.disabled=!v.canSend;status(v,'Микрофон недоступен. Можно отправить текст, фото или видео.');}}
 }
 function media(tag,url,label,translated=false){const node=el(tag);node.src=url;node.dataset.chatMedia=translated?'translated':'original';node.dataset.urlCreated=String(Date.now());node.setAttribute('aria-label',t(label));if(tag==='img'){node.alt=t(label);node.loading='lazy';}else{node.controls=true;node.preload='metadata';if(tag==='video')node.playsInline=true;}return node;}
 function renderMessage(v,m){
  let row=v.rows.get(m.id);
  if(!row){row=el('article',undefined,'chat-message'+(m.own?' chat-message-own':''));row.dataset.message=m.id;row.setAttribute('translate','no');row.dir='auto';
   const head=el('small',m.own?'Вы':v.context.role==='customer'?'Курьер':'Клиент');head.setAttribute('translate','yes');row.append(head);
   const content=el('div',undefined,'chat-message-content');row.append(content);row.content=content;row.mediaContent=el('div');row.bodyContent=el('div');content.append(row.mediaContent,row.bodyContent);
   const time=el('small');time.textContent=new Date(m.createdAt).toLocaleTimeString(window.ummaI18n?.locale()||'en-GB',{hour:'2-digit',minute:'2-digit'});row.append(time);row.read=el('small');row.append(row.read);v.rows.set(m.id,row);
  }
  const tr=m.translation,signature=JSON.stringify([m.text,m.kind,!!m.mediaUrl,tr?.state,tr?.text,!!tr?.audioUrl,v.language]);
  if(row.signature!==signature){row.signature=signature;row.bodyContent.replaceChildren();
   if(m.mediaUrl&&m.kind!=='text'&&!row.mediaContent.children.length){
    if(m.kind==='voice'){const label=el('small','Оригинал');label.setAttribute('translate','yes');row.mediaContent.append(label);}
    row.mediaContent.append(media(m.kind==='photo'?'img':m.kind==='video'?'video':'audio',m.mediaUrl,m.kind==='photo'?'Фотография':m.kind==='video'?'Видео':'Голосовое сообщение'));
   }
   const translated=!m.own&&tr?.state==='ready';
   if(m.text||translated){const text=el('p');text.textContent=translated?tr.text:m.text;text.dir='auto';row.bodyContent.append(text);}
   if(translated){const label=el('small','Автоперевод');label.setAttribute('translate','yes');row.bodyContent.append(label);const original=el('details'),summary=el('summary','Показать оригинал');summary.setAttribute('translate','yes');const source=el('p');source.textContent=tr.transcript||m.text;source.dir='auto';original.append(summary,source);row.bodyContent.append(original);
    if(!tr.audioUrl&&window.speechSynthesis&&window.SpeechSynthesisUtterance){const listen=el('button','Прослушать перевод');listen.type='button';listen.dataset.chatSpeak=m.id;listen.onclick=()=>{const voices=window.speechSynthesis.getVoices(),voice=voices.find(voice=>voice.lang.toLowerCase().split(/[-_]/)[0]===v.language);if(!voice){status(v,'На телефоне нет голоса для выбранного языка.');return;}window.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(tr.text);speech.lang=voice.lang;speech.voice=voice;speech.onerror=()=>status(v,'Не удалось озвучить перевод.');window.speechSynthesis.speak(speech);};row.bodyContent.append(listen);}
    if(tr.audioUrl){const label=el('small','Озвучка перевода · ИИ');label.setAttribute('translate','yes');row.bodyContent.append(label,media('audio',tr.audioUrl,'Озвучка перевода · ИИ',true));}
   }else if(!m.own&&(m.kind==='voice'||!!m.text)){const label=el('small',m.kind==='voice'&&!v.voiceConfigured?'Голосовая запись доступна в оригинале.':!v.configured?'Автоперевод пока недоступен. Показан оригинал.':tr?.state==='failed'?'Не удалось перевести. Оригинал сохранён.':'Переводим…');label.setAttribute('translate','yes');row.bodyContent.append(label);}
   if(!m.own&&tr?.state==='failed'&&(m.kind!=='voice'||v.voiceConfigured)){
    const retry=el('button','Повторить перевод');retry.type='button';retry.dataset.chatRetry=m.id;
    retry.onclick=async()=>{if(v.translating)return;v.translating=true;retry.disabled=true;status(v,'Переводим…');
     try{await api(v,'translate',{messageId:m.id,retry:true});v.providerFailed=false;v.nextTry.delete(m.id);await poll(v,false);}
     catch(e){status(v,e.message);}
     finally{v.translating=false;retry.disabled=false;}
    };row.bodyContent.append(retry);
   }
  }
  for(const node of row.content.querySelectorAll('[data-chat-media]'))if(Date.now()-Number(node.dataset.urlCreated)>720000&&node.paused!==false){const url=node.dataset.chatMedia==='translated'?tr?.audioUrl:m.mediaUrl;if(url){node.src=url;node.dataset.urlCreated=String(Date.now());}}
  row.read.textContent=m.own?t(m.readAt?'Прочитано':'Отправлено'):'';row.read.setAttribute('translate','yes');return row;
 }
 async function translateNext(v,messages){
  if(v.translating||!v.configured||view!==v||document.hidden)return;
  const m=messages.find(m=>!m.own&&(m.kind!=='voice'||v.voiceConfigured)&&(m.kind==='voice'||!!m.text)&&m.translation?.state!=='ready'&&(m.translation?.attempts||0)<3&&(v.nextTry.get(m.id)||0)<Date.now());if(!m)return;
  v.translating=true;v.nextTry.set(m.id,Date.now()+35000);
  try{await api(v,'translate',{messageId:m.id});if(view===v)void poll(v,false);}
  catch(e){if(view===v&&['TRANSLATION_UNAVAILABLE','TRANSLATION_FAILED'].includes(e.code)){status(v,e.message);}}
  finally{v.translating=false;}
 }
 function schedulePoll(v){if(view!==v)return;clearTimeout(v.timer);v.timer=setTimeout(()=>{if(document.hidden)schedulePoll(v);else void poll(v);},5000);}
 async function poll(v,schedule=true,before){
  if(view!==v||v.polling)return;v.polling=true;
  try{const data=await api(v,'list',before?{before}:{});if(view!==v)return;if(v.threadKey&&v.threadKey!==data.context.threadKey){v.messages.clear();v.rows.clear();v.list.querySelectorAll('audio,video').forEach(m=>m.pause?.());v.list.replaceChildren();v.pending=null;v.historyComplete=false;}v.threadKey=data.context.threadKey;v.retry.hidden=true;v.context=data.context;v.canSend=data.context.canSend;v.configured=data.translationConfigured;v.voiceConfigured=data.translationProvider!=='mymemory'&&data.voiceTranslationConfigured!==false;
   const nextLanguage=language();if(v.language!==nextLanguage){v.language=nextLanguage;v.nextTry.clear();}
   v.title.textContent=t(data.context.role==='customer'?'Чат с курьером':'Чат с клиентом')+' · №'+data.context.orderNumber;
   v.privacy.hidden=data.translationProvider!=='mymemory';v.note.textContent=t(data.context.waiting?'Чат станет доступен после назначения курьера.':!v.canSend?'Доставка завершена. Чат доступен для чтения.':v.configured?(v.voiceConfigured?'Текст и голос переводятся автоматически. Озвучка перевода создана ИИ.':'Текст переводится автоматически. Для речи используйте микрофон на клавиатуре, затем отправьте текст. Голосовые записи доступны в оригинале.'):'Автоперевод пока недоступен. Сообщения доставляются в оригинале.');
   if(!v.sending&&!recording)busy(v,false);
   const wasBottom=v.list.scrollHeight-v.list.scrollTop-v.list.clientHeight<100;
   for(const m of data.messages){v.messages.set(m.id,m);}
   const sorted=[...v.messages.values()].sort((a,b)=>a.seq-b.seq);for(let i=0;i<sorted.length;i++){const row=renderMessage(v,sorted[i]);if(v.list.children[i]!==row)v.list.insertBefore(row,v.list.children[i]||null);}
   if(data.messages.length<50)v.historyComplete=true;v.older.hidden=!!v.historyComplete;v.older.disabled=false;
   if(wasBottom&&!before)v.list.scrollTop=v.list.scrollHeight;
   if(!v.sending)status(v,'');void translateNext(v,sorted);
  }catch(e){status(v,e.message);v.note.textContent=e.message;v.retry.hidden=['CHAT_ACCESS','CHAT_SELF','CHAT_CLOSED'].includes(e.code);if(['CHAT_ACCESS','CHAT_SELF'].includes(e.code)){v.canSend=false;busy(v,false);v.messages.clear();v.rows.clear();v.list.replaceChildren();}}
  finally{v.polling=false;if(view===v&&schedule)schedulePoll(v);}
 }
 async function send(v){
  if(view!==v||v.sending||!v.canSend||recording)return;
  const text=v.input.value.trim();if(!v.file&&!text)return;
  if(!v.pending)v.pending={requestKey:crypto.randomUUID(),text,file:v.file,kind:v.file?v.kind:'text',language:language()};
  const p=v.pending;busy(v,true);status(v,'Отправляем…');
  try{
   if(p.file){const mime=p.file.type.split(';')[0];const prepared=await api(v,'prepare',{requestKey:p.requestKey,text:p.text,kind:p.kind,mime,size:p.file.size,language:p.language});
    if(!prepared.sent){
     let finished=false;try{await api(v,'finish',{messageId:prepared.messageId});finished=true;}catch(e){if(e.code!=='CHAT_UPLOAD')throw e;}
     if(!finished){const upload=await fetch(prepared.uploadUrl,{method:'PUT',headers:{'Content-Type':mime,'x-upsert':'false'},body:p.file,signal:AbortSignal.timeout(90000)});
      if(!upload.ok){try{await api(v,'finish',{messageId:prepared.messageId});finished=true;}catch{throw Error(t('Не удалось загрузить файл. Повторите отправку.'));}}
      if(!finished)await api(v,'finish',{messageId:prepared.messageId});
     }
    }
   }else await api(v,'send',{requestKey:p.requestKey,text:p.text,kind:'text',language:p.language});
   if(view!==v)return;v.input.value='';v.pending=null;v.file=null;v.sending=false;selected(v,null,null);status(v,'Отправлено');await poll(v,false);
  }catch(e){status(v,e.message);}
  finally{if(view===v)busy(v,false);}
 }
 function open(id,opener){close();const dialog=el('dialog',undefined,'delivery-chat-dialog');dialog.setAttribute('aria-label',t('Чат доставки'));
  dialog.innerHTML='<header><h2></h2><button type="button" data-chat-close aria-label="Закрыть">✕</button></header><p class="chat-note">Загружаем чат…</p><button type="button" data-chat-refresh hidden>Повторить подключение</button><details class="chat-privacy" hidden><summary>О переводе</summary><p>MyMemory получает текст сообщения и может хранить его по своим условиям.</p><a href="https://mymemory.translated.net/terms-and-conditions" target="_blank" rel="noopener noreferrer">Условия MyMemory</a></details><button type="button" class="chat-older" hidden>Ранее</button><div class="chat-messages" role="log" aria-live="polite" aria-label="Сообщения"></div><p class="chat-status" role="status"></p><div class="chat-preview"></div><form class="chat-compose"><label>Сообщение<textarea maxlength="2000" rows="2" placeholder="Напишите сообщение" dir="auto"></textarea></label><div><button type="button" data-chat-attach>Фото / видео</button><button type="button" data-chat-record>Записать голосовое</button><button type="button" data-chat-cancel hidden>Убрать вложение</button><button type="submit">Отправить</button></div><input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" hidden><small>Фото до 8 МБ, видео до 20 МБ. Голосовая запись — до 60 секунд.</small></form>';
  document.body.append(dialog);const q=s=>dialog.querySelector(s),v={id,opener,dialog,title:q('h2'),retry:q('[data-chat-refresh]'),note:q('.chat-note'),privacy:q('.chat-privacy'),status:q('.chat-status'),list:q('.chat-messages'),preview:q('.chat-preview'),older:q('.chat-older'),input:q('textarea'),attach:q('[data-chat-attach]'),record:q('[data-chat-record]'),cancel:q('[data-chat-cancel]'),send:q('[type="submit"]'),fileInput:q('[type="file"]'),rows:new Map(),messages:new Map(),nextTry:new Map(),language:language(),canSend:false,configured:false,sending:false,translating:false};view=v;
  v.title.textContent=t('Чат доставки');v.retry.onclick=()=>{v.retry.disabled=true;void poll(v,false).finally(()=>{v.retry.disabled=false;});};q('[data-chat-close]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',()=>{if(view===v)close();});
  q('form').onsubmit=e=>{e.preventDefault();void send(v);};v.attach.onclick=()=>v.fileInput.click();v.record.onclick=()=>record(v);v.cancel.onclick=()=>{selected(v,null,null);status(v,'');};
  v.input.addEventListener('input',()=>{v.pending=null;});v.fileInput.onchange=()=>{const file=v.fileInput.files?.[0];v.fileInput.value='';if(!file)return;const type=file.type.split(';')[0],kind=type.startsWith('image/')?'photo':type.startsWith('video/')?'video':null;if(!kind||!['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'].includes(type)||file.size>(kind==='photo'?8388608:20971520)){status(v,'Файл слишком большой или имеет неподдерживаемый формат.');return;}selected(v,file,kind);};
  v.older.onclick=()=>{const oldest=Math.min(...[...v.messages.values()].map(m=>m.seq));v.older.disabled=true;void poll(v,false,oldest);};busy(v,false);dialog.showModal();q('[data-chat-close]').focus();void poll(v);
 }
 document.addEventListener('click',e=>{const b=e.target.closest?.('[data-delivery-chat]');if(b)open(b.dataset.deliveryChat,b);});
 window.addEventListener('umma:languagechange',()=>{if(view){view.language='';view.messages.clear();view.rows.clear();view.list.querySelectorAll('audio,video').forEach(m=>m.pause?.());view.list.replaceChildren();view.historyComplete=false;void poll(view,false);}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopRecording();else if(view)void poll(view,false);});
 window.addEventListener('pagehide',()=>stopRecording(true));
 window.ummaDeliveryChat={open,close,isOpen:()=>!!view};
})();
