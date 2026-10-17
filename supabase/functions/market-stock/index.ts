import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { verifyTelegramInitData } from './auth.ts';
import { labelLink, serveLabels } from './labels.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const commerce=new Set(['order_create','order_cancel','payment_confirm','pick_scan','pick_complete','handover','pickup_complete','refund','missing','substitution_propose','substitution_answer','issue_resolve']);
const management=new Set(['offer_save','settings','category_save','product_update','variant_create','receipt_draft','receipt_accept','receipt_close','pack_with_loss','transfer','supplier_return','customer_return','product_print','shift_open','shift_close','reverse_writeoff']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function allRows(make:any){
 const rows:any[]=[];
 for(let start=0;start<50000;start+=500){const {data,error}=await make().range(start,start+499);if(error)return {data:null,error};rows.push(...(data??[]));if(!data||data.length<500)return {data:rows,error:null};}
 throw Error('Warehouse dataset too large; narrow the workspace scope');
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method==='GET'){const secret=Deno.env.get('TELEGRAM_BOT_TOKEN'),url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!secret||!url||!key)return reply({ok:false,error:'Server configuration error'},500);return serveLabels(req,createClient(url,key,{auth:{persistSession:false}}),secret);}
 if(req.method!=='POST')return reply({ok:false,error:'Method not allowed'},405);
 try {
  const raw=await req.text(); if(raw.length>8000000)return reply({ok:false,error:'Request too large'},413);
  const body=JSON.parse(raw),token=Deno.env.get('TELEGRAM_BOT_TOKEN'),url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(body.action!=='upload'&&raw.length>100000)return reply({ok:false,error:'Request too large'},413);
  if(!token||!url||!key)return reply({ok:false,error:'Server configuration error'},500);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  if(body.action==='catalog'){const {data,error}=await db.rpc('market_catalog',{p_warehouse:body.data?.warehouse_id||null});if(error)throw error;return reply(data);}
  if(typeof body.initData!=='string')return reply({ok:false,error:'Откройте приложение через Telegram'},401);
  const actor=await verifyTelegramInitData(body.initData,token);
  const {data:user,error:ue}=await db.from('telegram_users').select('role,is_active').eq('telegram_id',actor).maybeSingle();
  if(ue)throw ue;
  if(!user?.is_active)return reply({ok:false,error:'Market access denied'},403);
  if(body.action==='my_orders'){const {data,error}=await db.rpc('market_order_view',{p_actor:actor,p_warehouse:null,p_staff:false});if(error)throw error;return reply(data);}
  if(body.action==='quote'||body.action==='order_create'||body.action==='order_cancel'||body.action==='substitution_answer'){
   if(body.action==='quote'){const {data,error}=await db.rpc('market_quote',{p_warehouse:body.data?.warehouse_id,p_items:body.data?.items});if(error)return reply({ok:false,error:error.message},400);return reply(data);}
   if(!uuid.test(body.request_id||''))return reply({ok:false,error:'Operation request ID required'},400);
   const {data,error}=await db.rpc('market_commerce_operation',{p_actor:actor,p_request:body.request_id,p_action:body.action,p_data:body.data});
   if(error)return reply({ok:false,error:error.message},400);return reply(data);
  }
  const {data:assignments,error:ae}=await db.from('market_staff_roles').select('location_id,role').eq('telegram_id',actor).eq('is_active',true);
  if(ae)throw ae;
  const superAdmin=user.role==='super_admin',allowed=new Set((assignments??[]).map(r=>r.location_id));
  let warehousesQuery=db.from('market_warehouses').select('id,location_id,name,is_active,delivery_fee_vnd,reservation_minutes,sales_enabled,loss_alert_vnd,expiry_days,bank_transfer_details,locations(name,city,country)').eq('is_active',true).order('name');
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
   if(!myRoles.some(r=>['admin','receiver','packer','warehouse','picker','cashier'].includes(r)))return reply({ok:false,error:'Market access denied'},403);
   const [{data:variants,error:ve},{data:batches,error:be},{data:documents,error:de},{data:suppliers,error:se}]=await Promise.all([
    allRows(()=>db.from('market_product_variants').select('*,products(*)').order('id')),
    allRows(()=>db.from('market_batches').select('*').eq('warehouse_id',warehouseId).order('created_at',{ascending:false}).order('id')),
    db.from('market_documents').select('*').eq('warehouse_id',warehouseId).order('created_at',{ascending:false}).limit(200),
    db.from('suppliers').select('id,name,is_active,is_halal_verified').eq('is_active',true).order('name')
   ]);
   for(const error of [ve,be,de,se])if(error)throw error;
   const ids=(batches??[]).map(b=>b.id);
   const {data:units,error:un}=ids.length?await allRows(()=>db.from('market_stock_units').select('*,market_batches!inner(warehouse_id)').eq('market_batches.warehouse_id',warehouseId).order('id')):{data:[],error:null};if(un)throw un;
   const countIds=(documents??[]).filter(d=>d.kind==='count'&&d.status==='pending').map(d=>d.id);
   const {data:counts,error:ce}=countIds.length?await db.from('market_inventory_count_items').select('*').in('document_id',countIds):{data:[],error:null};if(ce)throw ce;
   const financial=myRoles.includes('admin')||myRoles.includes('receiver');
   const cleanBatches=financial?batches:(batches??[]).map(({raw_cost_vnd,...b})=>b);
   const cleanUnits=financial?units:(units??[]).map(({cost_vnd,...u})=>u);
   const cleanDocs=financial?documents:(documents??[]).map(d=>({...d,payload:{batch_id:d.payload?.batch_id,unit_id:d.payload?.unit_id,quantity:d.payload?.quantity},result:{}}));
   const cleanCounts=financial?counts:(counts??[]).map(({surplus_cost_vnd,...c})=>c);
   const [offersQ,barcodesQ,categoriesQ,receivingQ,alertsQ,rolesQ,shiftsQ]=await Promise.all([
    db.from('market_offers').select('*').eq('warehouse_id',warehouseId),db.from('market_product_barcodes').select('*'),db.from('categories').select('*').eq('category_type','market').order('sort_order'),db.from('market_receiving_drafts').select('*').eq('warehouse_id',warehouseId).order('created_at',{ascending:false}).limit(100),db.from('market_alerts').select('*').eq('warehouse_id',warehouseId).order('created_at',{ascending:false}).limit(100),myRoles.includes('admin')?db.from('market_staff_roles').select('*').eq('location_id',warehouse.location_id):Promise.resolve({data:[],error:null}),db.from('cafe_staff_shifts').select('*').eq('location_id',warehouse.location_id).eq('staff_telegram_id',actor).eq('shift_status','open')]);
   for(const q of [offersQ,barcodesQ,categoriesQ,receivingQ,alertsQ,rolesQ,shiftsQ])if(q.error)throw q.error;
   return reply({ok:true,offers:offersQ.data,barcodes:barcodesQ.data,categories:categoriesQ.data,receiving:financial?receivingQ.data:[],alerts:alertsQ.data,shifts:shiftsQ.data,staffRoles:rolesQ.data,variants,batches:cleanBatches,units:cleanUnits,documents:cleanDocs,suppliers,counts:cleanCounts,roles:myRoles,financial,warehouse,asOf:new Date().toISOString()});
  }
  if(body.action==='print_link'){
   if(!myRoles.some(r=>['admin','packer','warehouse'].includes(r)))return reply({ok:false,error:'Market access denied'},403);
   const {data:job,error:je}=await db.from('market_print_jobs').select('id,document_id').eq('id',body.data.job_id).single();if(je)throw je;
   const {data:doc,error:de}=await db.from('market_documents').select('id').eq('id',job.document_id).eq('warehouse_id',warehouseId).eq('actor_telegram_id',actor).single();if(de||!doc)return reply({ok:false,error:'Print access denied'},403);
   return reply({ok:true,url:await labelLink(job.id,actor,token,url)});
  }
  if(body.action==='staff_orders'){const {data,error}=await db.rpc('market_order_view',{p_actor:actor,p_warehouse:warehouseId,p_staff:true});if(error)throw error;return reply(data);}
  if(body.action==='audit'){
   if(!myRoles.includes('admin'))return reply({ok:false,error:'Market access denied'},403);
   let query=db.from('market_operations').select('actor_telegram_id,request_id,action,payload,result,created_at').eq('payload->>warehouse_id',warehouseId).order('created_at',{ascending:false}).limit(500);
   if(body.data.from)query=query.gte('created_at',body.data.from);if(body.data.to)query=query.lt('created_at',body.data.to);if(body.data.actor)query=query.eq('actor_telegram_id',Number(body.data.actor));
   const {data,error}=await query;if(error)throw error;return reply({ok:true,events:data});
  }
  if(body.action==='report'){const {data,error}=await db.rpc('market_report',{p_actor:actor,p_warehouse:warehouseId,p_from:body.data.from,p_to:body.data.to});if(error)throw error;return reply(data);}
  if(body.action==='upload'){
   const publicPhoto=body.data.kind==='product';
   if(!myRoles.includes('admin')&&(publicPhoto||!myRoles.includes('receiver')))return reply({ok:false,error:'Market access denied'},403);
   if(!uuid.test(body.request_id||'')||typeof body.data.base64!=='string'||body.data.base64.length>7000000)return reply({ok:false,error:'Invalid upload'},400);
   const bytes=Uint8Array.from(atob(body.data.base64),c=>c.charCodeAt(0)),mime=body.data.mime;
   const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP',pdf=String.fromCharCode(...bytes.slice(0,5))==='%PDF-';
   if(bytes.length<64||bytes.length>5242880||!((mime==='image/jpeg'&&jpg)||(mime==='image/png'&&png)||(mime==='image/webp'&&webp)||(!publicPhoto&&mime==='application/pdf'&&pdf)))return reply({ok:false,error:'Use JPEG, PNG, WEBP or evidence PDF up to 5 MB'},400);
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
   const path=warehouseId+'/'+body.request_id+'/'+digest+'.'+(jpg?'jpg':png?'png':webp?'webp':'pdf'),bucket=db.storage.from(publicPhoto?'market-catalog':'market-evidence');
   const saved=await bucket.upload(path,bytes,{contentType:mime,upsert:false});
   if(saved.error){const prior=await bucket.download(path);if(prior.error||!prior.data)throw saved.error;const previous=new Uint8Array(await prior.data.arrayBuffer());if(previous.length!==bytes.length||previous.some((v,i)=>v!==bytes[i]))throw Error('Upload content mismatch');}
   return reply({ok:true,path,url:publicPhoto?bucket.getPublicUrl(path).data.publicUrl:null});
  }
  if(body.action==='evidence_link'){
   if(!myRoles.some(r=>['admin','receiver','warehouse'].includes(r))||typeof body.data.path!=='string'||!body.data.path.startsWith(warehouseId+'/')||body.data.path.includes('..'))return reply({ok:false,error:'Market access denied'},403);
   const {data,error}=await db.storage.from('market-evidence').createSignedUrl(body.data.path,120);if(error)throw error;return reply({ok:true,url:data.signedUrl});
  }
  if(typeof body.request_id!=='string'||!uuid.test(body.request_id))return reply({ok:false,error:'Operation request ID required'},400);
  const {data,error}=await db.rpc(commerce.has(body.action)?'market_commerce_operation':management.has(body.action)?'market_management_operation':'market_operation',{p_actor:actor,p_request:body.request_id,p_action:body.action,p_data:body.data});
  if(error){console.error('Market operation',body.action,error.code,error.message);return reply({ok:false,error:error.message},error.message.includes('access denied')?403:400);}
  return reply(data);
 }catch(e){
  const message=e&&typeof (e as any).message==='string'?(e as any).message:'Request failed';
  const auth=/Telegram|signature/i.test(message);
  console.error('Market request failed',message);
  return reply({ok:false,error:auth?'Не удалось проверить Telegram':'Не удалось выполнить операцию Market'},auth?401:400);
 }
});
