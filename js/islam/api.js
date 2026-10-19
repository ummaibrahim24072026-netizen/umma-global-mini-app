(() => {
 'use strict';
 const endpoint='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/islam-service';
 let session=null;
 async function request(action,data={}){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),18000);
  try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...data,initData:window.Telegram?.WebApp?.initData||''}),signal:controller.signal});let json;try{json=await response.json();}catch{throw Error('Service returned an invalid response');}if(!response.ok||json.ok!==true){const error=Error(json.error||'Service unavailable');error.status=response.status;error.withdrawn=json.withdrawn===true;throw error;}return json;}finally{clearTimeout(timeout);}
 }
 const cacheName='umma-islam-published-v1',maxAge=86400000;
 const key=(kind,id)=>new URL('/islam-offline/'+kind+'/'+id,location.origin).href;
 async function save(kind,id,data){if(!window.caches)return;try{const cache=await caches.open(cacheName);await cache.put(key(kind,id),new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}}));const keys=await cache.keys();for(const old of keys.slice(0,Math.max(0,keys.length-40)))await cache.delete(old);}catch{}}
 async function forget(kind,id){try{const cache=await caches.open(cacheName);await cache.delete(key(kind,id));}catch{}}
 async function read(kind,id){try{const data=await request('read',{kind,id});await save(kind,id,data);return {...data,offline:false};}catch(error){if(error.withdrawn||error.status===404){await forget(kind,id);throw error;}if(error.status&&error.status<500)throw error;if(window.caches){try{const cache=await caches.open(cacheName),hit=await cache.match(key(kind,id));if(hit){const data=await hit.json();if(data.record?.status==='published'&&Date.now()-Date.parse(data.fetched_at)<maxAge)return {...data,offline:true};await forget(kind,id);}}catch{}}throw error;}}
 async function catalog(){let data;try{data=await request('catalog');await save('catalog','current',data);}catch(error){if(window.caches&&(!error.status||error.status>=500)){try{const cache=await caches.open(cacheName),hit=await cache.match(key('catalog','current'));if(hit){const saved=await hit.json();if(Date.now()-Date.parse(saved.fetched_at)<maxAge)return {...saved,offline:true};}}catch{}}throw error;}if(window.caches){try{const cache=await caches.open(cacheName),allowed=new Set([...data.hadiths.map(x=>key('hadith',x.id)),...data.lessons.map(x=>key('lesson',x.id))]);for(const item of await cache.keys())if(item.url!==key('catalog','current')&&!allowed.has(item.url))await cache.delete(item);}catch{}}return data;}
 async function state(){session=await request('state');return session;}
 async function bookmark(kind,id,save){const result=await request('bookmark',{kind,id,save});await state();return result;}
 window.ummaIslamAPI={request,read,catalog,state,bookmark,get session(){return session;},clearSession:()=>{session=null;}};
})();
