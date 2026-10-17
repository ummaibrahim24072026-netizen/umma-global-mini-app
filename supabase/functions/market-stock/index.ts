import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { verifyTelegramInitData } from './auth.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({ok:false,error:'Method not allowed'},405);
 try {
  const raw=await req.text(); if(raw.length>100000)return reply({ok:false,error:'Request too large'},413);
  const body=JSON.parse(raw),token=Deno.env.get('TELEGRAM_BOT_TOKEN'),url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!token||!url||!key)return reply({ok:false,error:'Server configuration error'},500);
  if(typeof body.initData!=='string')return reply({ok:false,error:'Откройте приложение через Telegram'},401);
  const actor=await verifyTelegramInitData(body.initData,token);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:user,error:ue}=await db.from('telegram_users').select('role,is_active').eq('telegram_id',actor).maybeSingle();
  if(ue)throw ue;
  if(!user?.is_active)return reply({ok:false,error:'Market access denied'},403);
  const {data:assignments,error:ae}=await db.from('market_staff_roles').select('location_id,role').eq('telegram_id',actor).eq('is_active',true);
  if(ae)throw ae;
  const superAdmin=user.role==='super_admin',allowed=new Set((assignments??[]).map(r=>r.location_id));
  let warehousesQuery=db.from('market_warehouses').select('id,location_id,name,is_active,locations(name,city,country)').eq('is_active',true).order('name');
  if(!superAdmin)warehousesQuery=warehousesQuery.in('location_id',[...allowed]);
  const {data:warehouses,error:we}=await warehousesQuery;if(we)throw we;
  if(body.action==='bootstrap') {
   let locationsQuery=db.from('locations').select('id,name,city,country').eq('is_active',true).order('name');
   if(!superAdmin)locationsQuery=locationsQuery.in('id',[...allowed]);
   const {data:locations,error}=await locationsQuery;if(error)throw error;
   return reply({ok:true,warehouses,locations,roles:assignments,isSuperAdmin:superAdmin});
  }
  // First warehouse creation is explicitly scoped to a signed-in super administrator.
  if(body.action==='warehouse_create') {
   if(!superAdmin)return reply({ok:false,error:'Market access denied'},403);
   const location=String(body.data?.location_id??''),name=String(body.data?.name??'').trim();
   if(!uuid.test(location)||!name||name.length>160)return reply({ok:false,error:'Invalid warehouse'},400);
   const {data,error}=await db.from('market_warehouses').upsert({location_id:location,name,created_by_telegram_id:actor},{onConflict:'location_id,name',ignoreDuplicates:true}).select().maybeSingle();if(error)throw error;
   const existing=data??(await db.from('market_warehouses').select().eq('location_id',location).eq('name',name).single()).data;
   if(!existing)throw new Error('Warehouse unavailable');
   return reply({ok:true,warehouse:existing});
  }
  const warehouseId=body.data?.warehouse_id;
  const warehouse=(warehouses??[]).find(w=>w.id===warehouseId);
  if(!warehouse)return reply({ok:false,error:'Market access denied'},403);
  const myRoles=superAdmin?['admin']:((assignments??[]).filter(r=>r.location_id===warehouse.location_id).map(r=>r.role));
  if(body.action==='snapshot') {
   if(!myRoles.some(r=>['admin','receiver','packer','warehouse'].includes(r)))return reply({ok:false,error:'Market access denied'},403);
   const [{data:variants,error:ve},{data:batches,error:be},{data:documents,error:de},{data:suppliers,error:se}]=await Promise.all([
    db.from('market_product_variants').select('*,products(id,name_ru,name_en,name_vi,description_ru,image_url,price_vnd,sku,is_active)').order('id'),
    db.from('market_batches').select('*').eq('warehouse_id',warehouseId).order('created_at',{ascending:false}),
    db.from('market_documents').select('*').eq('warehouse_id',warehouseId).order('created_at',{ascending:false}).limit(200),
    db.from('suppliers').select('id,name,is_active,is_halal_verified').eq('is_active',true).order('name')
   ]);
   for(const error of [ve,be,de,se])if(error)throw error;
   const ids=(batches??[]).map(b=>b.id);
   const {data:units,error:un}=ids.length?await db.from('market_stock_units').select('*').in('batch_id',ids).order('created_at',{ascending:false}):{data:[],error:null};if(un)throw un;
   const countIds=(documents??[]).filter(d=>d.kind==='count'&&d.status==='pending').map(d=>d.id);
   const {data:counts,error:ce}=countIds.length?await db.from('market_inventory_count_items').select('*').in('document_id',countIds):{data:[],error:null};if(ce)throw ce;
   const financial=myRoles.includes('admin')||myRoles.includes('receiver');
   const cleanBatches=financial?batches:(batches??[]).map(({raw_cost_vnd,...b})=>b);
   const cleanUnits=financial?units:(units??[]).map(({cost_vnd,...u})=>u);
   const cleanDocs=financial?documents:(documents??[]).map(d=>({...d,payload:{batch_id:d.payload?.batch_id,unit_id:d.payload?.unit_id,quantity:d.payload?.quantity},result:{}}));
   const cleanCounts=financial?counts:(counts??[]).map(({surplus_cost_vnd,...c})=>c);
   return reply({ok:true,variants,batches:cleanBatches,units:cleanUnits,documents:cleanDocs,suppliers,counts:cleanCounts,roles:myRoles,financial,warehouse,asOf:new Date().toISOString()});
  }
  if(typeof body.request_id!=='string'||!uuid.test(body.request_id))return reply({ok:false,error:'Operation request ID required'},400);
  const {data,error}=await db.rpc('market_operation',{p_actor:actor,p_request:body.request_id,p_action:body.action,p_data:body.data});
  if(error){console.error('Market operation',body.action,error.code,error.message);return reply({ok:false,error:error.message},error.message.includes('access denied')?403:400);}
  return reply(data);
 }catch(e){
  const message=e instanceof Error?e.message:'Request failed';
  const auth=/Telegram|signature/i.test(message);
  console.error('Market request failed',message);
  return reply({ok:false,error:auth?'Не удалось проверить Telegram':'Не удалось выполнить операцию Market'},auth?401:400);
 }
});
