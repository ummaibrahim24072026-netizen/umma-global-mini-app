import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.99.1';
import {verifyWebStaffSession} from '../_shared/web-staff-auth.ts';
import {googleRubleQuote,googleTengeQuote} from '../cafe-guest-order/ruble-rate.ts';

const headers={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Content-Type':'application/json',
  'Cache-Control':'no-store',
};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{headers,status});
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const isUuid=(value:unknown)=>typeof value==='string'&&uuid.test(value);
const messages:Record<string,[number,string]>={
  GUEST_PAYMENT_PROOF_REQUIRED:[409,'Дождитесь чека клиента перед подтверждением оплаты.'],
  COUNTER_INVALID:[400,'Проверьте данные заказа.'],
  DELIVERY_POINT_REQUIRED:[400,'Выберите точку доставки на карте.'],
  DELIVERY_UNAVAILABLE:[400,'Доставка из выбранного кафе недоступна.'],
  DELIVERY_OUTSIDE_ZONE:[400,'Этот адрес вне зоны доставки выбранного кафе.'],
  COUNTER_ACCESS:[403,'Нет доступа к оплате этого заказа.'],
  COUNTER_UNAVAILABLE:[409,'Для этого способа оплаты ещё не настроены реквизиты.'],
  COUNTER_KZT_RATE:[409,'Курс тенге в Google Finance недоступен. Повторите позже или выберите другой способ оплаты.'],
  COUNTER_RATE:[409,'Курс рубля или реквизиты недоступны. Выберите другой способ оплаты или повторите позже.'],
  COUNTER_METHOD_CHANGED:[409,'Способ оплаты уже изменился. Откройте заказ заново.'],
  COUNTER_PAYMENT_PROOF:[409,'К заказу приложен чек. Сначала проверьте поступление оплаты.'],
  COUNTER_REFERENCE:[400,'Подтвердите поступление и укажите номер операции.'],
  COUNTER_CLOSED:[409,'Заказ уже оплачен или закрыт.'],
  COUNTER_DUPLICATE_REFERENCE:[409,'Этот номер операции уже использован для другого заказа.'],
};
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers});
  if(req.method!=='POST')return reply({ok:false},405);
  try{
    const raw=await req.text();
    if(raw.length>16000)return reply({ok:false,error:'Слишком большой запрос.'},413);
    const body=JSON.parse(raw);
    const {action,locationId,orderId,method,requestKey,items}=body;
    if(!['options','create','details','confirm','switch','settle'].includes(action)||
       !(action==='options'||action==='create'?isUuid(locationId):isUuid(orderId))){
      return reply({ok:false,error:messages.COUNTER_INVALID[1]},400);
    }
    const orderType=body.orderType??'pickup';
    const deliveryAddress=typeof body.deliveryAddress==='string'?body.deliveryAddress.trim().slice(0,500):'';
    const customerPhone=typeof body.customerPhone==='string'?body.customerPhone.trim().slice(0,40):'';
    if(action==='create'&&(!['pickup','dine_in','delivery'].includes(orderType)||
       (orderType==='delivery'&&(!deliveryAddress||!customerPhone))||
       !isUuid(requestKey)||!['rub','sber','tenge','kaspi','usdt'].includes(method)||
       !Array.isArray(items)||items.length<1||items.length>50||
       items.some((item:{productId:unknown,quantity:number})=>!item||!isUuid(item.productId)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>99))){
      return reply({ok:false,error:messages.COUNTER_INVALID[1]},400);
    }
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    const actor=await verifyWebStaffSession(db,String(body.initData||''));
    const needsQuote=action==='create'||action==='switch';
    const quote=needsQuote&&['rub','sber'].includes(method)?await googleRubleQuote():null;
    const tenge=needsQuote&&['tenge','kaspi'].includes(method)?await googleTengeQuote():null;
    const {data,error}=await db.rpc('cafe_counter_foreign_payment',{
      p_actor:actor,p_action:action,
      p_args:{locationId,orderId,method,requestKey,items,orderType,deliveryAddress,customerPhone,vndPerRub:quote?.vndPerRub,vndPerKzt:tenge?.vndPerKzt,quotedAt:(quote||tenge)?.quotedAt,
        expectedMethod:typeof body.expectedMethod==='string'?body.expectedMethod:undefined,
        expectedAmount:typeof body.expectedAmount==='number'&&Number.isFinite(body.expectedAmount)?body.expectedAmount:undefined,
        tenderedAmountVnd:Number.isSafeInteger(body.tenderedAmountVnd)?body.tenderedAmountVnd:undefined,
        changeGivenVnd:Number.isSafeInteger(body.changeGivenVnd)?body.changeGivenVnd:undefined,
        verified:body.verified===true,reference:typeof body.reference==='string'?body.reference.slice(0,101):undefined},
    });
    if(error){
      const known=messages[error.message];
      if(known)return reply({ok:false,error:known[1]},known[0]);
      if(/Idempotency key reused|READY_STOCK_UNAVAILABLE|Product not found/.test(error.message)){
        return reply({ok:false,error:'Заказ или наличие изменились. Проверьте корзину.'},409);
      }
      console.error('Counter payment failed',error.code);
      return reply({ok:false,error:'Не удалось сохранить оплату. Проверьте статус заказа.'},503);
    }
    return reply(data,action==='create'?201:200);
  }catch(error){
    const invalidSession=/Web (session|access)/.test(String(error));
    return reply({ok:false,error:invalidSession?'Войдите в рабочее приложение.':'Не удалось обработать запрос.'},invalidSession?401:400);
  }
});
