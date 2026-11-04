import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.95.3';
import webpush from 'npm:web-push@3.6.7';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'content-type,x-umma-push-key','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
// Exact provider hosts prevent an attacker from using our sender to access arbitrary URLs.
function subscriptionValid(s:any){try{const u=new URL(s.endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','wns2-par02p.wns.windows.com'].includes(u.hostname)&&u.search.length<4096&&/^[A-Za-z0-9_-]{87}$/.test(s.keys?.p256dh||'')&&/^[A-Za-z0-9_-]{22}$/.test(s.keys?.auth||'');}catch{return false;}}
const words:any={ru:{pending:'Заказ отправлен',confirmed:'Заказ принят',preparing:'Готовится',ready:'Заказ готов — можно забирать',completed:'Заказ выдан',cancelled:'Заказ отменён',waiting_courier:'Ищем курьера',courier_assigned:'Курьер назначен',picked_up:'Курьер в пути',delivered:'Заказ доставлен',paid:'Оплачено',refunded:'Возврат оплаты'},en:{pending:'Order sent',confirmed:'Order accepted',preparing:'Preparing your order',ready:'Your order is ready',completed:'Order collected',cancelled:'Order cancelled',waiting_courier:'Finding a courier',courier_assigned:'Courier assigned',picked_up:'Courier is on the way',delivered:'Order delivered',paid:'Payment received',refunded:'Payment refunded'},vi:{pending:'Đã gửi đơn',confirmed:'Đã nhận đơn',preparing:'Đang chuẩn bị',ready:'Đơn hàng đã sẵn sàng',completed:'Đã nhận món',cancelled:'Đã hủy đơn',waiting_courier:'Đang tìm tài xế',courier_assigned:'Đã có tài xế',picked_up:'Tài xế đang giao',delivered:'Đã giao hàng',paid:'Đã thanh toán',refunded:'Đã hoàn tiền'}};
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return reply({ok:false},405);
 try{
  const raw=await req.text();if(raw.length>10000)return reply({ok:false},413);const b=JSON.parse(raw);
  if(!['config','subscribe','unsubscribe','dispatch'].includes(b.action))return reply({ok:false},400);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const rpc=async(name:string,args:any={})=>{const r=await db.rpc(name,args);if(r.error)throw Error('Push service unavailable');return r.data;};
  let config=await rpc('cafe_push_config');
  if(!config){const keys=webpush.generateVAPIDKeys();config=await rpc('cafe_push_config',{p_candidate:{...keys,dispatchKey:crypto.randomUUID()+crypto.randomUUID()}});}
  if(b.action==='config')return reply({ok:true,publicKey:config.publicKey});
  if(b.action==='dispatch'){
   if(req.headers.get('x-umma-push-key')!==config.dispatchKey)return reply({ok:false},403);
   const jobs=await rpc('cafe_push_lease');let sent=0;
   await Promise.all(jobs.map(async(j:any)=>{
    let success=false,gone=false;
    try{if(!subscriptionValid(j.subscription))gone=true;else{const labels=words[j.language]||words.en;const changes=Object.values(j.payload.changes||{}).filter(v=>v&&labels[String(v)]);const body=[...new Set(changes.map(v=>labels[String(v)]))].join(' · ')||labels[j.payload.status]||'Order update';
     await webpush.sendNotification(j.subscription,JSON.stringify({eventId:j.id,title:'UMMA · №'+j.payload.orderNumber,body,order:{...j.payload,eventId:j.id,eventAt:j.createdAt}}),{TTL:3600,urgency:'high',timeout:8000,vapidDetails:{subject:'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/',publicKey:config.publicKey,privateKey:config.privateKey}});success=true;sent++;}}
    catch(e:any){gone=[404,410].includes(e.statusCode);}
    await rpc('cafe_push_finish',{p_id:j.id,p_lease:j.lease,p_success:success,p_gone:gone});
   }));return reply({ok:true,sent});
  }
  if(!/^[0-9a-f-]{36}$/i.test(b.orderId||'')||!/^[0-9a-f-]{36}$/i.test(b.requestKey||'')||!subscriptionValid(b.subscription))return reply({ok:false,error:'Invalid subscription'},400);
  await rpc('cafe_push_subscribe',{p_order:b.orderId,p_key:b.requestKey,p_subscription:b.subscription,p_language:b.language||'ru',p_remove:b.action==='unsubscribe'});
  return reply({ok:true});
 }catch{return reply({ok:false,error:'Уведомления пока недоступны. Попробуйте ещё раз.'},400);}
});
