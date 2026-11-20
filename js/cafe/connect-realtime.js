/* UMMA Connect: privacy-preserving realtime invalidations. No message content or client IDs are broadcast. */
(()=>{'use strict';
 const key='sb_publishable_s2qkY0H-Wb7r9aVkofZIJQ_8SsaQTpC';
 const endpoint='wss://zwzojugspldexyyljwpr.supabase.co/realtime/v1/websocket?apikey='+encodeURIComponent(key)+'&vsn=1.0.0';
 let socket=null,seq=0,retry=1200,timer=null,heartbeat=null,debounce=null;
 const topic='realtime:umma-connect-signals';
 const fulfillmentTopic='realtime:umma-fulfillment';
 const fulfillment=document.currentScript?.hasAttribute('data-fulfillment-realtime');
 const fulfillmentOnly=document.currentScript?.dataset.fulfillmentRealtime==='only';
 let orderDebounce=null;
 function notifyOrders(){
  if(document.hidden||!fulfillment)return;
  clearTimeout(orderDebounce);
  orderDebounce=setTimeout(()=>document.dispatchEvent(new Event('umma:fulfillment-realtime')),100);
 }
 function notify(){if(document.hidden)return;clearTimeout(debounce);debounce=setTimeout(()=>document.dispatchEvent(new Event('umma:connect-realtime')),100);}
 function connect(){
  if(document.hidden||!navigator.onLine||socket)return;
  try{socket=new WebSocket(endpoint);}catch{socket=null;schedule();return;}
  const current=socket;
  current.onopen=()=>{
   retry=1200;
   if(!fulfillmentOnly)current.send(JSON.stringify({topic,event:'phx_join',payload:{config:{postgres_changes:[{event:'INSERT',schema:'public',table:'umma_connect_signals'}],broadcast:{self:false,ack:false},presence:{key:''},private:false}},ref:String(++seq)}));
   if(fulfillment)current.send(JSON.stringify({topic:fulfillmentTopic,event:'phx_join',payload:{config:{broadcast:{self:false,ack:false},presence:{key:''},postgres_changes:[],private:false}},ref:String(++seq)}));
   heartbeat=setInterval(()=>{if(current.readyState===1)current.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:String(++seq)}));},25000);
  };
  current.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.event==='postgres_changes')notify();if(m.topic===fulfillmentTopic&&((m.event==='broadcast'&&m.payload?.event==='order-change')||(m.event==='phx_reply'&&m.payload?.status==='ok')))notifyOrders();if(m.event==='phx_reply'&&m.payload?.status==='error'&&!(fulfillment&&m.topic===topic))current.close();}catch{}};
  current.onclose=()=>{clearInterval(heartbeat);if(socket===current)socket=null;schedule();};
  current.onerror=()=>current.close();
 }
 function schedule(){clearTimeout(timer);if(document.hidden||!navigator.onLine)return;timer=setTimeout(connect,retry);retry=Math.min(retry*1.7,30000);}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);socket?.close();}else{connect();if(!fulfillmentOnly)notify();notifyOrders();}});
 window.addEventListener('online',()=>{connect();if(!fulfillmentOnly)notify();notifyOrders();});
 window.addEventListener('offline',()=>{clearTimeout(timer);socket?.close();});
 connect();
})();