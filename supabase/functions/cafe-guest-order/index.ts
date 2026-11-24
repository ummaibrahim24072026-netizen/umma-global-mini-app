import {googleCashQuote,googleRubleQuote,googleTengeQuote} from './ruble-rate.ts';
import {paymentFor} from '../cafe-my-orders/payment.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.95.3';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers});
const cafeId='e22788bd-4734-4b3a-911e-ba103d52617a';
async function paymentQuote(method:string){
 if(method==='sber'){
  const quote=await googleRubleQuote();
  return quote&&{currency:'RUB',vndPerUnit:Number(quote.vndPerRub),quotedAt:quote.quotedAt,source:'Google Finance'};
 }
 if(method==='kaspi'){
  const quote=await googleTengeQuote();
  return quote&&{currency:'KZT',vndPerUnit:Number(quote.vndPerKzt),quotedAt:quote.quotedAt,source:'Google Finance'};
 }
 if(method==='usd'||method==='eur')return googleCashQuote(method==='usd'?'USD':'EUR');
 return null;
}
async function guestPayment(db: ReturnType<typeof createClient>, order: any) {
 if(!['bank_transfer','cash'].includes(order.payment_method))return paymentFor(order);
 if(order.payment_status!=='pending'||['cancelled','completed'].includes(order.status))return null;
 const {data,error}=await db.rpc('cafe_guest_checkout_payment',{p_order_id:order.id});
 if(error)throw error;
 return data?.currency?data:null;
}
async function receiptFor(db: ReturnType<typeof createClient>, orderId: string) {
 const {data,error}=await db.from('cafe_orders')
  .select('subtotal_vnd,delivery_fee_vnd,discount_vnd,total_vnd,payment_method,payment_status,status,order_type,dispatch_mode,requires_prepayment,customer_telegram_id,courier_telegram_id,green_sm_stage,green_sm_tracking_url,cafe_order_items(product_name_ru,product_name_en,product_name_vi,quantity,unit_price_vnd,line_total_vnd),cafe_payment_receipts(tendered_amount_vnd,change_given_vnd)')
  .eq('id',orderId)
  .eq('cafe_payment_receipts.payment_method','cash')
  .eq('cafe_payment_receipts.receipt_status','confirmed')
  .order('collected_at',{referencedTable:'cafe_payment_receipts',ascending:false})
  .limit(1,{referencedTable:'cafe_payment_receipts'})
  .maybeSingle();
 if(error||!data){
  console.error('Guest receipt unavailable',error?.code);
  return {};
 }
 const cash=data.cafe_payment_receipts[0];
 return {
  totalVnd:data.total_vnd,orderType:data.order_type,paymentMethod:data.payment_method,paymentStatus:data.payment_status,status:data.status,
  items:data.cafe_order_items.map(({product_name_ru,product_name_en,product_name_vi,quantity,unit_price_vnd,line_total_vnd})=>({
   name_ru:product_name_ru,name_en:product_name_en,name_vi:product_name_vi,quantity,unitPriceVnd:unit_price_vnd,lineTotalVnd:line_total_vnd,
  })),
  isGreenSm:data.order_type==='delivery'&&data.dispatch_mode==='manual'&&data.requires_prepayment&&data.customer_telegram_id==null&&data.courier_telegram_id==null,
  greenSmStage:data.green_sm_stage,greenSmTrackingUrl:data.green_sm_tracking_url,
  subtotalVnd:data.subtotal_vnd,deliveryFeeVnd:data.delivery_fee_vnd,discountVnd:data.discount_vnd,
  cashReceipt:data.payment_method==='cash'&&data.payment_status==='paid'&&cash?.tendered_amount_vnd!=null&&cash.change_given_vnd!=null
   ?{tenderedVnd:cash.tendered_amount_vnd,changeVnd:cash.change_given_vnd}:null,
 };
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='GET'&&req.method!=='POST')return reply({ok:false,error:'Method not allowed'},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 if(req.method==='GET'){
  const params=new URL(req.url).searchParams;
  const marketPreviewEnabled=Deno.env.get('UMMA_WEB_MARKET_PREVIEW')==='true';
  if(params.has('storefront')){
   const {data,error}=await db.rpc('cafe_web_section_catalog',{p_location:cafeId});
   if(error)return reply({ok:false,error:'Storefront unavailable'},503);
   return reply({ok:true,sections:data,marketPreviewEnabled});
  }
  if(params.has('marketCatalog')){
   if(!marketPreviewEnabled)return reply({ok:false},404);
   const {data,error}=await db.rpc('market_catalog',{p_warehouse:null});
   if(error||!data?.ok)return reply({ok:false,error:'Catalogue unavailable'},503);
   const warehouses=data.warehouses.filter((warehouse:any)=>warehouse.location_id===cafeId);
   const activeWarehouseIds=new Set(warehouses.map((warehouse:any)=>warehouse.id));
   return reply({
    ok:true,
    categories:data.categories,
    offers:data.offers.filter((offer:any)=>activeWarehouseIds.has(offer.warehouse_id)),
   });
  }
  if(params.has('paymentOptions')){
   const {data,error}=await db.rpc('cafe_guest_payment_rates',{p_location_id:cafeId});
   return error||!data?reply({ok:false},503):reply({ok:true,...data});
  }
  const method=params.get('paymentQuote');
  if(method){
   if(!['sber','kaspi','usd','eur'].includes(method))return reply({ok:false},400);
   const quote=await paymentQuote(method);
   return quote?reply({ok:true,...quote}):reply({ok:false,code:'PAYMENT_RATE_UNAVAILABLE'},503);
  }
  if(params.has('rubRate')){
   const quote=await googleRubleQuote();
   return quote?reply({ok:true,...quote}):reply({ok:false,code:'RUBLE_RATE_UNAVAILABLE'},503);
  }
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
   const order={id:o.id,orderNumber:o.orderNumber,totalVnd:o.totalVnd,paymentMethod:o.payment_method,paymentStatus:o.payment_status,status:o.status,stockReservedUntil:o.stockReservedUntil,preorderWaiting:o.preorderWaiting,preorderExpectedAt:o.preorderExpectedAt,...await receiptFor(db,o.id)};
   return reply({ok:true,order,payment:await guestPayment(db,{...o,order_number:o.orderNumber,total_vnd:order.totalVnd,payment_method:order.paymentMethod,payment_status:order.paymentStatus,status:order.status})});
  }
  if(b.orderType!=null&&!['pickup','dine_in','delivery'].includes(b.orderType))return reply({ok:false,error:'Invalid order type'},400);
  const delivery=b.orderType==='delivery';
  if(delivery&&(typeof b.address!=='string'||b.address.trim().length<8||b.address.length>250||typeof b.latitude!=='number'||typeof b.longitude!=='number'||!Number.isFinite(b.latitude)||!Number.isFinite(b.longitude)))return reply({ok:false,error:'Invalid delivery point'},400);
  if(b.paymentMethod!=null&&!['cash','qr','bank_transfer','usd','eur','sber','kaspi','usdt'].includes(b.paymentMethod))return reply({ok:false,error:'Invalid payment method'},400);
  const requestedCash=b.requestedCashVnd;
  if(requestedCash!=null&&(!delivery||b.paymentMethod!=='cash'||!Number.isInteger(requestedCash)||requestedCash<=0||requestedCash>2147483647))
   return reply({ok:false,error:'Invalid requested cash'},400);
  if(b.tableNumber!=null&&(typeof b.tableNumber!=='string'||(b.tableNumber!==''&&!/^[1-6]$/.test(b.tableNumber))))return reply({ok:false,error:'Invalid table'},400);
  if(b.action!=='create'||typeof b.requestKey!=='string'||!/^[0-9a-f-]{36}$/i.test(b.requestKey))return reply({ok:false,error:'Invalid request'},400);
  if(b.locationId!==cafeId)return reply({ok:false,error:'Invalid cafe'},400);
  const ip=(req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').trim();
  const salt=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!salt)return reply({ok:false,error:'Service unavailable'},503);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+ip));
  const ipHash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  const trackingToken=delivery?Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',new TextEncoder().encode(salt),{name:'HMAC',hash:'SHA-256'},false,['sign']),new TextEncoder().encode('guest-delivery:'+b.requestKey))),v=>v.toString(16).padStart(2,'0')).join(''):null;
  const trackingHash=trackingToken?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(trackingToken))),v=>v.toString(16).padStart(2,'0')).join(''):null;
  const orderArgs={...(delivery?{p_address:b.address,p_lat:b.latitude,p_lng:b.longitude,p_token_hash:trackingHash}:{}),p_request_key:b.requestKey,p_ip_hash:ipHash,p_location_id:b.locationId,p_items:b.items,p_customer_name:typeof b.name==='string'?b.name:'',p_customer_phone:typeof b.phone==='string'?b.phone:'',p_table_number:b.orderType==='dine_in'&&!b.tableNumber?'dine_in':typeof b.tableNumber==='string'?b.tableNumber:null,p_source:typeof b.point==='string'?b.point.slice(0,80):''};
  const args={...orderArgs,p_payment_method:b.paymentMethod||'cash'};
  const quote=b.paymentMethod==='bank_transfer'?await googleRubleQuote():null;
  const extended=['usd','eur','sber','kaspi','usdt'].includes(b.paymentMethod);
  const fx=extended?await paymentQuote(b.paymentMethod):null;
  const {data,error}=requestedCash!=null
   ?await db.rpc('submit_cafe_guest_delivery_cash',{...orderArgs,p_requested_cash_vnd:requestedCash})
   :extended
   ?await db.rpc('submit_cafe_guest_payment_choice',{p_args:args,p_method:b.paymentMethod,p_rate:fx?.vndPerUnit??null,p_quoted_at:fx?.quotedAt??null})
   :b.paymentMethod==='bank_transfer'
   ?await db.rpc('submit_cafe_web_ruble_order',{p_args:args,p_vnd_per_rub:quote?.vndPerRub??null,p_quoted_at:quote?.quotedAt??null})
   :await db.rpc(delivery?'submit_cafe_guest_delivery_v4':'submit_cafe_guest_order_v3',args);
  if(error){if(['CASH_AMOUNT_TOO_LOW','PAYMENT_METHOD_UNAVAILABLE','PAYMENT_RATE_UNAVAILABLE'].includes(error.message))return reply({ok:false,code:error.message},422);if(error.message?.includes('RUBLE_RATE_UNAVAILABLE'))return reply({ok:false,code:'RUBLE_RATE_UNAVAILABLE'},422);if(error.message?.includes('READY_STOCK_UNAVAILABLE'))return reply({ok:false,code:'STOCK_UNAVAILABLE',error:'Часть блюд уже закончилась. Обновите корзину.'},409);console.error('Guest checkout rejected',error.code,error.message);return reply({ok:false,error:'Не удалось оформить заказ. Проверьте данные или позвоните в кафе.'},400);}
  if(delivery&&data?.order){data.trackingToken=trackingToken;data.order.orderType='delivery';}
  if(data?.order){
   const o=data.order;
   Object.assign(o,await receiptFor(db,o.id));
   data.payment=await guestPayment(db,{id:o.id,order_number:o.orderNumber,total_vnd:o.totalVnd,location_id:b.locationId,payment_method:o.paymentMethod,payment_status:o.paymentStatus,status:o.status,currency:'VND'});
  }
  return reply(data,201);
 }catch(e){console.error('Guest checkout error',e);return reply({ok:false,error:'Сервис временно недоступен'},500)}
});
