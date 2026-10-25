import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function verify(initData:string,token:string):Promise<number>{
 const p=new URLSearchParams(initData),hash=p.get('hash'),date=Number(p.get('auth_date'));
 if(!hash||!/^[0-9a-f]{64}$/i.test(hash)||!Number.isFinite(date)||Math.abs(Date.now()/1000-date)>3600)throw Error('Invalid or expired Telegram authentication');
 const check=[...p.entries()].filter(([k])=>k!=='hash'&&k!=='signature').sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('WebAppData'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const secret=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(token));
 const hmac=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=new Uint8Array(await crypto.subtle.sign('HMAC',hmac,new TextEncoder().encode(check)));
 const expected=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
 if(expected.length!==hash.length||!Array.from(expected).every((v,i)=>v===hash.toLowerCase()[i]))throw Error('Invalid Telegram signature');
 const user=JSON.parse(p.get('user')||'{}');if(!Number.isSafeInteger(user.id))throw Error('Invalid Telegram user');
 return user.id;
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({ok:false,error:'Method not allowed'},405);
 try{
  const raw=await req.text();if(raw.length>50000)return reply({ok:false,error:'Request too large'},413);
  const body=JSON.parse(raw),token=Deno.env.get('TELEGRAM_BOT_TOKEN'),url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!token||!url||!key)return reply({ok:false,error:'Server not configured'},500);
  if(typeof body.initData!=='string')return reply({ok:false,error:'Telegram login required'},401);
  const actor=await verify(body.initData,token);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:user,error:ue}=await db.from('telegram_users').select('role,is_active').eq('telegram_id',actor).maybeSingle();
  if(ue)throw ue;if(!user?.is_active)return reply({ok:false,error:'Account inactive'},403);
  const {data:staff,error:se}=await db.from('b2b_staff').select('role').eq('telegram_id',actor).eq('is_active',true).maybeSingle();
  if(se)throw se;
  const admin=user.role==='super_admin'||staff?.role==='admin';
  const manager=admin||staff?.role==='manager';
  const warehouse=admin||staff?.role==='warehouse';
  const {data:membership,error:me}=await db.from('b2b_memberships').select('organization_id').eq('telegram_id',actor);
  if(me)throw me;
  const orgIds=(membership||[]).map((x:any)=>x.organization_id);
  if(!manager&&!warehouse&&!orgIds.length)return reply({ok:false,error:'B2B_ACCESS_DENIED'},403);
  const action=String(body.action||'');
  if(action==='bootstrap'){
   const {data:items,error:ie}=await db.from('b2b_catalog').select('id,sku,name_ru,category,unit,minimum_quantity,price_vnd,stock_item_id,location_id').eq('active',true).order('category').order('name_ru');
   if(ie)throw ie;
   const catalog=[];
   for(const item of items||[]){
    if(!item.stock_item_id||!item.location_id||item.price_vnd===null)continue;
    const {data:balance,error:be}=await db.from('stock_balances').select('quantity_on_hand,quantity_reserved').eq('stock_item_id',item.stock_item_id).eq('location_id',item.location_id).maybeSingle();
    if(be)throw be;
    catalog.push({id:item.id,sku:item.sku,name_ru:item.name_ru,category:item.category,unit:item.unit,minimum_quantity:item.minimum_quantity,price_vnd:item.price_vnd,available:Math.max(0,Number(balance?.quantity_on_hand||0)-Number(balance?.quantity_reserved||0))});
   }
   const {data:upcoming,error:pe}=await db.from('b2b_catalog').select('id,sku,name_ru,category,unit').eq('active',false).not('source_product_id','is',null).order('category').order('name_ru');
   if(pe)throw pe;
   let orgQuery=db.from('b2b_organizations').select('id,legal_name,business_type,address').eq('status','approved').order('legal_name');
   if(!manager&&!warehouse)orgQuery=orgQuery.in('id',orgIds);
   const {data:organizations,error:oe}=await orgQuery;if(oe)throw oe;
   return reply({ok:true,manager,warehouse,organizations,catalog,upcoming:upcoming||[]});
  }
  if(action==='create'){
   const org=String(body.organization_id||''),request=String(body.request_id||'');
   if(!uuid.test(org)||!uuid.test(request)||!Array.isArray(body.items)||body.items.length>100)return reply({ok:false,error:'Invalid order'},400);
   if(!manager&&!orgIds.includes(org))return reply({ok:false,error:'B2B_ACCESS_DENIED'},403);
   const payment=String(body.payment_method||'');
   if(!['online','cash_on_delivery','manager_cash'].includes(payment)||(!manager&&payment==='manager_cash'))return reply({ok:false,error:'Invalid payment method'},400);
   const {data,error}=await db.rpc('b2b_place_order',{p_actor:actor,p_request:request,p_org:org,p_items:body.items,p_source:manager?'field_manager':'buyer',p_payment:payment,p_address:String(body.address||'').slice(0,500),p_date:body.delivery_date||null});
   if(error)return reply({ok:false,error:error.message},400);
   return reply({ok:true,order_id:data});
  }
  if(action==='orders'){
   let q=db.from('b2b_orders').select('id,organization_id,status,payment_method,payment_status,delivery_address,delivery_date,created_at,b2b_order_lines(quantity,price_vnd,b2b_catalog(name_ru,unit))').order('created_at',{ascending:false}).limit(100);
   if(!manager&&!warehouse)q=q.in('organization_id',orgIds);
   const {data,error}=await q;if(error)throw error;
   return reply({ok:true,orders:data});
  }
  if(['dispatch','cancel'].includes(action)){
   if(!manager&&!warehouse)return reply({ok:false,error:'B2B_ACCESS_DENIED'},403);
   if(!uuid.test(String(body.order_id||'')))return reply({ok:false,error:'Invalid order ID'},400);
   const fn=action==='dispatch'?'b2b_dispatch_order':'b2b_release_order';
   const {error}=await db.rpc(fn,{p_order_id:body.order_id,p_actor_telegram_id:actor});
   if(error)return reply({ok:false,error:error.message},400);
   return reply({ok:true});
  }
  return reply({ok:false,error:'Unknown action'},400);
 }catch(err){const m=String(err instanceof Error?err.message:err);return reply({ok:false,error:m.includes('Telegram')?'Telegram authentication failed':'B2B request failed'},m.includes('Telegram')?401:500);}
});