import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.95.3';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'content-type','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply({ok:false,error:'Method not allowed'},405);
 try{
  const raw=await req.text();if(raw.length>12000)return reply({ok:false,error:'Request too large'},413);
  const b=JSON.parse(raw);
  if(b.action!=='create'||typeof b.requestKey!=='string'||!/^[0-9a-f-]{36}$/i.test(b.requestKey))return reply({ok:false,error:'Invalid request'},400);
  const ip=(req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').trim();
  const salt=Deno.env.get('GUEST_ORDER_RATE_SALT');if(!salt)return reply({ok:false,error:'Guest ordering not configured'},503);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+ip));
  const ipHash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data,error}=await db.rpc('submit_cafe_guest_order',{p_request_key:b.requestKey,p_ip_hash:ipHash,p_location_id:b.locationId,p_items:b.items,p_customer_name:b.name||'',p_customer_phone:b.phone||'',p_source:b.point||''});
  if(error){console.error('Guest checkout rejected',error.code);return reply({ok:false,error:'Не удалось оформить заказ. Проверьте данные или обратитесь в кафе.'},400);}
  return reply(data,201);
 }catch(e){console.error('Guest checkout error');return reply({ok:false,error:'Сервис временно недоступен'},500)}
});