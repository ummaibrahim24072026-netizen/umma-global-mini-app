import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
function reply(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}})}
async function hmac(key:CryptoKey,value:string){return crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value))}
function hex(b:ArrayBuffer){return Array.from(new Uint8Array(b)).map(v=>v.toString(16).padStart(2,"0")).join("")}
async function verify(initData:string,token:string):Promise<number>{
 const p=new URLSearchParams(initData),hash=p.get("hash");if(!hash||!/^[a-f0-9]{64}$/i.test(hash))throw new Error("Invalid Telegram signature");p.delete("hash");
 const authDate=Number(p.get("auth_date")),now=Math.floor(Date.now()/1000);if(!Number.isSafeInteger(authDate)||authDate>now+30||now-authDate>86400)throw new Error("Telegram data expired");
 const check=Array.from(p.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+"="+v).join("\n"),enc=new TextEncoder();
 const k1=await crypto.subtle.importKey("raw",enc.encode("WebAppData"),{name:"HMAC",hash:"SHA-256"},false,["sign"]),secret=await hmac(k1,token),k2=await crypto.subtle.importKey("raw",secret,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const actual=enc.encode(hex(await hmac(k2,check))),expected=enc.encode(hash.toLowerCase());let diff=actual.length^expected.length;for(let i=0;i<Math.min(actual.length,expected.length);i++)diff|=actual[i]^expected[i];if(diff)throw new Error("Invalid Telegram signature");
 const raw=p.get("user");if(!raw)throw new Error("Telegram user missing");const user=JSON.parse(raw);if(!Number.isSafeInteger(user.id)||user.id<=0)throw new Error("Invalid Telegram user");return user.id;
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method!=="POST")return reply({ok:false,error:"Method not allowed"},405);
 try{
  const body=await req.json();if(typeof body?.initData!=="string"||!body.initData)return reply({ok:false,error:"Откройте приложение через Telegram"},400);
  const token=Deno.env.get("TELEGRAM_BOT_TOKEN"),url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!token||!url||!key)return reply({ok:false,error:"Server configuration error"},500);
  const actorId=await verify(body.initData,token),db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:actor,error:ae}=await db.from("telegram_users").select("role,is_active").eq("telegram_id",actorId).maybeSingle();
  if(ae)return reply({ok:false,error:"Не удалось проверить права"},500);if(!actor||!actor.is_active||actor.role!=="super_admin")return reply({ok:false,error:"Управлять картой и добавлять локации может только суперадминистратор"},403);
  if(body.action==="list"){
   const [{data:locations,error:le},{data:managers,error:me},{data:users,error:ue}]=await Promise.all([
    db.from("locations").select("id,name,location_type,address,city,country,latitude,longitude,phone,is_active,delivery_zone,created_at,updated_at").order("created_at",{ascending:false}),
    db.from("cafe_staff").select("id,telegram_id,location_id,staff_role,is_active").eq("staff_role","manager").eq("is_active",true),
    db.from("telegram_users").select("telegram_id,first_name,last_name,username,role,is_active").eq("is_active",true).neq("role","super_admin").order("created_at",{ascending:false}).limit(500)
   ]);
   if(le||me||ue)return reply({ok:false,error:"Не удалось загрузить локации и администраторов"},500);
   return reply({ok:true,locations:locations??[],managers:managers??[],users:users??[]});
  }
  if(body.action==="deliveryZone"){
   if(typeof body.id!=="string"||!/^[0-9a-f-]{36}$/i.test(body.id))return reply({ok:false,error:"Выберите кафе"},400);
   const {data,error}=await db.rpc("admin_set_cafe_delivery_zone",{p_actor:actorId,p_location:body.id,p_zone:body.zone??null});
   if(error)return reply({ok:false,error:/Invalid delivery zone/.test(error.message)?"Зона должна иметь от 3 до 100 точек без пересечений.":"Не удалось сохранить зону доставки"},400);
   return reply({ok:true,zone:data});
  }
  if(body.action==="save"){
   const lat=body.latitude===""||body.latitude==null?null:Number(body.latitude),lng=body.longitude===""||body.longitude==null?null:Number(body.longitude);
   if(typeof body.name!=="string"||body.name.trim().length<2||body.name.trim().length>160)return reply({ok:false,error:"Укажите название локации"},400);
   if(lat===null||lng===null||!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat>90||lng < -180||lng>180)return reply({ok:false,error:"Поставьте точку на карте"},400);
   const args={p_actor_telegram_id:actorId,p_location_id:typeof body.id==="string"&&body.id?body.id:null,p_name:body.name.trim(),p_location_type:body.location_type,p_address:String(body.address??"").trim()||null,p_city:String(body.city??"").trim()||null,p_country:String(body.country??"Vietnam").trim()||"Vietnam",p_latitude:lat,p_longitude:lng,p_phone:String(body.phone??"").trim()||null,p_is_active:body.is_active!==false,p_manager_telegram_id:body.manager_telegram_id?Number(body.manager_telegram_id):null};
   const {data,error}=await db.rpc("admin_upsert_location",args);
   if(error){console.error("Location save failed",error.message);const m=error.message||"";return reply({ok:false,error:/administrator|administrator|address|city|map|location name|Invalid location type/i.test(m)?m:"Не удалось сохранить локацию"},400);}
   return reply(data??{ok:true});
  }
  return reply({ok:false,error:"Неизвестное действие"},400);
 }catch(e){const m=e instanceof Error?e.message:"Request failed";return reply({ok:false,error:/Telegram|signature/i.test(m)?"Не удалось проверить Telegram":"Некорректный запрос"},/Telegram|signature/i.test(m)?401:400)}
});
