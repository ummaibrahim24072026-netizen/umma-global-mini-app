import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.99.1';
import {googleCashQuote} from '../cafe-guest-order/ruble-rate.ts';
import {verifyWebStaffSession} from '../_shared/web-staff-auth.ts';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const respond=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
type Currency='USD'|'EUR';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return respond({ok:false,error:'Method not allowed'},405);
 try{
  const raw=await req.text();if(raw.length>4000)return respond({ok:false,error:'Invalid request'},400);
  const body=JSON.parse(raw),currency=body.currency;
  if(!['USD','EUR'].includes(currency)||!['quote','settle'].includes(body.action))return respond({ok:false,error:'Invalid request'},400);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const actor=await verifyWebStaffSession(db,String(body.initData||''));
  if(body.action==='settle'&&!uuid.test(String(body.orderId||'')))return respond({ok:false,error:'Invalid order'},400);
  let fx;
  if(body.action==='settle'){
   const {data,error}=await db.rpc('cafe_guest_checkout_payment',{p_order_id:body.orderId});
   if(error)throw error;
   if(data?.vndPerUnit&&data.currency===currency)fx=data;
  }
  fx??=await googleCashQuote(currency as Currency);
  if(!fx)throw Error('RATE_UNAVAILABLE');
  if(body.action==='quote')return respond({ok:true,...fx});
  const received=body.received;
  if(typeof received!=='number'||!Number.isFinite(received)||received<=0||received>1000000||Math.abs(Math.round(received*100)/100-received)>=1e-8)
   return respond({ok:false,error:'Укажите полученную сумму с точностью до цента.'},400);
  const {data,error}=await db.rpc('cafe_counter_fx_cash_settle',{
   p_actor:actor,p_order_id:body.orderId,p_currency:currency,p_rate:fx.vndPerUnit,
   p_received:received,p_quoted_at:fx.quotedAt
  });
  if(error){
   if(error.message==='COUNTER_INSUFFICIENT')return respond({ok:false,error:'Полученной суммы недостаточно по текущему курсу. Обновите расчёт.'},409);
   if(error.message==='COUNTER_CLOSED')return respond({ok:false,error:'Заказ уже оплачен или закрыт.'},409);
   if(error.message==='COUNTER_ACCESS')return respond({ok:false,error:'Нет доступа к этому заказу.'},403);
   console.error('FX cash settle failed',error.code);
   return respond({ok:false,error:'Не удалось сохранить оплату. Проверьте статус заказа.'},503);
  }
  return respond({ok:true,...data,rate:fx.vndPerUnit,quotedAt:fx.quotedAt});
 }catch(error){
  if(String(error).includes('RATE_UNAVAILABLE'))return respond({ok:false,error:'Актуальный курс Google Finance недоступен. Валютная оплата временно заблокирована.'},503);
  if(String(error).includes('Web session'))return respond({ok:false,error:'Войдите в рабочее приложение.'},401);
  console.error('FX cash request failed');
  return respond({ok:false,error:'Не удалось проверить курс или оплату.'},503);
 }
});