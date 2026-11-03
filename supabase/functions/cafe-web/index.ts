import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.99.1';
import {sha256,verifyWebStaffSession} from '../_shared/web-staff-auth.ts';
import {verifyTelegramInitData} from '../cafe-kiosk/auth.ts';
import {paymentFor} from '../cafe-my-orders/payment.ts';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
const validSecret=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
async function password(value:string,salt:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(value),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:600000,hash:'SHA-256'},key,256)),v=>v.toString(16).padStart(2,'0')).join('');}
function same(a:string,b:string){let diff=a.length^b.length;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^(b.charCodeAt(i)||0);return diff===0;}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return reply({ok:false},405);
 try{
 const raw=await req.text();if(raw.length>16000)return reply({ok:false},413);const b=JSON.parse(raw);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 async function session(actor:number){const token=secret();const {error}=await db.from('cafe_web_sessions').insert({token_hash:await sha256(token),actor_id:actor});if(error)throw error;return token;}
 if(['login','activate'].includes(b.action)){
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const login=String(b.login||'').trim().toLowerCase();
  if(!(/^[a-z0-9_.-]{3,60}$/.test(login)||(/^[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(login)&&login.length<=254)))return reply({ok:false,error:'Укажите email или логин: 3–60 латинских букв, цифр, точек, дефисов или подчёркиваний.'},400);
  if(typeof b.password!=='string'||b.password.length<10||b.password.length>128)return reply({ok:false,error:'Пароль должен содержать от 10 до 128 символов.'},400);
  for(const identity of ['ip:'+ip,'login:'+login]){const {data,error}=await db.rpc('cafe_web_rate_allow',{p_identity:await sha256(identity)});if(error)throw error;if(!data)return reply({ok:false,error:'Слишком много попыток. Повторите через 15 минут.'},429);}
  let actor;
  if(b.action==='activate'){
   if(!validSecret(b.invite))return reply({ok:false,error:'Недействительная ссылка приглашения'},400);
   const salt=secret(),hash=await password(b.password,salt);
   const {data,error}=await db.rpc('cafe_web_activate',{p_token:await sha256(b.invite),p_login:login,p_hash:hash,p_salt:salt});
   if(error)return reply({ok:false,error:'Приглашение истекло, уже использовано или логин занят.'},400);actor=data;
  }else{
   const {data:a,error}=await db.from('cafe_web_accounts').select('actor_id,salt,password_hash,active').eq('login',login).maybeSingle();if(error)throw error;
   const hash=await password(b.password,a?.salt||'dummy-constant-salt-for-unknown-account');
   if(!a?.active||!same(hash,a.password_hash))return reply({ok:false,error:'Неверный логин или пароль'},401);actor=a.actor_id;
   const {data:u}=await db.from('telegram_users').select('is_active').eq('telegram_id',actor).maybeSingle();if(!u?.is_active)return reply({ok:false,error:'Доступ отключён'},403);
  }
  return reply({ok:true,token:await session(Number(actor))});
 }
 if(b.action==='screenPoll'){
  if(!validSecret(b.screenToken))return reply({ok:false},404);
  const {data:s,error}=await db.from('cafe_payment_screens').select('order_id,location_id').eq('token_hash',await sha256(b.screenToken)).eq('active',true).maybeSingle();if(error)throw error;if(!s)return reply({ok:false},404);
  if(!s.order_id)return reply({ok:true,order:null});
  const {data:o,error:oe}=await db.from('cafe_orders').select('id,location_id,order_number,total_vnd,currency,payment_method,payment_status,status').eq('id',s.order_id).eq('location_id',s.location_id).maybeSingle();if(oe)throw oe;
  return reply({ok:true,order:o?{number:o.order_number,total:o.total_vnd,paymentStatus:o.payment_status,status:o.status,method:o.payment_method}:null,payment:o?paymentFor(o):null});
 }
 // A signed Telegram owner can create an invitation once; all routine work uses web sessions.
 let actor:number;
 if(b.action==='inviteExisting'&&typeof b.initData==='string'&&!b.initData.startsWith('web:'))actor=await verifyTelegramInitData(b.initData,Deno.env.get('TELEGRAM_BOT_TOKEN')!);
 else actor=await verifyWebStaffSession(db,String(b.initData||''));
 const {data:u,error:ue}=await db.from('telegram_users').select('telegram_id,first_name,role,is_active').eq('telegram_id',actor).maybeSingle();if(ue)throw ue;if(!u?.is_active)return reply({ok:false,error:'Доступ отключён'},403);
 const {data:assignments,error:ae}=await db.from('cafe_staff').select('location_id,staff_role,can_accept_payments').eq('telegram_id',actor).eq('is_active',true);if(ae)throw ae;
 const isOwner=u.role==='super_admin';
 if(!isOwner&&(!['employee','admin'].includes(u.role)||!assignments?.length))return reply({ok:false,error:'Нет назначений в кафе'},403);
 const canSell=(id:string)=>isOwner||assignments?.some(a=>a.location_id===id&&['cashier','manager'].includes(a.staff_role)&&a.can_accept_payments);
 if(b.action==='me'){
  let q=db.from('locations').select('id,name,location_type,is_active,address,latitude,longitude').eq('location_type','cafe').eq('is_active',true);if(!isOwner)q=q.in('id',(assignments||[]).map(a=>a.location_id));const {data:locations,error}=await q;if(error)throw error;
  return reply({ok:true,user:{id:actor,name:u.first_name,role:u.role},assignments,locations});
 }
 if(b.action==='logout'){await db.from('cafe_web_sessions').update({revoked_at:new Date().toISOString()}).eq('token_hash',await sha256(String(b.initData).slice(4)));return reply({ok:true});}
 if(b.action==='inviteExisting'){
  if(!isOwner)return reply({ok:false,error:'Только владелец'},403);const target=Number(b.actorId||actor);
  const {data:targetUser}=await db.from('telegram_users').select('telegram_id').eq('telegram_id',target).eq('is_active',true).maybeSingle();if(!targetUser)return reply({ok:false,error:'Сотрудник не найден'},404);
  const token=secret();const {error}=await db.from('cafe_web_invites').insert({token_hash:await sha256(token),actor_id:target});if(error)throw error;return reply({ok:true,invite:token});
 }
 if(b.action==='inviteStaff'){
  if(!isOwner)return reply({ok:false,error:'Только владелец'},403);if(typeof b.name!=='string'||!b.name.trim())return reply({ok:false,error:'Укажите имя'},400);
  const token=secret();const {data,error}=await db.rpc('cafe_web_invite_staff',{p_actor:actor,p_location:b.locationId,p_role:b.role,p_name:b.name.trim(),p_token:await sha256(token)});if(error)return reply({ok:false,error:'Проверьте кафе и должность'},400);return reply({ok:true,invite:token,actorId:data});
 }
 if(b.action==='staffList'){
  if(!isOwner)return reply({ok:false},403);
  const {data:accounts}=await db.from('cafe_web_accounts').select('actor_id,login,active');return reply({ok:true,accounts:accounts||[]});
 }
 if(b.action==='staffDisable'){
  if(!isOwner||Number(b.actorId)===actor)return reply({ok:false},403);
  const {error}=await db.from('cafe_web_accounts').update({active:false}).eq('actor_id',b.actorId);if(error)throw error;
  await db.from('cafe_web_sessions').update({revoked_at:new Date().toISOString()}).eq('actor_id',b.actorId);await db.from('cafe_payment_screens').update({active:false}).eq('actor_id',b.actorId);return reply({ok:true});
 }
 if(b.action==='screenCreate'){
  if(!canSell(b.locationId))return reply({ok:false,error:'Нет доступа к кассе'},403);const token=secret();
  const {data,error}=await db.from('cafe_payment_screens').insert({token_hash:await sha256(token),actor_id:actor,location_id:b.locationId}).select('id').single();if(error)throw error;
  return reply({ok:true,id:data.id,screenToken:token});
 }
 if(['screenSelect','screenRevoke'].includes(b.action)){
  const {data:s,error}=await db.from('cafe_payment_screens').select('id,actor_id,location_id').eq('id',b.screenId).eq('active',true).maybeSingle();if(error)throw error;
  if(!s||(!isOwner&&Number(s.actor_id)!==actor)||!canSell(s.location_id))return reply({ok:false,error:'Нет доступа к экрану'},403);
  if(b.action==='screenRevoke'){const {error:e}=await db.from('cafe_payment_screens').update({active:false}).eq('id',s.id);if(e)throw e;return reply({ok:true});}
  if(b.orderId){const {data:o}=await db.from('cafe_orders').select('id').eq('id',b.orderId).eq('location_id',s.location_id).maybeSingle();if(!o)return reply({ok:false,error:'Заказ другого кафе'},403);}
  const {error:e}=await db.from('cafe_payment_screens').update({order_id:b.orderId||null,updated_at:new Date().toISOString()}).eq('id',s.id);if(e)throw e;return reply({ok:true});
 }
 if(b.action==='payment'){
  const {data:o,error}=await db.from('cafe_orders').select('id,location_id,order_number,total_vnd,currency,payment_method,payment_status,status').eq('id',b.orderId).maybeSingle();if(error)throw error;if(!o||!canSell(o.location_id))return reply({ok:false},403);return reply({ok:true,payment:paymentFor(o)});
 }
 return reply({ok:false,error:'Неизвестное действие'},400);
 }catch(e){const auth=/Web (session|access)|Telegram|signature/i.test(String(e));console.error('Cafe web request failed',auth?'unauthorized':'internal error');return reply({ok:false,error:auth?'Войдите в рабочее приложение':'Не удалось выполнить действие. Повторите запрос.'},auth?401:500);}
});
