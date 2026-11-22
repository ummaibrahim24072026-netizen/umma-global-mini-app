import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.99.1';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const sha=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
function deliveryPoint(address: unknown) {
 const match = typeof address === 'string' && address.match(/(?:^|\n)Точка доставки: (-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*$/);
 if (!match) return;
 const latitude = Number(match[1]), longitude = Number(match[2]);
 if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) return {latitude, longitude};
}
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
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
   const orderId=typeof b.orderId==='string'&&uuid.test(b.orderId)?b.orderId:null;
   const requestKey=typeof b.requestKey==='string'&&uuid.test(b.requestKey)?b.requestKey:null;
   const trackingToken=typeof b.token==='string'&&/^[a-f0-9]{64}$/.test(b.token)?b.token:null;
   if((b.orderId&&!orderId)||(!(orderId&&requestKey)&&!trackingToken)){
    return reply({ok:false,code:'TRACKING_CREDENTIAL_INVALID'},403);
   }
   const {data:grant,error:grantError}=await db.rpc('umma_resolve_guest_tracking',{
    p_order:orderId,p_request_key:requestKey,p_token_hash:trackingToken?await sha(trackingToken):null,
   });
   if(grantError)throw grantError;
   if(!grant)return reply({ok:false,code:'TRACKING_CREDENTIAL_INVALID'},403);
   const {data:o,error:orderError}=await db.from('cafe_orders')
    .select('order_number,status,delivery_status,order_type,payment_status,courier_telegram_id,delivery_address,green_sm_stage')
    .eq('id',grant.orderId).maybeSingle();
   if(orderError)throw orderError;
   if(!o||o.order_type!=='delivery'||o.green_sm_stage)return reply({ok:false,code:'TRACKING_UNAVAILABLE'},404);
   const state=['completed','cancelled'].includes(o.status)?o.status:o.delivery_status||o.status;
   const data:Record<string,unknown>={ok:true,number:o.order_number,state,paymentStatus:o.payment_status,orderStatus:o.status};
   if(o.courier_telegram_id&&state==='picked_up'){
    data.channel=grant.channel;
    data.destination=deliveryPoint(o.delivery_address);
    const {data:p,error:positionError}=await db.from('cafe_delivery_tracking')
     .select('latitude,longitude,accuracy_m,position_at,enabled')
     .eq('order_id',grant.orderId).eq('courier_telegram_id',o.courier_telegram_id).maybeSingle();
    if(positionError)throw positionError;
    const age=Date.now()-Date.parse(p?.position_at||'');
    if(p&&Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=90&&Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180&&age>=-10000){
     Object.assign(data,{latitude:p.latitude,longitude:p.longitude,accuracy:p.accuracy_m,
      updatedAt:p.position_at,positionFresh:p.enabled&&age<60000});
    }
   }
   return reply(data);
  }
  return reply({ok:false},400);
 }catch(error){
  console.error('Guest delivery request failed', error instanceof Error?error.name:(error as {code?:string})?.code);
  return reply({ok:false,code:'TRACKING_SERVICE_UNAVAILABLE'},500);
 }
});
