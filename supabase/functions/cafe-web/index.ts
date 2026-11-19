import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.99.1';
import {sha256,verifyWebStaffSession} from '../_shared/web-staff-auth.ts';
import {verifyTelegramInitData} from '../cafe-kiosk/auth.ts';
import {paymentFor} from '../cafe-my-orders/payment.ts';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
const validSecret=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const screenMethods=new Set(['cash','qr','rub','tenge','kaspi','sber','usdt']);
type ScreenLine={name:string,quantity:number,unitPrice:number};
function screenDraft(value:unknown,method:unknown){
 if(!Array.isArray(value)||value.length>99||(method!==null&&(typeof method!=='string'||!screenMethods.has(method))))return undefined;
 const lines:ScreenLine[]=[];
 for(const line of value){
  if(typeof line?.name!=='string'||!line.name.trim()||line.name.length>160||
     !Number.isInteger(line.quantity)||line.quantity<1||line.quantity>99||
     !Number.isSafeInteger(line.unitPrice)||line.unitPrice<=0||line.unitPrice>100000000)return undefined;
  lines.push({name:line.name.trim(),quantity:line.quantity,unitPrice:line.unitPrice});
 }
 return lines.length?{lines,method,total:lines.reduce((sum,line)=>sum+line.quantity*line.unitPrice,0)}:null;
}
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
  const {data:s,error}=await db.from('cafe_payment_screens').select('id,order_id,location_id,draft,updated_at')
   .eq('token_hash',await sha256(b.screenToken)).eq('active',true).maybeSingle();
  if(error)throw error;
  if(!s)return reply({ok:false},404);
  if(!s.order_id){
   const draft=Date.now()-Date.parse(s.updated_at)<30*60*1000?s.draft:null;
   return reply({ok:true,order:null,draft});
  }
  const {data:o,error:oe}=await db.from('cafe_orders')
   .select('id,location_id,order_number,total_vnd,currency,payment_method,payment_status,status,cafe_order_items(id,product_name_ru,quantity,unit_price_vnd)')
   .eq('id',s.order_id).eq('location_id',s.location_id).order('id',{referencedTable:'cafe_order_items',ascending:true}).maybeSingle();
  if(oe)throw oe;
  if(!o)return reply({ok:true,order:null});
  let method=o.payment_method,foreignTotal=null;
  if(method==='bank_transfer'){
   const {data:foreign,error:foreignError}=await db.rpc('cafe_screen_payment_amount',{p_screen_id:s.id,p_order_id:o.id});
   if(foreignError)throw foreignError;
   if(foreign){
    method=foreign.channel;
    foreignTotal={amount:foreign.amount,currency:foreign.currency};
   }
  }
  const lines=(o.cafe_order_items??[]).map(line=>({name:line.product_name_ru,quantity:line.quantity,unitPrice:line.unit_price_vnd}));
  return reply({ok:true,order:{number:o.order_number,total:o.total_vnd,paymentStatus:o.payment_status,status:o.status,method,lines,foreignTotal},
   payment:paymentFor(o)});
 }
 // A signed Telegram owner can create an invitation once; all routine work uses web sessions.
 let actor:number;
 if(['inviteExisting','stockList','stockAdjust','stockPlan'].includes(b.action)&&typeof b.initData==='string'&&!b.initData.startsWith('web:'))actor=await verifyTelegramInitData(b.initData,Deno.env.get('TELEGRAM_BOT_TOKEN')!);
 else actor=await verifyWebStaffSession(db,String(b.initData||''));
 const {data:u,error:ue}=await db.from('telegram_users').select('telegram_id,first_name,role,is_active').eq('telegram_id',actor).maybeSingle();if(ue)throw ue;if(!u?.is_active)return reply({ok:false,error:'Доступ отключён'},403);
 const {data:assignments,error:ae}=await db.from('cafe_staff').select('location_id,staff_role,can_accept_payments').eq('telegram_id',actor).eq('is_active',true);if(ae)throw ae;
 const isOwner=u.role==='super_admin';
 if(!isOwner&&(!['employee','admin'].includes(u.role)||!assignments?.length))return reply({ok:false,error:'Нет назначений в кафе'},403);
 const canSell=(id:string)=>isOwner||assignments?.some(a=>a.location_id===id&&['cashier','manager','kitchen'].includes(a.staff_role)&&a.can_accept_payments);
 if(['stockList','stockAdjust','stockPlan'].includes(b.action)){
  const canRead=isOwner||assignments?.some(a=>a.location_id===b.locationId&&['kitchen','manager','cashier'].includes(a.staff_role));
  const canEdit=isOwner||assignments?.some(a=>a.location_id===b.locationId&&['kitchen','manager'].includes(a.staff_role));
  if(!canRead||b.action!=='stockList'&&!canEdit)return reply({ok:false,error:'Нет прав на изменение наличия'},403);
  const name=b.action==='stockList'?'cafe_ready_list':b.action==='stockPlan'?'cafe_ready_plan':'cafe_ready_adjust';
  const {data,error}=await db.rpc(name,{p_actor:actor,p_location:b.locationId,...(b.action!=='stockList'?{p_key:b.requestKey,p_items:b.items,...(b.action==='stockPlan'?{p_action:b.mode}:{p_mode:b.mode})}:{})});
  if(error)return reply({ok:false,error:/меньше резерва|^План |^Партия |^Укажите |^Время готовности|^Выберите /.test(error.message)?error.message:'Не удалось сохранить наличие. Проверьте количество и повторите.'},400);return reply(data);
 }
 if(['ingredientList','ingredientReceive'].includes(b.action)){
  const name=b.action==='ingredientList'?'cafe_ingredients_list':'cafe_ingredients_receive';
  const {data,error}=await db.rpc(name,{p_actor:actor,p_location:b.locationId,p_day:b.date,...(b.action==='ingredientReceive'?{p_key:b.requestKey,p_supplier:b.supplier||'',p_items:b.items}:{})});
  if(error)return reply({ok:false,error:/access denied/i.test(error.message)?'Нет доступа к ингредиентам':/^(Проверьте|Укажите)/.test(error.message)?error.message:'Не удалось сохранить закупку. Проверьте данные и повторите.'},/access denied/i.test(error.message)?403:error.code==='P0001'||error.code?.startsWith('22')?400:503);return reply(data);
 }
 if(b.action==='managerOverview'){
  const locationId=b.locationId;
  if(typeof locationId!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(locationId))return reply({ok:false,error:'Выберите кафе'},400);
  if(!isOwner&&!assignments?.some(a=>a.location_id===locationId&&a.staff_role==='manager'))return reply({ok:false,error:'Нет доступа к сводке этого кафе'},403);
  const {data:location,error:locationError}=await db.from('locations').select('id,ready_stock_enabled')
    .eq('id',locationId).eq('location_type','cafe').eq('is_active',true).maybeSingle();
  if(locationError)throw locationError;
  if(!location)return reply({ok:false,error:'Кафе недоступно'},404);

  // Nha Trang is UTC+7 year-round. Terminal counts follow the calendar day at the cafe.
  const now=Date.now();
  const offset=7*60*60*1000;
  const dayStart=new Date(Math.floor((now+offset)/86400000)*86400000-offset).toISOString();
  const orders=()=>db.from('cafe_orders').select('id',{head:true,count:'exact'}).eq('location_id',locationId).eq('source_module','cafe');
  const active=()=>orders().not('status','in','(completed,cancelled)');
  const counts={
   new:orders().in('status',['pending','confirmed']).or('requires_prepayment.eq.false,payment_status.eq.paid').eq('preorder_waiting',false),
   payment:active().eq('payment_status','pending').or('payment_timing.is.null,payment_timing.neq.on_delivery'),
   preparing:orders().eq('status','preparing'),
   ready:orders().eq('status','ready').neq('delivery_status','picked_up'),
   delivery:active().eq('delivery_status','picked_up'),
   completed:orders().eq('status','completed').gte('completed_at',dayStart),
   cancelled:orders().eq('status','cancelled').gte('cancelled_at',dayStart)
  };
  const [totals,cash,stock]=await Promise.all([
   Promise.all(Object.entries(counts).map(async ([key,request])=>{
    const {count,error}=await request;if(error||count===null)throw error??Error('Missing order count');
    return [key,count];
   })),
   db.rpc('get_cafe_cash_summary',{p_location_id:locationId}),
   location.ready_stock_enabled?db.rpc('cafe_ready_list',{p_actor:actor,p_location:locationId}):Promise.resolve({data:null,error:null})
  ]);
  if(cash.error)throw cash.error;
  if(stock.error)throw stock.error;
  const soldOut=stock.data?.products?.filter((p:{confirmed:boolean;state:string;available:number})=>p.confirmed&&p.state!=='paused'&&p.available===0)
    .map((p:{name:string})=>p.name)??[];
  return reply({ok:true,metrics:{...Object.fromEntries(totals),revenue:cash.data?.total24hVnd??null},soldOut});
 }
 if(b.action==='staffRoleUpdate'){
  if(!isOwner)return reply({ok:false,error:'Только владелец'},403);
  const {data,error}=await db.rpc('cafe_web_change_staff_role',{p_actor:actor,p_target:b.actorId,p_location:b.locationId,p_role:b.role});if(error)return reply({ok:false,error:/^(Сначала|Сотрудник|Укажите)/.test(error.message)?error.message:'Не удалось изменить роль'},400);return reply(data);
 }
 if(b.action==='me'){
  let q=db.from('locations').select('id,name,location_type,is_active,address,latitude,longitude,ready_stock_enabled').eq('location_type','cafe').eq('is_active',true);if(!isOwner)q=q.in('id',(assignments||[]).map(a=>a.location_id));const {data:locations,error}=await q;if(error)throw error;
  const {data:settings}=await db.from('umma_runtime_settings').select('cafe_reset_epoch').eq('id',true).maybeSingle();return reply({ok:true,cafeResetEpoch:settings?.cafe_reset_epoch,user:{id:actor,name:u.first_name,role:u.role},assignments,locations});
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
 if(b.action==='managerRoster'){
  const managerLocations=(assignments??[]).filter(a=>a.staff_role==='manager').map(a=>a.location_id);
  if(!managerLocations.length)return reply({ok:false,error:'Доступ к сотрудникам только своего кафе'},403);
  const [locations,roster]=await Promise.all([
   db.from('locations').select('id,name').in('id',managerLocations).eq('location_type','cafe').eq('is_active',true),
   db.from('cafe_staff').select('telegram_id,location_id,staff_role,can_accept_payments').in('location_id',managerLocations).eq('is_active',true)
  ]);
  if(locations.error)throw locations.error;
  if(roster.error)throw roster.error;
  const activeLocations=new Map((locations.data??[]).map(l=>[l.id,l.name]));
  const staff=(roster.data??[]).filter(s=>activeLocations.has(s.location_id));
  if(!staff.length)return reply({ok:true,employees:[]});
  const ids=[...new Set(staff.map(s=>s.telegram_id))];
  const {data:users,error}=await db.from('telegram_users').select('telegram_id,first_name,last_name,is_active').in('telegram_id',ids);
  if(error)throw error;
  const employees=(users??[]).map(user=>({
   name:[user.first_name,user.last_name].filter(Boolean).join(' ')||'Сотрудник',
   active:user.is_active,
   assignments:staff.filter(s=>s.telegram_id===user.telegram_id).map(s=>({
    staff_role:s.staff_role,can_accept_payments:s.can_accept_payments,locationName:activeLocations.get(s.location_id)
   }))
  }));
  return reply({ok:true,employees});
 }
 if(b.action==='staffList'){
  if(!isOwner)return reply({ok:false},403);
  const initial=await Promise.all([db.from('cafe_web_accounts').select('actor_id,login,active'),db.from('cafe_staff').select('telegram_id,location_id,staff_role,can_accept_payments').eq('is_active',true)]);for(const r of initial)if(r.error)throw r.error;
  const [accounts,staff]=initial.map(r=>r.data||[]),ids=new Set([...accounts.map(a=>String(a.actor_id)),...staff.map(s=>String(s.telegram_id))]);
  if(!ids.size)return reply({ok:true,accounts,employees:[]});
  const results=await Promise.all([
   db.from('telegram_users').select('telegram_id,first_name,role,is_active').in('telegram_id',[...ids]),
   db.from('locations').select('id,name').in('id',[...new Set(staff.map(s=>s.location_id))]),
   db.from('cafe_web_invites').select('actor_id,expires_at,dismissed_at').in('actor_id',[...ids]).is('used_at',null)
  ]);for(const r of results)if(r.error)throw r.error;
  const [users,locations,invites]=results.map(r=>r.data||[]);
  const employees=[...ids].map(id=>{const account=accounts.find(a=>String(a.actor_id)===id),user=users.find(u=>String(u.telegram_id)===id),assignments=staff.filter(s=>String(s.telegram_id)===id).map(s=>({...s,locationName:locations.find(l=>l.id===s.location_id)?.name||'Кафе'})),pending=invites.filter(i=>String(i.actor_id)===id).sort((a,b)=>Date.parse(b.expires_at)-Date.parse(a.expires_at))[0];
   const status=!user?.is_active||account?.active===false?'disabled':account?.active?'active':pending?(Date.parse(pending.expires_at)>Date.now()?'invited':'expired'):'not_created';
   return {actor_id:Number(id),name:user?.first_name||account?.login||'Сотрудник',login:account?.login||null,assignments,status,inviteExpiresAt:pending?.expires_at||null,dismissed:status==='expired'&&Boolean(pending?.dismissed_at)};});
  return reply({ok:true,accounts,employees:employees.filter(({dismissed})=>!dismissed).map(({dismissed,...employee})=>employee)});
 }
 if(b.action==='staffDismissExpiredInvite'){
  if(!isOwner)return reply({ok:false,error:'Только владелец'},403);
  const target=b.actorId;
  if(!Number.isSafeInteger(target)||target<=0||target===actor)return reply({ok:false,error:'Сотрудник не найден'},400);
  const results=await Promise.all([
   db.from('telegram_users').select('is_active').eq('telegram_id',target).maybeSingle(),
   db.from('cafe_web_accounts').select('actor_id').eq('actor_id',target).maybeSingle(),
   db.from('cafe_web_invites').select('expires_at').eq('actor_id',target).is('used_at',null)
  ]);
  for(const result of results)if(result.error)throw result.error;
  const [user,account,invites]=results;
  const latest=invites.data?.sort((a,b)=>Date.parse(b.expires_at)-Date.parse(a.expires_at))[0];
  const now=new Date();
  if(!user.data?.is_active||account.data||!latest||latest.expires_at!==b.inviteExpiresAt||Date.parse(latest.expires_at)>now.getTime()){
   return reply({ok:false,error:'Статус приглашения изменился. Обновите список сотрудников.'},409);
  }
  const {error}=await db.from('cafe_web_invites').update({dismissed_at:now.toISOString()})
   .eq('actor_id',target).eq('expires_at',latest.expires_at).is('used_at',null).is('dismissed_at',null);
  if(error)throw error;
  return reply({ok:true});
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
 if(['screenSelect','screenRevoke','screenDraft'].includes(b.action)){
  const {data:s,error}=await db.from('cafe_payment_screens').select('id,actor_id,location_id').eq('id',b.screenId).eq('active',true).maybeSingle();if(error)throw error;
  if(!s||(!isOwner&&Number(s.actor_id)!==actor)||!canSell(s.location_id))return reply({ok:false,error:'Нет доступа к экрану'},403);
  if(b.action==='screenRevoke'){const {error:e}=await db.from('cafe_payment_screens').update({active:false}).eq('id',s.id);if(e)throw e;return reply({ok:true});}
  const revision=b.revision;
  if((revision!==undefined||b.action==='screenDraft')&&(!Number.isSafeInteger(revision)||revision<1||revision>Date.now()*1000+300000000)){
   return reply({ok:false,error:'Не удалось обновить данные экрана.'},400);
  }
  const draft=b.action==='screenDraft'?screenDraft(b.lines,b.method):null;
  if(draft===undefined)return reply({ok:false,error:'Неверные данные корзины.'},400);
  const orderId=b.action==='screenSelect'?b.orderId||null:null;
  if(orderId){
   const {data:o}=await db.from('cafe_orders').select('id').eq('id',orderId).eq('location_id',s.location_id).maybeSingle();
   if(!o)return reply({ok:false,error:'Заказ другого кафе'},403);
  }
  let update=db.from('cafe_payment_screens')
   .update({order_id:orderId,draft,updated_at:new Date().toISOString(),...(revision===undefined?{}:{display_revision:revision})})
   .eq('id',s.id).eq('active',true);
  if(revision!==undefined)update=update.lt('display_revision',revision);
  const {error:e}=await update;
  if(e)throw e;
  return reply({ok:true});
 }
 if(b.action==='payment'){
  const {data:o,error}=await db.from('cafe_orders').select('id,location_id,order_number,total_vnd,currency,payment_method,payment_status,status').eq('id',b.orderId).maybeSingle();if(error)throw error;if(!o||!canSell(o.location_id))return reply({ok:false},403);return reply({ok:true,payment:paymentFor(o)});
 }
 return reply({ok:false,error:'Неизвестное действие'},400);
 }catch(e){const auth=/Web (session|access)|Telegram|signature/i.test(String(e));console.error('Cafe web request failed',auth?'unauthorized':'internal error');return reply({ok:false,error:auth?'Войдите в рабочее приложение':'Не удалось выполнить действие. Повторите запрос.'},auth?401:500);}
});
