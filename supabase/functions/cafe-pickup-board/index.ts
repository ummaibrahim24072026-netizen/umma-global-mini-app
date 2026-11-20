import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.99.1';
import {sha256,verifyWebStaffSession} from '../_shared/web-staff-auth.ts';

const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers});
const tokenValid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const uuidValid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const callWindowMs=3*60*1000;

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply({ok:false},405);
  let body;
  try{
    const input=await request.text();
    if(input.length>2048)return reply({ok:false},413);
    body=JSON.parse(input);
    if(!body||typeof body!=='object')return reply({ok:false},400);
  }catch{return reply({ok:false},400);}

  try{
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{
      auth:{persistSession:false,autoRefreshToken:false}
    });
    if(body.action==='poll'){
      if(!tokenValid(body.token))return reply({ok:false},404);
      const {data:screen,error}=await db.from('cafe_pickup_screens')
        .select('location_id,account:cafe_web_accounts!inner(active,actor:telegram_users!inner(is_active))')
        .eq('token_hash',await sha256(body.token)).eq('account.active',true).eq('account.actor.is_active',true).maybeSingle();
      if(error)throw error;
      if(!screen)return reply({ok:false},404);
      const {data:events,error:eventsError}=await db.from('cafe_order_events')
        .select('id,order:cafe_orders!inner(order_number)')
        .eq('note','counter_pickup_call').eq('to_status','completed')
        .gt('created_at',new Date(Date.now()-callWindowMs).toISOString())
        .eq('order.location_id',screen.location_id).eq('order.source_module','cafe')
        .eq('order.status','completed').eq('order.payment_status','paid')
        .in('order.order_type',['pickup','dine_in'])
        .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(60);
      if(eventsError)throw eventsError;
      return reply({ok:true,calls:(events??[]).map((event:{id:string;order:{order_number:number}})=>({
        id:event.id,number:event.order.order_number
      }))});
    }

    if(!['pair','revoke'].includes(body.action)||!uuidValid(body.locationId)||
       (body.action==='revoke'&&!tokenValid(body.token)))return reply({ok:false,error:'Проверьте настройки табло.'},400);
    let actorId;
    try{actorId=await verifyWebStaffSession(db,String(body.initData||''));}
    catch{return reply({ok:false,error:'Войдите в рабочее приложение.'},401);}
    if(body.action==='revoke'){
      const {error}=await db.from('cafe_pickup_screens').delete().eq('actor_id',actorId)
        .eq('location_id',body.locationId).eq('token_hash',await sha256(body.token));
      if(error)throw error;
      return reply({ok:true});
    }

    const {data:actor,error:actorError}=await db.from('telegram_users').select('role')
      .eq('telegram_id',actorId).eq('is_active',true).maybeSingle();
    if(actorError)throw actorError;
    if(actor?.role!=='super_admin'){
      const {data:staff,error}=await db.from('cafe_staff').select('staff_role').eq('telegram_id',actorId)
        .eq('location_id',body.locationId).eq('is_active',true).eq('can_accept_payments',true)
        .in('staff_role',['cashier','manager','kitchen']).limit(1).maybeSingle();
      if(error)throw error;
      if(!staff)return reply({ok:false,error:'Нет доступа к стойке этого кафе.'},403);
    }
    const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),value=>value.toString(16).padStart(2,'0')).join('');
    const {error}=await db.from('cafe_pickup_screens').upsert({
      actor_id:actorId,location_id:body.locationId,token_hash:await sha256(token)
    },{onConflict:'actor_id,location_id'});
    if(error)throw error;
    return reply({ok:true,token});
  }catch{
    console.error('Pickup board request failed');
    return reply({ok:false,error:'Не удалось обновить табло. Попробуйте ещё раз.'},500);
  }
});
