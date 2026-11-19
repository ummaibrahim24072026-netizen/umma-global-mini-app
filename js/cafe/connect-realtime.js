/* UMMA Connect: privacy-preserving realtime invalidations. No message content or client IDs are broadcast. */
(()=>{'use strict';
 const key='sb_publishable_s2qkY0H-Wb7r9aVkofZIJQ_8SsaQTpC';
 const endpoint='wss://zwzojugspldexyyljwpr.supabase.co/realtime/v1/websocket?apikey='+encodeURIComponent(key)+'&vsn=1.0.0';
 let socket=null,seq=0,retry=1200,timer=null,heartbeat=null,debounce=null;
 const topic='realtime:umma-connect-signals';
 function notify(){if(document.hidden)return;clearTimeout(debounce);debounce=setTimeout(()=>document.dispatchEvent(new Event('umma:connect-realtime')),100);}
 function connect(){
  if(document.hidden||!navigator.onLine||socket)return;
  try{socket=new WebSocket(endpoint);}catch{socket=null;schedule();return;}
  const current=socket;
  current.onopen=()=>{
   retry=1200;
   current.send(JSON.stringify({topic,event:'phx_join',payload:{config:{postgres_changes:[{event:'INSERT',schema:'public',table:'umma_connect_signals'}],broadcast:{self:false,ack:false},presence:{key:''},private:false}},ref:String(++seq)}));
   heartbeat=setInterval(()=>{if(current.readyState===1)current.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:String(++seq)}));},25000);
  };
  current.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.event==='postgres_changes')notify();if(m.event==='phx_reply'&&m.payload?.status==='error')current.close();}catch{}};
  current.onclose=()=>{clearInterval(heartbeat);if(socket===current)socket=null;schedule();};
  current.onerror=()=>current.close();
 }
 function schedule(){clearTimeout(timer);if(document.hidden||!navigator.onLine)return;timer=setTimeout(connect,retry);retry=Math.min(retry*1.7,30000);}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);socket?.close();}else{connect();notify();}});
 window.addEventListener('online',()=>{connect();notify();});
 window.addEventListener('offline',()=>{clearTimeout(timer);socket?.close();});
 connect();
})();