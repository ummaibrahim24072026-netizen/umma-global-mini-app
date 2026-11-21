import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyWebStaffSession } from "../_shared/web-staff-auth.ts";
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
function response(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"}});}
async function signHmac(key: CryptoKey, value: string): Promise<ArrayBuffer> {
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyTelegramInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) {
    throw new Error("Invalid Telegram signature");
  }
  params.delete("hash");

  const authDate = Number(params.get("auth_date"));
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(authDate) || authDate > now + 30 || now - authDate > 86400) {
    throw new Error("Telegram data expired");
  }

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    "raw", encoder.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const secret = await signHmac(secretKey, botToken);
  const validationKey = await crypto.subtle.importKey(
    "raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const calculated = toHex(await signHmac(validationKey, dataCheckString));
  const actual = encoder.encode(calculated);
  const expected = encoder.encode(receivedHash.toLowerCase());
  let mismatch = actual.length ^ expected.length;
  for (let i = 0; i < Math.min(actual.length, expected.length); i++) mismatch |= actual[i] ^ expected[i];
  if (mismatch !== 0) throw new Error("Telegram signature verification failed");

  const userRaw = params.get("user");
  if (!userRaw) throw new Error("Telegram user is missing");
  let user: { id?: number };
  try {
    user = JSON.parse(userRaw);
  } catch {
    throw new Error("Invalid Telegram user data");
  }
  if (!Number.isSafeInteger(user.id) || !user.id || user.id <= 0) {
    throw new Error("Invalid Telegram user");
  }
  return { telegramId: user.id };
}


Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return response({ok:false,error:"Method not allowed"},405);
 try{
 if(Number(req.headers.get("content-length"))>7250000)return response({ok:false,error:"Файл больше 5 МБ"},413);
 const rawBody=await req.text();
 if(rawBody.length>7250000)return response({ok:false,error:"Файл больше 5 МБ"},413);
 const body=JSON.parse(rawBody);
 const guest=body.action==="guestSubmit"||body.action==="guestMine";
 const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
 if(typeof body.orderId!=="string"||!uuid.test(body.orderId))return response({ok:false,error:"Некорректный заказ"},400);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return response({ok:false,error:"Server configuration error"},500);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 let telegramId:number|null=null;
 if(guest){
  if(typeof body.requestKey!=="string"||!uuid.test(body.requestKey))return response({ok:false,error:"Нет доступа к заказу"},403);
  const {data,error}=await db.rpc("cafe_guest_order_status",{p_request_key:body.requestKey,p_order_id:body.orderId});
  if(error||data?.order?.id!==body.orderId)return response({ok:false,error:"Нет доступа к заказу"},403);
 }else{
  if(typeof body.initData!=="string")return response({ok:false,error:"Требуется вход"},401);
  if(body.action==="list"&&body.initData.startsWith("web:")){
   try{telegramId=await verifyWebStaffSession(db,body.initData);}
   catch{return response({ok:false,error:"Войдите в кабинет сотрудника заново"},401);}
  }else{
   const token=Deno.env.get("TELEGRAM_BOT_TOKEN");
   if(!token)return response({ok:false,error:"Server configuration error"},500);
   telegramId=(await verifyTelegramInitData(body.initData,token)).telegramId;
  }
 }
 const {data:order,error:orderError}=await db.from("cafe_orders").select("id,location_id,customer_telegram_id,created_by_telegram_id,payment_status,payment_method,status,rub_payment_kopecks").eq("id",body.orderId).maybeSingle();
 if(orderError||!order)return response({ok:false,error:"Заказ не найден"},404);
 let guestBankCountry:string|null=null;
 if(guest){
  if(order.customer_telegram_id==null&&order.payment_method==="qr")guestBankCountry="VN";
  if(order.customer_telegram_id==null&&order.payment_method==="bank_transfer"){
   if(order.rub_payment_kopecks!=null)guestBankCountry="RU";
   else{
    const {data,error}=await db.rpc("cafe_guest_checkout_payment",{p_order_id:order.id});
    if(error)return response({ok:false,error:"Не удалось проверить способ оплаты"},500);
    if(data?.currency==="KZT")guestBankCountry="KZ";
    if(data?.currency==="USDT")guestBankCountry="CRYPTO";
   }
  }
  if(!guestBankCountry)return response({ok:false,error:"Нет доступа к заказу"},403);
 }
 const profile=telegramId===null?null:(await db.from("telegram_users").select("role,is_active").eq("telegram_id",telegramId).maybeSingle()).data;
 if(!guest&&!profile?.is_active)return response({ok:false,error:"Профиль отключён или не найден"},403);
 if(body.action==="mine"||body.action==="guestMine"){
   if(!guest&&String(order.customer_telegram_id)!==String(telegramId)&&String(order.created_by_telegram_id)!==String(telegramId))return response({ok:false,error:"Нет доступа к заказу"},403);
   const {data:proofs,error}=await db.from("cafe_transfer_proofs").select("id,created_at,review_status").eq("order_id",order.id).order("created_at",{ascending:false}).limit(10);
   if(error)return response({ok:false,error:"Не удалось проверить отправку чека"},500);
   return response({ok:true,proofs:(proofs??[]).map(proof=>({id:proof.id,createdAt:proof.created_at,status:proof.review_status}))});
 }
 if(body.action==="submit"||body.action==="guestSubmit"){
 if(!guest&&String(order.customer_telegram_id)!==String(telegramId)&&String(order.created_by_telegram_id)!==String(telegramId))return response({ok:false,error:"Нет доступа к заказу"},403);
 if(order.payment_status!=="pending"||["cancelled","completed"].includes(order.status))return response({ok:false,error:"Заказ уже оплачен или закрыт"},409);
 const bankCountry=guest?guestBankCountry:order.payment_method==="qr"?"VN":body.bankCountry;
 if(!guest&&order.payment_method!=="qr"&&!["RU","KZ"].includes(bankCountry))return response({ok:false,error:"Выберите страну банка"},400);
 if(!["bank_transfer","qr"].includes(order.payment_method))return response({ok:false,error:"Для заказа не выбран банковский перевод"},400);
 if(typeof body.base64!=="string"||body.base64.length>7200000||body.base64.length<100)return response({ok:false,error:"Некорректный файл"},400);
 const types:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
 if(guest)types["application/pdf"]="pdf";
 const ext=Object.hasOwn(types,body.mimeType)?types[body.mimeType]:null;
 if(!ext)return response({ok:false,error:guest?"Только PDF, JPG, PNG или WEBP":"Только JPG, PNG или WEBP"},400);
 let raw:string;
 try{raw=atob(body.base64);}catch{return response({ok:false,error:"Некорректный файл"},400);}
 if(raw.length>5242880)return response({ok:false,error:"Файл больше 5 МБ"},400);
 const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
 const valid=ext==="pdf"?raw.startsWith("%PDF-"):ext==="png"?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:ext==="jpg"?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&String.fromCharCode(...bytes.slice(8,12))==="WEBP";
 if(!valid)return response({ok:false,error:"Файл не соответствует формату"},400);
 const digest=toHex(await crypto.subtle.digest("SHA-256",bytes));
 const path=order.id+"/"+digest+"."+ext;
 const existing=await db.from("cafe_transfer_proofs").select("id").eq("order_id",order.id).eq("file_path",path).maybeSingle();
 if(existing.error)return response({ok:false,error:"Не удалось проверить отправку чека"},500);
 if(existing.data)return response({ok:true,proofId:existing.data.id,message:"Этот чек уже отправлен на проверку."});
 if(guest){
   const count=await db.from("cafe_transfer_proofs").select("id").eq("order_id",order.id).is("customer_telegram_id",null).limit(1);
   if(count.error)return response({ok:false,error:"Не удалось проверить отправку чека"},500);
   if(count.data?.length)return response({ok:false,error:"Чек уже прикреплён"},409);
 }
 const upload=await db.storage.from("cafe-transfer-proofs").upload(path,bytes,{contentType:body.mimeType,upsert:false});
 if(upload.error){
   const replay=await db.from("cafe_transfer_proofs").select("id").eq("order_id",order.id).eq("file_path",path).maybeSingle();
   if(replay.data)return response({ok:true,proofId:replay.data.id});
   return response({ok:false,error:"Не удалось загрузить чек. Проверьте ранее отправленные чеки и повторите попытку."},500);
 }
 const inserted=await db.from("cafe_transfer_proofs").insert({order_id:order.id,customer_telegram_id:telegramId,bank_country:bankCountry,file_path:path}).select("id").single();
 if(inserted.error){
   await db.storage.from("cafe-transfer-proofs").remove([path]);
   return guest&&inserted.error.code==="23505"?response({ok:false,error:"Чек уже прикреплён"},409):response({ok:false,error:"Не удалось сохранить чек"},500);
 }
 return response({ok:true,proofId:inserted.data.id,message:"Чек отправлен. Ожидайте подтверждения сотрудником."});
 }
 if(body.action==="list"){
 const actor=profile;
 if(!actor?.is_active||!["super_admin","admin","employee"].includes(actor.role))return response({ok:false,error:"Нет доступа"},403);
 if(actor.role!=="super_admin"){
 const {data:staff}=await db.from("cafe_staff").select("location_id,can_accept_payments").eq("telegram_id",telegramId).eq("location_id",order.location_id).eq("is_active",true).maybeSingle();
 if(!staff?.can_accept_payments)return response({ok:false,error:"Нет прав на проверку оплат"},403);
 }
 const {data:proofs,error}=await db.from("cafe_transfer_proofs").select("id,bank_country,created_at,review_status,file_path").eq("order_id",order.id).order("created_at",{ascending:false}).limit(10);
 if(error)return response({ok:false,error:"Не удалось загрузить чеки"},500);
 const results=[];
 for(const proof of proofs??[]){
   const pdf=proof.file_path.endsWith(".pdf");
   const {data}=await db.storage.from("cafe-transfer-proofs").createSignedUrl(proof.file_path,120,pdf?{download:"receipt.pdf"}:undefined);
   results.push({id:proof.id,bankCountry:proof.bank_country,createdAt:proof.created_at,status:proof.review_status,mimeType:pdf?"application/pdf":null,url:data?.signedUrl??null});
 }
 return response({ok:true,proofs:results});
 }
 return response({ok:false,error:"Неизвестное действие"},400);
 }catch(e){const authError=e instanceof Error&&/Telegram|signature/i.test(e.message);console.error("Transfer proof request failed");return response({ok:false,error:authError?"Не удалось проверить Telegram":"Не удалось обработать запрос"},authError?401:500);}
});
