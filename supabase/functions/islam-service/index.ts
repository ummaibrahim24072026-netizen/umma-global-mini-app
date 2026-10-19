import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {verifyTelegramInitData} from './auth.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{...cors,'Cache-Control':'no-store'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({ok:false,error:'Method not allowed'},405);
 try{
  const raw=await req.text();if(raw.length>150000)return reply({ok:false,error:'Request too large'},413);
  const body=JSON.parse(raw),url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),bot=Deno.env.get('TELEGRAM_BOT_TOKEN');
  if(!url||!key||!bot)return reply({ok:false,error:'Server configuration unavailable'},503);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),action=String(body.action||'');
  if(action==='catalog'){
   const [h,l]=await Promise.all([db.from('hadith_records').select('id,collection_id,number,book,edition,narrator,grade,categories,content_revision,hadith_translations(text,language)').eq('status','published').order('number').limit(2000),db.from('prayer_lessons').select('id,slug,category,title,language,content_revision').eq('status','published').order('slug').limit(1000)]);
   if(h.error||l.error)throw h.error||l.error;
   // Exact source wording is loaded only on the detail route. Draft titles never leak.
   return reply({ok:true,hadiths:(h.data||[]).map(x=>({...x,search_text:x.hadith_translations?.map(t=>t.text).join(' ')||''})),lessons:l.data,fetched_at:new Date().toISOString()});
  }
  if(action==='read'){
   const kind=body.kind,id=body.id;if(!['hadith','lesson'].includes(kind)||!uuid.test(id||''))return reply({ok:false,error:'Invalid content'},400);
   const table=kind==='hadith'?'hadith_records':'prayer_lessons';
   const base=await db.from(table).select('*').eq('id',id).eq('status','published').maybeSingle();if(base.error)throw base.error;if(!base.data)return reply({ok:false,error:'Content is unavailable or withdrawn',withdrawn:true},404);
   if(kind==='hadith'){
    const [t,v,c]=await Promise.all([db.from('hadith_translations').select('*').eq('hadith_id',id),db.from('hadith_verifications').select('*').eq('hadith_id',id),db.from('hadith_collections').select('*').eq('id',base.data.collection_id).single()]);
    if(t.error||v.error||c.error)throw t.error||v.error||c.error;
    const still=await db.from(table).select('status,content_revision').eq('id',id).single();if(still.error||still.data.status!=='published'||still.data.content_revision!==base.data.content_revision)return reply({ok:false,error:'Content changed; reload',withdrawn:true},409);
    return reply({ok:true,kind,record:{...base.data,editor_telegram_id:undefined},translations:t.data,verifications:v.data,collection:c.data,fetched_at:new Date().toISOString()});
   }
   const [s,e,f]=await Promise.all([db.from('prayer_lesson_steps').select('*').eq('lesson_id',id).order('position'),db.from('lesson_evidences').select('*').eq('lesson_id',id),db.from('fiqh_topics').select('*').eq('lesson_id',id)]);
   if(s.error||e.error||f.error)throw s.error||e.error||f.error;
   const opinions=f.data?.length?await db.from('fiqh_opinions').select('*').in('topic_id',f.data.map(x=>x.id)):{data:[],error:null};if(opinions.error)throw opinions.error;
   // Repeat publication check after child reads to avoid a withdrawal race.
   const still=await db.from(table).select('status,content_revision').eq('id',id).single();if(still.error||still.data.status!=='published'||still.data.content_revision!==base.data.content_revision)return reply({ok:false,error:'Content changed; reload',withdrawn:true},409);
   return reply({ok:true,kind,record:{...base.data,editor_telegram_id:undefined},steps:s.data,evidences:e.data,topics:f.data,opinions:opinions.data,fetched_at:new Date().toISOString()});
  }
  let actor:number;try{actor=await verifyTelegramInitData(body.initData,bot);}catch{return reply({ok:false,error:'Open the app again through Telegram'},401);}
  const user=await db.from('telegram_users').select('role,is_active').eq('telegram_id',actor).maybeSingle();if(user.error)throw user.error;if(!user.data?.is_active)return reply({ok:false,error:'Account unavailable'},403);
  const editor=await db.from('islam_content_editors').select('can_edit,can_review,name,qualification,identity_source_url').eq('telegram_id',actor).eq('is_active',true).maybeSingle();if(editor.error)throw editor.error;
  const admin=user.data.role==='super_admin',canEdit=admin||editor.data?.can_edit===true,canReview=editor.data?.can_review===true;
  if(action==='state'){
   const [p,b]=await Promise.all([db.from('islam_telegram_preferences').select('enabled,consent_at,language,before_minutes,at_time,prayers,silent,version,last_error,config').eq('telegram_id',actor).maybeSingle(),db.from('islam_telegram_bookmarks').select('kind,content_id,created_at').eq('telegram_id',actor).order('created_at',{ascending:false}).limit(1000)]);
   if(p.error||b.error)throw p.error||b.error;return reply({ok:true,actor,preferences:p.data,bookmarks:b.data,can_edit:canEdit,can_review:canReview,can_publish:admin});
  }
  if(action==='preferences'){
   const o=body.options||{},c=body.config||{};
   if(o.enabled===true){
    if(o.consent!==true)return reply({ok:false,error:'Notification and location consent required'},400);
    if(typeof c.lat!=='number'||!Number.isFinite(c.lat)||Math.abs(c.lat)>90||typeof c.lon!=='number'||!Number.isFinite(c.lon)||Math.abs(c.lon)>180)return reply({ok:false,error:'Invalid location'},400);
    if(!['MuslimWorldLeague','Karachi','Egyptian','NorthAmerica','Singapore'].includes(c.method)||![1,2].includes(c.asr))return reply({ok:false,error:'Invalid method'},400);
    try{new Intl.DateTimeFormat('en',{timeZone:c.zone});}catch{return reply({ok:false,error:'Invalid time zone'},400);}
    if(!c.zone||typeof c.zone!=='string'||!Array.isArray(o.prayers)||!o.prayers.length||o.prayers.some((p:string)=>!['fajr','dhuhr','asr','maghrib','isha'].includes(p))||!Number.isInteger(o.before_minutes)||o.before_minutes<0||o.before_minutes>120||o.before_minutes===0&&o.at_time!==true)return reply({ok:false,error:'Invalid reminders'},400);
    for(const value of Object.values(c.offsets||{}))if(!Number.isInteger(value)||Math.abs(Number(value))>60)return reply({ok:false,error:'Invalid adjustment'},400);
    const chat=await fetch(`https://api.telegram.org/bot${bot}/getChat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:actor}),signal:AbortSignal.timeout(10000)}).then(r=>r.json());
    if(!chat.ok||chat.result?.type!=='private'||chat.result.id!==actor)return reply({ok:false,error:'Start @UmmaGlobalBot, then try again'},400);
   }
   const config=o.enabled===true?{lat:c.lat,lon:c.lon,zone:c.zone,method:c.method,asr:c.asr,city:String(c.city||'').slice(0,80),offsets:c.offsets||{}}:{};
   const saved=await db.rpc('islam_save_preferences',{p_actor:actor,p_config:config,p_options:{...o,language:['ru','en','vi'].includes(o.language)?o.language:'ru'}});if(saved.error)return reply({ok:false,error:saved.error.message},400);
   return reply({ok:true,preferences:{...saved.data,config:undefined,telegram_id:undefined}});
  }
  if(action==='bookmark'){
   if(!['lesson','hadith'].includes(body.kind)||!uuid.test(body.id||'')||typeof body.save!=='boolean')return reply({ok:false,error:'Invalid bookmark'},400);
   if(body.save){const found=await db.from(body.kind==='lesson'?'prayer_lessons':'hadith_records').select('id').eq('id',body.id).eq('status','published').maybeSingle();if(found.error)throw found.error;if(!found.data)return reply({ok:false,error:'Content unavailable'},404);const put=await db.from('islam_telegram_bookmarks').upsert({telegram_id:actor,kind:body.kind,content_id:body.id},{onConflict:'telegram_id,kind,content_id'});if(put.error)throw put.error;}
   else{const del=await db.from('islam_telegram_bookmarks').delete().eq('telegram_id',actor).eq('kind',body.kind).eq('content_id',body.id);if(del.error)throw del.error;}
   return reply({ok:true,saved:body.save});
  }
  if(action==='editor_read'){
   if(!canEdit&&!canReview)return reply({ok:false,error:'Editorial access denied'},403);
   if(!['lesson','hadith'].includes(body.kind)||!uuid.test(body.id||''))return reply({ok:false,error:'Invalid content'},400);
   const record=await db.from(body.kind==='lesson'?'prayer_lessons':'hadith_records').select('*').eq('id',body.id).single();if(record.error)throw record.error;
   const children=body.kind==='lesson'?await Promise.all([db.from('prayer_lesson_steps').select('*').eq('lesson_id',body.id).order('position'),db.from('lesson_evidences').select('*').eq('lesson_id',body.id)]):await Promise.all([db.from('hadith_translations').select('*').eq('hadith_id',body.id),db.from('hadith_verifications').select('*').eq('hadith_id',body.id)]);
   if(children.some(x=>x.error))throw children.find(x=>x.error).error;
   return reply({ok:true,kind:body.kind,record:record.data,...(body.kind==='lesson'?{steps:children[0].data,evidences:children[1].data}:{translations:children[0].data,verifications:children[1].data})});
  }
  if(action==='editor_queue'){
   if(!canEdit&&!canReview)return reply({ok:false,error:'Editorial access denied'},403);
   const [h,l]=await Promise.all([db.from('hadith_records').select('*').neq('status','published').order('created_at',{ascending:false}).limit(200),db.from('prayer_lessons').select('*').neq('status','published').order('created_at',{ascending:false}).limit(200)]);if(h.error||l.error)throw h.error||l.error;
   return reply({ok:true,hadiths:(h.data||[]).map(x=>({...x,search_text:x.hadith_translations?.map(t=>t.text).join(' ')||''})),lessons:l.data,reviewer:canReview?editor.data:null});
  }
  if(['editor_save','editor_submit','editor_review','editor_publish'].includes(action)){
   if(action==='editor_review'?!canReview:action==='editor_publish'?!admin:!canEdit)return reply({ok:false,error:'Editorial access denied'},403);
   const result=await db.rpc('islam_editor_operation',{p_actor:actor,p_action:action,p_kind:body.kind,p_document:body.document||{}});if(result.error)return reply({ok:false,error:result.error.message},400);return reply({ok:true,result:result.data});
  }
  return reply({ok:false,error:'Unknown action'},400);
 }catch{return reply({ok:false,error:'Islam service unavailable; try again'},503);}
});
