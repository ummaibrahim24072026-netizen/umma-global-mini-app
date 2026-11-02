import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.95.3';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='GET'&&req.method!=='POST')return reply({ok:false,error:'Method not allowed'},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 if(req.method==='GET'){
  if(!new URL(req.url).searchParams.has('catalog')){const target=new URL('https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/menu/');const point=new URL(req.url).searchParams.get('point');if(point)target.searchParams.set('point',point.slice(0,80));return Response.redirect(target.href,302);}
  const {data,error}=await db.from('products').select('id,name_ru,name_vi,name_en,price_vnd,image_url').eq('product_type','cafe').eq('is_active',true).eq('catalog_preview',false).gt('price_vnd',0).order('sort_order',{ascending:true}).limit(150);
  return error?reply({ok:false,error:'Menu unavailable'},503):reply({ok:true,products:data||[]});
 }
 try{
  const raw=await req.text();if(raw.length>12000)return reply({ok:false,error:'Request too large'},413);
  const b=JSON.parse(raw);
  if(b.tableNumber!=null&&(typeof b.tableNumber!=='string'||(b.tableNumber!==''&&!/^[1-6]$/.test(b.tableNumber))))return reply({ok:false,error:'Invalid table'},400);
  if(b.action!=='create'||typeof b.requestKey!=='string'||!/^[0-9a-f-]{36}$/i.test(b.requestKey))return reply({ok:false,error:'Invalid request'},400);
  if(b.locationId!=='e22788bd-4734-4b3a-911e-ba103d52617a')return reply({ok:false,error:'Invalid cafe'},400);
  const ip=(req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').trim();
  const salt=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!salt)return reply({ok:false,error:'Service unavailable'},503);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+ip));
  const ipHash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  const {data,error}=await db.rpc('submit_cafe_guest_order_v2',{p_request_key:b.requestKey,p_ip_hash:ipHash,p_location_id:b.locationId,p_items:b.items,p_customer_name:typeof b.name==='string'?b.name:'',p_customer_phone:typeof b.phone==='string'?b.phone:'',p_table_number:typeof b.tableNumber==='string'?b.tableNumber:null,p_source:typeof b.point==='string'?b.point.slice(0,80):''});
  if(error){console.error('Guest checkout rejected',error.code,error.message);return reply({ok:false,error:'Не удалось оформить заказ. Проверьте данные или позвоните в кафе.'},400);}
  return reply(data,201);
 }catch(e){console.error('Guest checkout error',e);return reply({ok:false,error:'Сервис временно недоступен'},500)}
});
