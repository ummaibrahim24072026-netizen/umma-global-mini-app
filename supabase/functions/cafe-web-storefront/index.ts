import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.99.1';
import {verifyWebStaffSession} from '../_shared/web-staff-auth.ts';

const location='e22788bd-4734-4b3a-911e-ba103d52617a';
const sections=new Set(['breakfast','lunch','dinner','dish-day','family','daily']);
const sectionDefaults={breakfast:true,lunch:false,dinner:false,daily:false,family:false,'dish-day':false,cooking:false};
const adjustable=(section: string)=>Object.hasOwn(sectionDefaults,section);
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const time=/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
const placementFields='product_id,section,enabled,allow_preorder,service_date,starts_at,ends_at';
const headers={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'content-type',
 'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store',
};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{headers,status});

function validCombo(data: any) {
 if(!data||typeof data.nameRu!=='string'||!data.nameRu.trim()||
   [data.nameRu,data.nameEn,data.nameVi].some(name=>typeof name!=='string'||name.length>120)||
   !Number.isInteger(data.price)||data.price<1||data.price>100000000||
   data.persons!==null&&(!Number.isInteger(data.persons)||data.persons<1||data.persons>99)||
   typeof data.published!=='boolean'||typeof data.imageUrl!=='string'||data.imageUrl.length>1000||
   !Array.isArray(data.components)||data.components.length<2||data.components.length>20)return false;
 try{
  const url=new URL(data.imageUrl);
  return url.protocol==='https:'&&!url.username&&!url.password;
 }catch{return false;}
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers,status:204});
 if(req.method!=='GET'&&req.method!=='POST')return reply({ok:false},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  if(req.method==='GET'){
   if(new URL(req.url).searchParams.has('marketCatalog')){
    const {data:warehouse,error:warehouseError}=await db.from('market_warehouses')
      .select('id').eq('location_id',location).eq('is_active',true).eq('sales_enabled',true)
      .order('id').limit(1).maybeSingle();
    if(warehouseError)throw warehouseError;
    if(!warehouse)return reply({ok:true,categories:[],offers:[]});
    const {data,error}=await db.rpc('market_catalog',{p_warehouse:warehouse.id});
    if(error||!data?.ok)throw error||Error('Market catalog unavailable');
    const categories=data.categories.map(({id,name_ru,name_en,name_vi}:any)=>({id,name_ru,name_en,name_vi}));
    const offers=data.offers.map((offer:any)=>({
     warehouse_id:offer.warehouse_id,variant_id:offer.variant_id,product:offer.product,
     price_vnd:offer.price_vnd,sale_mode:offer.sale_mode,measure:offer.measure,
     fixed_quantity:offer.fixed_quantity,available_quantity:offer.available_quantity,
     composition:offer.composition,storage_conditions:offer.storage_conditions,
     units:offer.units.map(({quantity,price_vnd,expires_on}:any)=>({quantity,price_vnd,expires_on})),
    }));
    return reply({ok:true,categories,offers});
   }
   const [assignments,visibility]=await Promise.all([
    db.rpc('cafe_web_section_catalog',{p_location:location}),
    db.from('cafe_web_section_visibility').select('section,enabled').eq('location_id',location),
   ]);
   if(assignments.error||visibility.error)throw assignments.error||visibility.error;
   return reply({ok:true,sections:assignments.data,visibility:{...sectionDefaults,
    ...Object.fromEntries(visibility.data.map(row=>[row.section,row.enabled]))}});
  }

  const raw=await req.text();
  if(raw.length>12000)return reply({ok:false,error:'Слишком большой запрос'},413);
  let body;
  try{body=JSON.parse(raw);}catch{return reply({ok:false,error:'Некорректный запрос'},400);}
  if(!body||!['storefrontList','storefrontSave','storefrontVisibility','comboSave'].includes(body.action)||typeof body.locationId!=='string'||!uuid.test(body.locationId))
    return reply({ok:false,error:'Выберите кафе'},400);
  let actor;
  try{actor=await verifyWebStaffSession(db,String(body.initData||''));}
  catch{return reply({ok:false,error:'Войдите в UMMA Work'},401);}
  const locationId=body.locationId;
  const [{data:user,error:userError},{data:manager,error:managerError},{data:cafe,error:cafeError}]=await Promise.all([
    db.from('telegram_users').select('role').eq('telegram_id',actor).eq('is_active',true).maybeSingle(),
    db.from('cafe_staff').select('staff_role').eq('telegram_id',actor).eq('location_id',locationId).eq('staff_role','manager').eq('is_active',true).limit(1).maybeSingle(),
    db.from('locations').select('id').eq('id',locationId).eq('location_type','cafe').eq('is_active',true).maybeSingle(),
  ]);
  if(userError||managerError||cafeError)throw userError||managerError||cafeError;
  if(!user||(user.role!=='super_admin'&&!manager))return reply({ok:false,error:'Нет доступа к витрине этого кафе'},403);
  if(!cafe)return reply({ok:false,error:'Кафе недоступно'},404);

  const productQuery=()=>db.from('products').select('id,name_ru,sku').eq('product_type','cafe').eq('is_active',true).eq('catalog_preview',false)
   .or('sku.is.null,sku.not.like.UMMA-COMBO-*');
  if(body.action==='storefrontList'){
   const [products,assignments,visibility,combos]=await Promise.all([
    productQuery().order('name_ru'),
    db.from('cafe_web_sections').select(placementFields).eq('location_id',locationId).order('section').order('product_id'),
    db.from('cafe_web_section_visibility').select('section,enabled').eq('location_id',locationId),
    db.from('cafe_combos').select('product_id,persons,product:products(name_ru,name_en,name_vi,image_url,price_vnd,is_active),components:cafe_combo_components!cafe_combo_components_combo_id_fkey(product_id,portions,weight_g,dish:products(name_ru))').eq('location_id',locationId).order('product_id'),
   ]);
   if(products.error||assignments.error||visibility.error||combos.error)
    throw products.error||assignments.error||visibility.error||combos.error;
   return reply({ok:true,products:products.data,assignments:assignments.data,combos:combos.data,
    visibility:{...sectionDefaults,...Object.fromEntries(visibility.data.map(row=>[row.section,row.enabled]))}});
  }

  if(body.action==='storefrontVisibility'){
   if(!adjustable(body.section)||typeof body.enabled!=='boolean')return reply({ok:false,error:'Выберите раздел'},400);
   const {error}=await db.from('cafe_web_section_visibility').upsert({
    location_id:locationId,section:body.section,enabled:body.enabled,
   },{onConflict:'location_id,section'});
   if(error)throw error;
   return reply({ok:true});
  }
  if(body.action==='comboSave'){
   const {comboId,combo}=body;
   if(comboId!=null&&(typeof comboId!=='string'||!uuid.test(comboId))||!validCombo(combo)||
      combo.components.some((line:any)=>!line||typeof line.productId!=='string'||!uuid.test(line.productId)||
       !Number.isFinite(line.portions)||line.portions<0.001||line.portions>20||
       !Number.isFinite(line.weightG)||line.weightG<0.01||line.weightG>99999))
    return reply({ok:false,error:'Проверьте название, фото, цену и состав комбо'},400);
   const {data,error}=await db.rpc('cafe_combo_save',{p_location:locationId,p_combo:comboId??null,p_data:{
    ...combo,nameRu:combo.nameRu.trim(),nameEn:combo.nameEn.trim(),nameVi:combo.nameVi.trim(),
   }});
   if(error?.message.startsWith('INVALID_COMBO'))
    return reply({ok:false,error:'Проверьте блюда, точность количества и доступность учёта остатков'},400);
   if(error)throw error;
   return reply({ok:true,comboId:data});
  }

  const {section,productId,enabled,allowPreorder}=body;
  if(!sections.has(section)||typeof productId!=='string'||!uuid.test(productId)||
     typeof enabled!=='boolean'||typeof allowPreorder!=='boolean')
   return reply({ok:false,error:'Выберите блюдо и раздел'},400);
  const start=body.startsAt||null,end=body.endsAt||null,date=body.serviceDate||null;
  if(Boolean(start)!==Boolean(end)||start&&(typeof start!=='string'||typeof end!=='string'||!time.test(start)||!time.test(end)||start===end))
   return reply({ok:false,error:'Укажите корректное время начала и окончания'},400);
  if(section==='dish-day'&&!date||date&&(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||
     !Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))
   return reply({ok:false,error:'Выберите корректную дату'},400);
  const {data:product,error:productError}=await productQuery().eq('id',productId).maybeSingle();
  if(productError)throw productError;
  if(!product)return reply({ok:false,error:'Блюдо недоступно'},404);
  const {error}=await db.from('cafe_web_sections').upsert({
   location_id:locationId,product_id:productId,section,enabled,allow_preorder:allowPreorder,
   service_date:date,starts_at:start,ends_at:end,
  },{onConflict:'location_id,product_id,section'});
  if(error)throw error;
  return reply({ok:true});
 }catch(error){
  console.error('Web storefront request failed',error);
  return reply({ok:false,error:'Не удалось обновить витрину. Попробуйте ещё раз.'},503);
 }
});
