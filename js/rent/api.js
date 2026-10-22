/* Telegram-signed requests. Idempotency keys survive response loss and page reload. */
(()=>{'use strict';
 const endpoint='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/rent-service';
 let keys={};try{keys=JSON.parse(sessionStorage.getItem('umma-rent-keys')||'{}');}catch{}
 const persist=()=>{try{sessionStorage.setItem('umma-rent-keys',JSON.stringify(keys));}catch{}};
 async function call(action,data={},request_id){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),30000);
  try{const r=await fetch(endpoint,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},signal:ctrl.signal,body:JSON.stringify({action,data,request_id,initData:window.Telegram?.WebApp?.initData||''})});
   const out=await r.json();if(!r.ok||!out.ok){const e=new Error(out.error||'RENT_UNAVAILABLE');e.confirmed=true;throw e;}return out;
  }finally{clearTimeout(timer);}
 }
 async function execute(action,data){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)));
  const identity=(window.Telegram?.WebApp?.initDataUnsafe?.user?.id||'guest')+':'+action+':'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  const key=keys[identity]||(keys[identity]=crypto.randomUUID());persist();
  try{const out=await call(action,data,key);delete keys[identity];persist();return out;}catch(e){if(e.confirmed){delete keys[identity];persist();}throw e;}
 }
 async function upload(file,stage,target,position=0,onProgress=()=>{}){
  if(!file?.size||file.size>(file.type.startsWith('image/')?10485760:52428800))throw Error('RENT_SIZE');
  const kind=file.type.startsWith('image/')?'photo':'video';
  const fingerprint=[stage,target,file.name,file.size,file.lastModified,file.type].join(':');
  const owner=window.Telegram?.WebApp?.initDataUnsafe?.user?.id||'guest',storageKey='umma-rent-upload:'+owner+':'+fingerprint;
  let m;try{m=JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{}
  if(!m){const r=await execute('media_start',{stage,...(stage==='catalog'?{vehicle_id:target}:{booking_id:target}),kind,mime:file.type,size_bytes:file.size,position});m=r.media;try{sessionStorage.setItem(storageKey,JSON.stringify(m));}catch{}}
  // A committed upload may have lost its response. Finalize it before retrying the bytes.
  try{await execute('media_finish',{media_id:m.id});try{sessionStorage.removeItem(storageKey);}catch{}onProgress(100);return m;}catch(e){if(!e.confirmed||e.message!=='RENT_UPLOAD')throw e;}
  const signed=await call('upload_url',{media_id:m.id});
  await new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('PUT',signed.url);xhr.setRequestHeader('Content-Type',file.type);xhr.timeout=180000;
   xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};
   xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(Error('RENT_UPLOAD'));xhr.onerror=()=>reject(Error('RENT_NETWORK'));xhr.ontimeout=()=>reject(Error('RENT_NETWORK'));xhr.send(file);
  });
  await execute('media_finish',{media_id:m.id});try{sessionStorage.removeItem(storageKey);}catch{}onProgress(100);return m;
 }
 window.ummaRentApi={call,execute,upload};
})();
