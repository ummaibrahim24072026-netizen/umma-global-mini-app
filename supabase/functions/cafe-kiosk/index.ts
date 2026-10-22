import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.95.3';
import {verifyTelegramInitData} from './auth.ts';
import {paymentFor,QR_LOCATION} from '../cafe-my-orders/payment.ts';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,authorization,apikey,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const hash=async(token:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),v=>v.toString(16).padStart(2,'0')).join('');
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply({ok:false,error:'Method not allowed'},405);
 try{
  if(Number(req.headers.get('content-length')||0)>20000)return reply({ok:false,error:'Request too large'},413);
  const raw=await req.text();if(raw.length>20000)return reply({ok:false,error:'Request too large'},413);
  const b=JSON.parse(raw);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  if(['register','devices','revoke'].includes(b.action)){
   let actor:number;try{actor=await verifyTelegramInitData(b.initData||'',Deno.env.get('TELEGRAM_BOT_TOKEN')!);}catch{return reply({ok:false,error:'Telegram authentication required'},401);}
   const {data:user,error:ue}=await db.from('telegram_users').select('role').eq('telegram_id',actor).eq('is_active',true).maybeSingle();
   if(ue||!user)return reply({ok:false,error:'Access denied'},403);
   let permitted:string[]=[];
   if(user.role==='super_admin'){
    const {data,error}=await db.from('locations').select('id').eq('is_active',true).in('location_type',['cafe','restaurant']);if(error)throw error;permitted=(data||[]).map(x=>x.id);
   }else if(['admin','employee'].includes(user.role)){
    const {data,error}=await db.from('cafe_staff').select('location_id').eq('telegram_id',actor).eq('is_active',true).eq('staff_role','manager');if(error)throw error;permitted=(data||[]).map(x=>x.location_id);
   }
   if(b.action==='devices'){
    const {data,error}=await db.from('cafe_kiosk_devices').select('id,label,location_id,is_active,created_at').in('location_id',permitted);if(error)throw error;return reply({ok:true,devices:data,locationIds:permitted});
   }
   if(!permitted.includes(b.locationId))return reply({ok:false,error:'Cafe manager access required'},403);
   if(b.action==='revoke'){
    const {error}=await db.from('cafe_kiosk_devices').update({is_active:false}).eq('id',b.deviceId).eq('location_id',b.locationId);if(error)throw error;return reply({ok:true});
   }
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
   const {data,error}=await db.from('cafe_kiosk_devices').insert({location_id:b.locationId,actor_telegram_id:actor,token_hash:await hash(token),label:String(b.label||'Уличный экран').slice(0,80)}).select('id').single();if(error)throw error;
   return reply({ok:true,deviceId:data.id,token});
  }
  if(typeof b.token!=='string'||!/^[a-f0-9]{64}$/.test(b.token))return reply({ok:false,error:'Activate this screen through the cafe administrator'},401);
  const {data:device,error:de}=await db.from('cafe_kiosk_devices').select('id,location_id,actor_telegram_id').eq('token_hash',await hash(b.token)).eq('is_active',true).maybeSingle();
  if(de||!device)return reply({ok:false,error:'Screen access disabled. Contact cafe staff.'},403);
  if(b.action==='config'){
   const {data,error}=await db.from('locations').select('id,name,address,is_active').eq('id',device.location_id).single();if(error||!data?.is_active)return reply({ok:false,error:'Cafe unavailable'},403);
   return reply({ok:true,location:data,qrAvailable:device.location_id===QR_LOCATION});
  }
  if(b.action==='create'){
   if(!Array.isArray(b.items)||b.items.length<1||b.items.length>50||b.items.some((x:any)=>!x||typeof x.productId!=='string'||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>99))return reply({ok:false,error:'Invalid order items'},400);
   const {data,error}=await db.rpc('submit_cafe_kiosk_order',{p_device_id:device.id,p_request_key:b.requestKey,p_items:b.items,p_order_type:b.orderType,p_payment_method:b.paymentMethod,p_table:b.table||null});
   if(error)return reply({ok:false,error:'Заказ не оформлен. '+error.message},400);
   return reply({ok:true,order:data.order,replayed:data.replayed});
  }
  if(b.action==='status'){
   const {data:link,error:le}=await db.from('cafe_kiosk_orders').select('order_id').eq('device_id',device.id).eq('order_id',b.orderId).maybeSingle();if(le||!link)return reply({ok:false,error:'Order unavailable'},404);
   const {data:o,error}=await db.from('cafe_orders').select('id,location_id,order_number,status,payment_method,payment_status,total_vnd,currency').eq('id',link.order_id).single();if(error)throw error;
   return reply({ok:true,order:{id:o.id,number:o.order_number,status:o.status,paymentStatus:o.payment_status,total:o.total_vnd},payment:paymentFor(o)});
  }
  return reply({ok:false,error:'Unknown action'},400);
 }catch{return reply({ok:false,error:'Сервис временно недоступен. Попробуйте снова или обратитесь к кассиру.'},500);}
});
