import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";
import { paymentFor, QR_LOCATION } from "./payment.ts";
import { qrDownloadUrl, qrDownloadResponse } from "./qr-download.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
};
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
async function hmac(key: CryptoKey, value: string): Promise<ArrayBuffer> {
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
}
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(v => v.toString(16).padStart(2, "0")).join("");
}
async function verifyTelegramInitData(initData: string, botToken: string): Promise<number> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) throw new Error("Invalid Telegram signature");
  params.delete("hash");
  const authDate = Number(params.get("auth_date"));
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(authDate) || authDate > now + 30 || now - authDate > 86400) {
    throw new Error("Telegram data expired");
  }
  const check = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => key + "=" + value).join("\n");
  const encoder = new TextEncoder();
  const key1 = await crypto.subtle.importKey("raw", encoder.encode("WebAppData"), { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
  const secret = await hmac(key1, botToken);
  const key2 = await crypto.subtle.importKey("raw", secret, { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
  const actual = encoder.encode(toHex(await hmac(key2, check)));
  const expected = encoder.encode(hash.toLowerCase());
  let mismatch = actual.length ^ expected.length;
  for (let i = 0; i < Math.min(actual.length, expected.length); i++) mismatch |= actual[i] ^ expected[i];
  if (mismatch !== 0) throw new Error("Telegram signature verification failed");
  const rawUser = params.get("user");
  if (!rawUser) throw new Error("Telegram user missing");
  const user = JSON.parse(rawUser);
  if (!Number.isSafeInteger(user.id) || user.id <= 0) throw new Error("Invalid Telegram user");
  return user.id as number;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers:corsHeaders });
  if (req.method === 'GET' || req.method === 'HEAD') {
    const secret=Deno.env.get('TELEGRAM_BOT_TOKEN');
    if(!secret)return response({ok:false,error:'Server configuration error'},500);
    return qrDownloadResponse(req,secret);
  }
  if (req.method !== "POST") return response({ ok:false, error:"Method not allowed" }, 405);
  try {
    const body = await req.json();
    if (typeof body?.initData !== "string" || !body.initData) {
      return response({ ok:false, error:"Откройте приложение через Telegram" }, 400);
    }
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!botToken || !supabaseUrl || !serviceKey) {
      console.error("Customer orders endpoint configuration missing");
      return response({ ok:false, error:"Server configuration error" }, 500);
    }
    const telegramId = await verifyTelegramInitData(body.initData, botToken);
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth:{ persistSession:false, autoRefreshToken:false },
    });
    const { data: user, error: userError } = await supabase
      .from("telegram_users").select("telegram_id,is_active")
      .eq("telegram_id", telegramId).maybeSingle();
    if (userError) {
      console.error("Customer lookup failed", userError.message);
      return response({ ok:false, error:"Не удалось проверить пользователя" }, 500);
    }
    if (!user || user.is_active !== true) return response({ ok:false, error:"Профиль не найден или отключён" }, 403);

    if (body.action === "paymentDetails") {
      if (typeof body.orderId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.orderId)) return response({ok:false,error:"Некорректный заказ"},400);
      const {data:order,error} = await supabase.from("cafe_orders")
        .select("id,order_number,location_id,payment_method,payment_status,status,total_vnd,currency")
        .eq("id",body.orderId).eq("customer_telegram_id",telegramId).maybeSingle();
      if (error) return response({ok:false,error:"Не удалось загрузить оплату"},500);
      const payment = order && paymentFor(order);
      if (!payment) return response({ok:false,error:"QR-оплата недоступна: заказ уже оплачен, отменён или реквизиты этого кафе не настроены."},409);
      return response({ok:true,payment:{...payment,downloadUrl:await qrDownloadUrl(payment,botToken,supabaseUrl)}});
    }
    if(body.action==="notifications"||body.action==="readNotifications"){
      if(body.action==="readNotifications"&&(!Array.isArray(body.ids)||body.ids.length>50||body.ids.some((id:any)=>typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id))))return response({ok:false,error:"Некорректные уведомления"},400);
      const {data,error}=await supabase.rpc(body.action==="notifications"?"get_cafe_notifications":"read_cafe_notifications",body.action==="notifications"?{p_actor:telegramId}:{p_actor:telegramId,p_ids:body.ids});
      if(error)return response({ok:false,error:"Не удалось загрузить уведомления"},500);
      return response(data);
    }
    if(body.action==="deliveryTracking"){
      if(typeof body.orderId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.orderId))return response({ok:false,error:"Некорректный заказ"},400);
      const {data,error}=await supabase.rpc("get_cafe_delivery_tracking",{p_order:body.orderId,p_actor:telegramId});
      if(error)return response({ok:false,error:error.code==="P0001"?"Доставка недоступна":"Не удалось обновить карту"},error.code==="P0001"?403:500);
      return response(data);
    }
    const { data: orders, error } = await supabase
      .from("cafe_orders")
      .select("id,location_id,order_number,order_type,payment_method,payment_status,status,delivery_status,subtotal_vnd,delivery_fee_vnd,discount_vnd,total_vnd,currency,created_at,updated_at,confirmed_at,completed_at,cancelled_at,delivery_address,cafe_order_items(id,product_name_ru,product_name_vi,product_name_en,quantity,unit_price_vnd,line_total_vnd),cafe_order_events(id,from_status,to_status,note,created_at)")
      .eq("customer_telegram_id", telegramId)
      .order("created_at", { ascending:false })
      .limit(25);
    if (error) {
      console.error("Customer orders query failed", error.message);
      return response({ ok:false, error:"Не удалось загрузить ваши заказы" }, 500);
    }
    return response({ ok:true, orders:(orders ?? []).map(order => ({...order,qr_payment_available:order.location_id === QR_LOCATION && !!paymentFor(order)})) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const authError = /Telegram|signature/i.test(message);
    return response({ ok:false, error:authError ? "Не удалось проверить Telegram" : "Некорректный запрос" }, authError ? 401 : 400);
  }
});
