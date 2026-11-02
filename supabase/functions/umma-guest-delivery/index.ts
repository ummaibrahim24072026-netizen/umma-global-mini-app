import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.99.1';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const sha=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply({ok:false},405);
 try{
  const raw=await req.text();if(raw.length>4096)return reply({ok:false},413);
  const b=JSON.parse(raw);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  if(b.action==='issue'){
   if(typeof b.deviceToken!=='string'||!/^[a-f0-9]{64}$/.test(b.deviceToken)||typeof b.orderId!=='string'||!/^[a-f0-9-]{36}$/.test(b.orderId))return reply({ok:false},400);
   const {data:device}=await db.from('cafe_kiosk_devices').select('id,location_id').eq('token_hash',await sha(b.deviceToken)).eq('is_active',true).maybeSingle();
   if(!device)return reply({ok:false},403);
   const {data:link}=await db.from('cafe_kiosk_orders').select('order_id').eq('device_id',device.id).eq('order_id',b.orderId).maybeSingle();
   if(!link)return reply({ok:false},404);
   const {data:order}=await db.from('cafe_orders').select('id,order_type,location_id').eq('id',link.order_id).eq('location_id',device.location_id).maybeSingle();
   if(!order||order.order_type!=='delivery')return reply({ok:false},404);
   const secret=token();
   const {error}=await db.from('umma_guest_delivery_grants').insert({order_id:order.id,token_hash:await sha(secret)});
   if(error)throw error;
   return reply({ok:true,token:secret,expiresInSeconds:172800});
  }
  if(b.action==='tracking'){
   if(typeof b.token!=='string'||!/^[a-f0-9]{64}$/.test(b.token))return reply({ok:false},404);
   const {data:grant}=await db.from('umma_guest_delivery_grants').select('order_id').eq('token_hash',await sha(b.token)).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle();
   if(!grant)return reply({ok:false},404);
   const {data:o}=await db.from('cafe_orders').select('order_number,status,delivery_status,order_type,payment_status,courier_telegram_id').eq('id',grant.order_id).maybeSingle();
   if(!o||o.order_type!=='delivery')return reply({ok:false},404);
   const data:any={ok:true,number:o.order_number,state:['completed','cancelled'].includes(o.status)?o.status:o.delivery_status||o.status,paymentStatus:o.payment_status,orderStatus:o.status};
   if(o.courier_telegram_id&&['courier_assigned','picked_up'].includes(String(data.state))&&!['completed','cancelled'].includes(o.status)){
    const {data:p}=await db.from('cafe_delivery_tracking').select('latitude,longitude,position_at,enabled').eq('order_id',grant.order_id).eq('courier_telegram_id',o.courier_telegram_id).eq('enabled',true).maybeSingle();
    if(p&&p.latitude!=null&&p.longitude!=null&&p.position_at&&Date.now()-Date.parse(p.position_at)<60000&&Date.now()-Date.parse(p.position_at)>=-10000){
      data.latitude=p.latitude;data.longitude=p.longitude;data.updatedAt=p.position_at;
    }
   }
   return reply(data);
  }
  return reply({ok:false},400);
 }catch{return reply({ok:false,error:'Service temporarily unavailable'},500);}
});
