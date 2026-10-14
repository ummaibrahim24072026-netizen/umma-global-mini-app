import { submitCafeOperation } from "../_shared/order-operation.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ ok: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    return response({ok:false,error:"Приём заказов временно приостановлен. Обратитесь к сотруднику кафе."},503);
    if (typeof body?.initData !== "string" || !body.initData) {
      return response({ ok: false, error: "Telegram initData is required" }, 400);
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!botToken || !supabaseUrl || !serviceKey) {
      console.error("Server environment is missing required settings");
      return response({ ok: false, error: "Server configuration error" }, 500);
    }

    const { telegramId } = await verifyTelegramInitData(body.initData, botToken);

    const items = body.items;
    if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
      return response({ ok: false, error: "Order must contain 1–50 items" }, 400);
    }
    for (const item of items) {
      if (
        !item || typeof item !== "object" ||
        typeof item.productId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.productId) ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99
      ) {
        return response({ ok: false, error: "Invalid order item" }, 400);
      }
    }

    const orderType = body.orderType;
    const paymentMethod = body.paymentMethod === "courier" && orderType === "delivery" ? "cash" : (body.paymentMethod ?? "cash");
    const paymentTiming = body.paymentTiming ?? "now";
    if (!["now", "later"].includes(paymentTiming) || (paymentTiming === "later" && orderType !== "dine_in")) {
      return response({ ok: false, error: "Оплата позже разрешена только для заказа в кафе" }, 400);
    }
    if (!["pickup", "delivery", "dine_in"].includes(orderType)) {
      return response({ ok: false, error: "Invalid order type" }, 400);
    }
    if (!["cash", "qr", "bank_transfer", "card"].includes(paymentMethod)) {
      return response({ ok: false, error: "Invalid payment method" }, 400);
    }

    if(typeof body.locationId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.locationId)) {
      return response({ok:false,error:"Выберите кафе для заказа"},400);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (body.staffOrder === true) {
      if (typeof body.locationId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.locationId)) {
        return response({ ok: false, error: "Не выбрано кафе" }, 400);
      }
      const { data: staffData, error: staffError } = await submitCafeOperation(supabase, telegramId, body.requestKey, "staffOrder", {
        p_staff_telegram_id: telegramId,
        p_location_id: body.locationId,
        p_items: items.map((item: { productId: string; quantity: number }) => ({ productId: item.productId, quantity: item.quantity })),
        p_order_type: orderType,
        p_customer_name: typeof body.customerName === "string" ? body.customerName.slice(0, 120) : null,
        p_customer_phone: typeof body.customerPhone === "string" ? body.customerPhone.slice(0, 40) : null,
        p_delivery_address: typeof body.deliveryAddress === "string" ? body.deliveryAddress.slice(0, 500) : null,
        p_payment_method: paymentMethod,
        p_customer_note: typeof body.customerNote === "string" ? body.customerNote.slice(0, 1000) : null,
      });
      if (staffError) {
        if (staffError.code === "23505" && /cafe_one_open_bill_per_numbered_table/.test(staffError.message || "")) {
          return response({ok:false,error:"У этого стола уже есть открытый счёт. Обновите список заказов и добавьте блюда в существующий счёт."},409);
        }
        console.error("Staff order creation rejected:", staffError.message);
        const denied = /Invalid idempotent order request|Idempotency key reused|Staff operation access denied|Order operation access denied|Staff access denied|Staff cannot create orders|Cafe location not found|Invalid order|Delivery address is required|Product not found|Invalid item/.test(staffError.message);
        return response({ ok: false, error: denied ? staffError.message : "Не удалось оформить заказ сотрудником" }, denied ? 403 : 500);
      }
      return response({ ok: true, ...staffData }, 201);
    }

    const { data, error } = await submitCafeOperation(supabase, telegramId, body.requestKey, "customerOrder", {
      p_customer_telegram_id: telegramId,
      p_items: items.map((item: { productId: string; quantity: number }) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      p_order_type: orderType,
      p_location_id: typeof body.locationId === "string" ? body.locationId : null,
      p_customer_name: typeof body.customerName === "string" ? body.customerName.slice(0, 120) : null,
      p_customer_phone: typeof body.customerPhone === "string" ? body.customerPhone.slice(0, 40) : null,
      p_delivery_address: typeof body.deliveryAddress === "string" ? body.deliveryAddress.slice(0, 500) : null,
      p_payment_method: paymentMethod,
      p_customer_note: typeof body.customerNote === "string" ? body.customerNote.slice(0, 1000) : null,
    });

    if (error) {
      console.error("Order creation rejected:", error.message);
      const clientErrors = [
        "Invalid idempotent order request", "Idempotency key reused", "Order operation access denied", "Cafe location is required", "Invalid customer", "Invalid order type", "Invalid payment method",
        "Delivery address is required", "Invalid order items", "Invalid item",
        "Invalid item quantity", "Product not found or unavailable",
        "Cafe location not found or inactive", "Customer is not active or registered",
        "Order has no items", "Товар недоступен в выбранном кафе", "Недостаточно остатка", "Cafe location not found or inactive",
      ];
      const status = clientErrors.some((message) => error.message.includes(message)) ? 400 : 500;
      return response({ ok: false, error: status === 400 ? error.message : "Could not create order" }, status);
    }

    if (data?.replayed) return response({ ok: true, ...data, staffNotified: 0, staffNotificationFailures: 0 }, 200);

    // Notify every active staff member assigned to the cafe that received the order.
    // Notification failures must never roll back an already-created customer order.
    const createdOrder = data?.order;
    let staffNotified = 0;
    let staffNotificationFailures = 0;
    if (createdOrder?.id && typeof body.locationId === "string") {
      try {
        const [{ data: location }, { data: orderItems, error: itemsError }, { data: assignments, error: staffError }] = await Promise.all([
          supabase.from("locations").select("name,address,phone").eq("id", body.locationId).maybeSingle(),
          supabase.from("cafe_order_items").select("product_name_ru,product_name_en,quantity,unit_price_vnd,line_total_vnd").eq("order_id", createdOrder.id),
          supabase.from("cafe_staff").select("telegram_id,staff_role").eq("location_id", body.locationId).eq("is_active", true),
        ]);
        if (itemsError || staffError) throw new Error("Unable to load staff notification data");
        const staffIds = Array.from(new Set((assignments ?? []).map((item: {telegram_id:number|string}) => Number(item.telegram_id)).filter((id:number) => Number.isSafeInteger(id) && id > 0)));
        if (staffIds.length) {
          const { data: activeUsers, error: usersError } = await supabase.from("telegram_users").select("telegram_id,is_active,first_name,last_name,username").in("telegram_id", staffIds).eq("is_active", true);
          if (usersError) throw new Error("Unable to load active staff Telegram profiles");
          const recipients = Array.from(new Set((activeUsers ?? []).map((item: {telegram_id:number|string}) => Number(item.telegram_id))));
          const orderTypeLabels: Record<string,string> = {delivery:"Доставка",pickup:"Самовывоз",dine_in:"В кафе"};
          const paymentLabels: Record<string,string> = {cash:"Наличные",qr:"QR-платёж",bank_transfer:"Банковский перевод",card:"Карта"};
          const itemLines = (orderItems ?? []).map((item: {product_name_ru:string|null;product_name_en:string|null;quantity:number;line_total_vnd:number}) => "• "+(item.product_name_ru||item.product_name_en||"Блюдо")+" × "+item.quantity+" — "+new Intl.NumberFormat("vi-VN").format(Number(item.line_total_vnd)||0)+" ₫");
          const message = [
            "🔔 НОВЫЙ ЗАКАЗ — UMMA CAFE",
            "Кафе: "+(location?.name||"Umma Cafe"),
            "Заказ №"+createdOrder.orderNumber,
            "Тип: "+(orderTypeLabels[orderType]||orderType),
            "Клиент: "+(typeof body.customerName==="string"&&body.customerName.trim()?body.customerName.trim():"Не указано"),
            "Телефон: "+(typeof body.customerPhone==="string"&&body.customerPhone.trim()?body.customerPhone.trim():"Не указан"),
            ...(orderType==="delivery"?["Адрес доставки: "+String(body.deliveryAddress||"Не указан")]:[]),
            "Оплата: "+(paymentLabels[paymentMethod]||paymentMethod),
            "Сумма: "+new Intl.NumberFormat("vi-VN").format(Number(createdOrder.totalVnd)||0)+" ₫",
            "Состав заказа:",
            ...(itemLines.length?itemLines:["• Состав заказа доступен в рабочем месте кафе"]),
            ...(typeof body.customerNote==="string"&&body.customerNote.trim()?["Комментарий: "+body.customerNote.trim().slice(0,700)]:[]),
            "Откройте Umma Global → Кафе → Рабочее место, чтобы принять заказ."
          ].join("\n").slice(0,3900);
          const sends = await Promise.all(recipients.map(async (chatId:number) => {
            try {
              const telegramResponse = await fetch("https://api.telegram.org/bot"+botToken+"/sendMessage", {
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({chat_id:chatId,text:message,disable_web_page_preview:true})
              });
              if (!telegramResponse.ok) {
                const details = await telegramResponse.text();
                console.error("Cafe staff notification failed", chatId, telegramResponse.status, details.slice(0,250));
                return false;
              }
              return true;
            } catch (notificationError) {
              console.error("Cafe staff notification request failed", chatId, notificationError);
              return false;
            }
          }));
          staffNotified = sends.filter(Boolean).length;
          staffNotificationFailures = sends.length - staffNotified;
        }
      } catch (notificationError) {
        staffNotificationFailures += 1;
        console.error("Order created but staff notification preparation failed", notificationError);
      }
    }

    return response({ ok: true, ...data, staffNotified, staffNotificationFailures }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const authError = /Telegram|signature|initData/i.test(message);
    return response(
      { ok: false, error: authError ? "Telegram authentication failed" : "Invalid request" },
      authError ? 401 : 400,
    );
  }
});
