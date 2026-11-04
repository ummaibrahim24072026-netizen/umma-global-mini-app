import {paymentFor} from '../cafe-my-orders/payment.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.95.3';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='GET'&&req.method!=='POST')return reply({ok:false,error:'Method not allowed'},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 if(req.method==='GET'){
  if(!new URL(req.url).searchParams.has('catalog')){const target=new URL('https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/menu/');const point=new URL(req.url).searchParams.get('point');if(point)target.searchParams.set('point',point.slice(0,80));return Response.redirect(target.href,302);}
  const {data,error}=await db.rpc('cafe_ready_catalog',{p_location:new URL(req.url).searchParams.get('location')||'e22788bd-4734-4b3a-911e-ba103d52617a'});
  return error?reply({ok:false,error:'Menu unavailable'},503):reply(data);
 }
 try{
  const raw=await req.text();if(raw.length>12000)return reply({ok:false,error:'Request too large'},413);
  const b=JSON.parse(raw);
  if(b.action==='status'){
   if(!/^[0-9a-f-]{36}$/i.test(b.requestKey||'')||!/^[0-9a-f-]{36}$/i.test(b.orderId||''))return reply({ok:false,error:'Invalid request'},400);
   const {data,error}=await db.rpc('cafe_guest_order_status',{p_request_key:b.requestKey,p_order_id:b.orderId});
   if(error||!data?.order)return reply({ok:false,error:'Order unavailable'},404);
   const o=data.order;
   return reply({ok:true,order:{id:o.id,orderNumber:o.orderNumber,totalVnd:o.totalVnd,paymentMethod:o.payment_method,paymentStatus:o.payment_status,status:o.status,stockReservedUntil:o.stockReservedUntil},payment:paymentFor({...o,order_number:o.orderNumber,total_vnd:o.totalVnd})});
  }
  if(b.orderType!=null&&!['pickup','delivery'].includes(b.orderType))return reply({ok:false,error:'Invalid order type'},400);
  const delivery=b.orderType==='delivery';
  if(delivery&&(typeof b.address!=='string'||b.address.trim().length<8||b.address.length>250||typeof b.latitude!=='number'||typeof b.longitude!=='number'||!Number.isFinite(b.latitude)||!Number.isFinite(b.longitude)))return reply({ok:false,error:'Invalid delivery point'},400);
  if(b.paymentMethod!=null&&!['cash','qr'].includes(b.paymentMethod))return reply({ok:false,error:'Invalid payment method'},400);
  if(b.tableNumber!=null&&(typeof b.tableNumber!=='string'||(b.tableNumber!==''&&!/^[1-6]$/.test(b.tableNumber))))return reply({ok:false,error:'Invalid table'},400);
  if(b.action!=='create'||typeof b.requestKey!=='string'||!/^[0-9a-f-]{36}$/i.test(b.requestKey))return reply({ok:false,error:'Invalid request'},400);
  if(b.locationId!=='e22788bd-4734-4b3a-911e-ba103d52617a')return reply({ok:false,error:'Invalid cafe'},400);
  const ip=(req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').trim();
  const salt=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!salt)return reply({ok:false,error:'Service unavailable'},503);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+ip));
  const ipHash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  const trackingToken=delivery?Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',new TextEncoder().encode(salt),{name:'HMAC',hash:'SHA-256'},false,['sign']),new TextEncoder().encode('guest-delivery:'+b.requestKey))),v=>v.toString(16).padStart(2,'0')).join(''):null;
  const trackingHash=trackingToken?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(trackingToken))),v=>v.toString(16).padStart(2,'0')).join(''):null;
  const {data,error}=await db.rpc(delivery?'submit_cafe_guest_delivery_v4':'submit_cafe_guest_order_v3',{...(delivery?{p_address:b.address,p_lat:b.latitude,p_lng:b.longitude,p_token_hash:trackingHash}:{}),p_payment_method:b.paymentMethod||'cash',p_request_key:b.requestKey,p_ip_hash:ipHash,p_location_id:b.locationId,p_items:b.items,p_customer_name:typeof b.name==='string'?b.name:'',p_customer_phone:typeof b.phone==='string'?b.phone:'',p_table_number:typeof b.tableNumber==='string'?b.tableNumber:null,p_source:typeof b.point==='string'?b.point.slice(0,80):''});
  if(error){if(error.message?.includes('READY_STOCK_UNAVAILABLE'))return reply({ok:false,code:'STOCK_UNAVAILABLE',error:'Часть блюд уже закончилась. Обновите корзину.'},409);console.error('Guest checkout rejected',error.code,error.message);return reply({ok:false,error:'Не удалось оформить заказ. Проверьте данные или позвоните в кафе.'},400);}
  if(delivery&&data?.order){data.trackingToken=trackingToken;data.order.orderType='delivery';}
  if(data?.order){const o=data.order;data.payment=paymentFor({id:o.id,order_number:o.orderNumber,total_vnd:o.totalVnd,location_id:b.locationId,payment_method:o.paymentMethod,payment_status:o.paymentStatus,status:o.status,currency:'VND'});}
  return reply(data,201);
 }catch(e){console.error('Guest checkout error',e);return reply({ok:false,error:'Сервис временно недоступен'},500)}
});
