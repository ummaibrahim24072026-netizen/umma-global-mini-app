import {dispatchCustomerNotifications} from "../_shared/customer-notifications.ts";
import {dispatchCourierQueue,uploadDeliveryProof} from "../_shared/courier-workflow.ts";
import { sandboxCanAdvance } from "./sandbox-policy.ts";
import { submitCafeOperation } from "../_shared/order-operation.ts";
import { loadCafeOrders } from "./order-list.ts";

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

async function hmac(key: CryptoKey, value: string): Promise<ArrayBuffer> {
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
}
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(v => v.toString(16).padStart(2, "0")).join("");
}

async function verifyInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) throw new Error("Invalid Telegram signature");
  params.delete("hash");

  const authDate = Number(params.get("auth_date"));
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(authDate) || authDate > now + 30 || now - authDate > 86400) {
    throw new Error("Telegram data expired");
  }

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => key + "=" + value)
    .join("\n");
  const encoder = new TextEncoder();
  const key1 = await crypto.subtle.importKey("raw", encoder.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const secret = await hmac(key1, botToken);
  const key2 = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const calculated = toHex(await hmac(key2, dataCheckString));
  const actual = encoder.encode(calculated), expected = encoder.encode(hash.toLowerCase());
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ ok: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    if (typeof body?.initData !== "string" || !body.initData) {
      return response({ ok: false, error: "Откройте приложение через Telegram" }, 400);
    }
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!botToken || !supabaseUrl || !serviceKey) {
      console.error("Cafe kitchen server configuration missing");
      return response({ ok: false, error: "Server configuration error" }, 500);
    }

    const telegramId = await verifyInitData(body.initData, botToken);
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: actor, error: actorError } = await supabase
      .from("telegram_users")
      .select("telegram_id, role, is_active")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (actorError) {
      console.error("Kitchen role lookup failed", actorError.message);
      return response({ ok: false, error: "Authorization check failed" }, 500);
    }
    if (!actor || actor.is_active !== true) {
      return response({ ok: false, error: "Доступ к заказам кухни запрещён" }, 403);
    }

    let assignedLocationIds: string[] = [];
    let assignmentsForResponse: { location_id: string; staff_role: string; can_accept_payments: boolean }[] = [];
    let staffRole = actor.role === "super_admin" ? "manager" : null;

    if (actor.role !== "super_admin") {
      if (!["admin", "employee"].includes(actor.role)) {
        return response({ ok: false, error: "Доступ к заказам кухни запрещён" }, 403);
      }
      const { data: assignments, error: assignmentError } = await supabase
        .from("cafe_staff")
        .select("location_id, staff_role, can_accept_payments")
        .eq("telegram_id", telegramId)
        .eq("is_active", true);

      if (assignmentError) {
        console.error("Cafe staff assignment lookup failed", assignmentError.message);
        return response({ ok: false, error: "Не удалось проверить права сотрудника" }, 500);
      }
      assignmentsForResponse = assignments ?? [];
      assignedLocationIds = assignmentsForResponse.map((item) => item.location_id);
      if (!assignedLocationIds.length) {
        return response({ ok: false, error: "Для вас ещё не назначено кафе" }, 403);
      }
      staffRole = assignments?.[0]?.staff_role ?? null;
    }


    if (body.action === "selfCourier") {
      if (actor.role !== "super_admin") return response({ok:false,error:"Доступ только суперадминистратору"},403);
      if (body.enabled !== undefined) {
        if (typeof body.enabled !== "boolean" || typeof body.locationId !== "string") return response({ok:false,error:"Выберите кафе"},400);
        const {error}=await supabase.rpc("set_cafe_self_courier",{p_actor:telegramId,p_location:body.locationId,p_enabled:body.enabled});
        if(error)return response({ok:false,error:error.message.includes("active deliveries")?"Сначала завершите свои активные доставки":"Не удалось изменить доступность курьера"},400);
      }
      const {data:availability,error}=await supabase.from("cafe_staff").select("location_id,courier_available").eq("telegram_id",telegramId).eq("is_active",true);
      if(error)return response({ok:false,error:"Не удалось загрузить доступность"},500);
      return response({ok:true,availability:availability||[]});
    }
    const courierWorkspace = body.workspace === "courier";
    if (courierWorkspace && actor.role === "super_admin") {
      const {data:assignments,error}=await supabase.from("cafe_staff").select("location_id,staff_role,can_accept_payments,courier_available").eq("telegram_id",telegramId).eq("is_active",true).eq("courier_available",true);
      if(error)return response({ok:false,error:"Не удалось загрузить доступ курьера"},500);
      assignmentsForResponse=assignments||[];assignedLocationIds=assignmentsForResponse.map(item=>item.location_id);staffRole="courier";
    }

    if(body.action==="sandboxBootstrap"){
      if(actor.role!=="super_admin") return response({ok:false,error:"Тестовый режим доступен только суперадминистратору"},403);
      const {data:locations,error}=await supabase.from("locations").select("id,name").eq("location_type","cafe").eq("is_active",true).order("name");
      if(error) return response({ok:false,error:"Не удалось загрузить список кафе"},500);
      return response({ok:true,locations:locations??[],testMode:true});
    }
    const sandboxActions = ["sandboxList","sandboxCreateOrder","sandboxSetStatus","sandboxSetPayment","sandboxSetDelivery","sandboxOpenShift","sandboxCloseShift","sandboxReset"];
    if (sandboxActions.includes(body.action)) {
      if (actor.role !== "super_admin") return response({ok:false,error:"Тестовый режим доступен только суперадминистратору"},403);
      const role = body.testRole;
      const validRoles = ["waiter","cashier","kitchen","manager","courier"];
      if (!validRoles.includes(role)) return response({ok:false,error:"Выберите тестовую должность"},400);
      const locationId = body.locationId;
      if (typeof locationId !== "string" || !/^[0-9a-f-]{36}$/i.test(locationId)) return response({ok:false,error:"Выберите кафе"},400);
      const {data:cafe,error:cafeError}=await supabase.from("locations").select("id,name").eq("id",locationId).eq("location_type","cafe").eq("is_active",true).maybeSingle();
      if(cafeError||!cafe) return response({ok:false,error:"Кафе не найдено или неактивно"},400);
      const writeEvent = async (eventType:string, orderId:string|null=null, payload:Record<string,unknown>={}) => {
        const {error}=await supabase.from("cafe_test_events").insert({order_id:orderId,location_id:locationId,actor_telegram_id:telegramId,simulated_role:role,event_type:eventType,payload});
        if(error) throw error;
      };
      if(body.action==="sandboxList"){
        const [ordersRes,eventsRes,shiftsRes]=await Promise.all([
          supabase.from("cafe_test_orders").select("*").eq("location_id",locationId).order("created_at",{ascending:false}).limit(100),
          supabase.from("cafe_test_events").select("*").eq("location_id",locationId).order("created_at",{ascending:false}).limit(100),
          supabase.from("cafe_test_shifts").select("*").eq("location_id",locationId).eq("actor_telegram_id",telegramId).eq("simulated_role",role).order("opened_at",{ascending:false}).limit(10)
        ]);
        if(ordersRes.error||eventsRes.error||shiftsRes.error) return response({ok:false,error:"Не удалось загрузить тестовые данные"},500);
        return response({ok:true,locationId,cafeName:cafe.name,orders:ordersRes.data??[],events:eventsRes.data??[],shifts:shiftsRes.data??[],testMode:true,simulatedRole:role});
      }
      if(body.action==="sandboxCreateOrder"){
        if(role!=="waiter"&&role!=="manager") return response({ok:false,error:"Создавать тестовый заказ может официант или менеджер"},403);
        if(!Array.isArray(body.items)||body.items.length===0||body.items.length>30) return response({ok:false,error:"Добавьте блюда из меню"},400);
        const requested=new Map<string,number>();
        for(const item of body.items){
          if(typeof item?.productId!=="string"||!/^[0-9a-f-]{36}$/i.test(item.productId)) return response({ok:false,error:"Некорректное блюдо в заказе"},400);
          const quantity=Number(item.quantity);
          if(!Number.isSafeInteger(quantity)||quantity<1||quantity>99) return response({ok:false,error:"Количество блюда должно быть от 1 до 99"},400);
          requested.set(item.productId,(requested.get(item.productId)||0)+quantity);
        }
        const {data:menuProducts,error:menuError}=await supabase.from("products").select("id,name_ru,name_vi,name_en,price_vnd,weight_value,weight_unit").eq("product_type","cafe").eq("is_active",true).in("id",Array.from(requested.keys()));
        if(menuError) return response({ok:false,error:"Не удалось проверить цены меню"},500);
        if(!menuProducts||menuProducts.length!==requested.size) return response({ok:false,error:"Одно из блюд отсутствует в активном меню"},400);
        const items=menuProducts.map(p=>({product_id:p.id,product_name_ru:p.name_ru||p.name_en||p.name_vi||"Блюдо",quantity:requested.get(p.id)!,unit_price_vnd:Number(p.price_vnd),line_total_vnd:Number(p.price_vnd)*requested.get(p.id)!}));
        const total=items.reduce((sum,item)=>sum+item.line_total_vnd,0);
        if(!Number.isSafeInteger(total)||total<=0||total>100000000) return response({ok:false,error:"Сумма заказа некорректна"},400);
        const orderType=["dine_in","pickup","delivery"].includes(body.orderType)?body.orderType:"dine_in";
        const paymentMethod=body.paymentMethod==="qr"?"qr":"cash";
        const {data:order,error}=await supabase.from("cafe_test_orders").insert({location_id:locationId,created_by_telegram_id:telegramId,simulated_role:role,customer_name:typeof body.customerName==="string"?body.customerName.slice(0,120):"Тестовый гость",order_type:orderType,payment_method:paymentMethod,delivery_status:orderType==="delivery"?"waiting_courier":"not_required",total_vnd:total,items,note:typeof body.note==="string"?body.note.slice(0,500):null}).select("*").single();
        if(error) return response({ok:false,error:"Не удалось создать тестовый заказ"},500);
        await writeEvent("order_created",order.id,{total_vnd:total,item_count:items.length,order_type:orderType,payment_method:paymentMethod});
        return response({ok:true,order,testMode:true});
      }
      if(body.action==="sandboxSetStatus"){
        const orderId=body.orderId, status=body.status;
        if(typeof orderId!=="string"||!/^[0-9a-f-]{36}$/i.test(orderId)||!["confirmed","preparing","ready","completed","cancelled"].includes(status)) return response({ok:false,error:"Некорректный заказ или статус"},400);
        const {data:order,error:orderError}=await supabase.from("cafe_test_orders").select("*").eq("id",orderId).eq("location_id",locationId).maybeSingle();
        if(orderError||!order) return response({ok:false,error:"Тестовый заказ не найден"},404);
        const allowed = sandboxCanAdvance(role,order,status);
        if(!allowed) return response({ok:false,error:"Эта должность не может менять данный статус"},403);
        if(status==="completed"&&order.payment_status!=="paid") return response({ok:false,error:"Сначала подтвердите оплату тестового заказа"},400);
        if(status==="completed"&&order.order_type==="delivery"&&order.delivery_status!=="delivered") return response({ok:false,error:"Сначала отметьте доставку как выполненную"},400);
        const {data:updated,error}=await supabase.from("cafe_test_orders").update({status,updated_at:new Date().toISOString()}).eq("id",orderId).eq("status",order.status).eq("payment_status",order.payment_status).select("*").single();
        if(error) return response({ok:false,error:"Не удалось обновить тестовый заказ"},500);
        await writeEvent("status_changed",orderId,{from:order.status,to:status});
        return response({ok:true,order:updated,testMode:true});
      }
      if(body.action==="sandboxSetDelivery"){
        if(!["courier","manager"].includes(role)) return response({ok:false,error:"Доставку может менять курьер или менеджер"},403);
        const orderId=body.orderId, deliveryStatus=body.deliveryStatus;
        if(typeof orderId!=="string"||!/^[0-9a-f-]{36}$/i.test(orderId)||!["courier_assigned","picked_up","delivered"].includes(deliveryStatus)) return response({ok:false,error:"Некорректный заказ или статус доставки"},400);
        const {data:order,error:orderError}=await supabase.from("cafe_test_orders").select("*").eq("id",orderId).eq("location_id",locationId).maybeSingle();
        if(orderError||!order||order.order_type!=="delivery") return response({ok:false,error:"Тестовый заказ доставки не найден"},404);
        const allowed = !["completed","cancelled"].includes(order.status) && ({waiting_courier:"courier_assigned",courier_assigned:"picked_up",picked_up:"delivered"} as Record<string,string>)[order.delivery_status]===deliveryStatus && (deliveryStatus!=="picked_up" || order.status==="ready");
        if(!allowed) return response({ok:false,error:"Недопустимый переход доставки для этой должности"},403);
        const {data:updated,error}=await supabase.from("cafe_test_orders").update({delivery_status:deliveryStatus,updated_at:new Date().toISOString()}).eq("id",orderId).eq("delivery_status",order.delivery_status).eq("status",order.status).select("*").single();
        if(error) return response({ok:false,error:"Не удалось обновить тестовую доставку"},500);
        await writeEvent("delivery_changed",orderId,{from:order.delivery_status,to:deliveryStatus});
        return response({ok:true,order:updated,testMode:true});
      }
      if(body.action==="sandboxSetPayment"){
        if(!["waiter","cashier","kitchen","manager","courier"].includes(role)) return response({ok:false,error:"Выберите роль сотрудника"},403);
        const orderId=body.orderId;
        if(typeof orderId!=="string"||!/^[0-9a-f-]{36}$/i.test(orderId)) return response({ok:false,error:"Некорректный заказ"},400);
        const {data:order,error:orderError}=await supabase.from("cafe_test_orders").select("*").eq("id",orderId).eq("location_id",locationId).maybeSingle();
        if(orderError||!order) return response({ok:false,error:"Тестовый заказ не найден"},404);
        if(["completed","cancelled"].includes(order.status)) return response({ok:false,error:"Закрытый тестовый заказ нельзя оплатить"},400);
        if(order.payment_status==="paid") return response({ok:false,error:"Тестовый заказ уже оплачен"},400);
        const {data:updated,error}=await supabase.from("cafe_test_orders").update({payment_status:"paid",updated_at:new Date().toISOString()}).eq("id",orderId).eq("payment_status","pending").eq("status",order.status).select("*").single();
        if(error) return response({ok:false,error:"Не удалось отметить тестовую оплату"},500);
        await writeEvent("payment_confirmed",orderId,{amount_vnd:order.total_vnd,method:order.payment_method});
        return response({ok:true,order:updated,testMode:true});
      }
      if(body.action==="sandboxOpenShift"){
        if(!["cashier","manager"].includes(role)) return response({ok:false,error:"Открывать тестовую кассовую смену может кассир или менеджер"},403);
        const opening=Number(body.openingCashVnd);
        if(!Number.isSafeInteger(opening)||opening<0) return response({ok:false,error:"Укажите корректную сумму"},400);
        const {data:shift,error}=await supabase.from("cafe_test_shifts").insert({location_id:locationId,actor_telegram_id:telegramId,simulated_role:role,opening_cash_vnd:opening}).select("*").single();
        if(error) return response({ok:false,error:/duplicate|unique/i.test(error.message)?"Тестовая смена этой должности уже открыта":"Не удалось открыть тестовую смену"},400);
        await writeEvent("shift_opened",null,{opening_cash_vnd:opening});
        return response({ok:true,shift,testMode:true});
      }
      if(body.action==="sandboxCloseShift"){
        if(!["cashier","manager"].includes(role)) return response({ok:false,error:"Закрывать тестовую кассовую смену может кассир или менеджер"},403);
        const shiftId=body.shiftId, counted=Number(body.countedCashVnd);
        if(typeof shiftId!=="string"||!/^[0-9a-f-]{36}$/i.test(shiftId)||!Number.isSafeInteger(counted)||counted<0) return response({ok:false,error:"Укажите корректную сумму"},400);
        const {data:shift,error:shiftError}=await supabase.from("cafe_test_shifts").select("*").eq("id",shiftId).eq("location_id",locationId).eq("actor_telegram_id",telegramId).eq("simulated_role",role).eq("shift_status","open").maybeSingle();
        if(shiftError||!shift) return response({ok:false,error:"Открытая тестовая смена не найдена"},404);
        const {data:updated,error}=await supabase.from("cafe_test_shifts").update({counted_cash_vnd:counted,shift_status:"closed",closed_at:new Date().toISOString()}).eq("id",shiftId).select("*").single();
        if(error) return response({ok:false,error:"Не удалось закрыть тестовую смену"},500);
        await writeEvent("shift_closed",null,{opening_cash_vnd:shift.opening_cash_vnd,counted_cash_vnd:counted,variance_vnd:counted-shift.opening_cash_vnd});
        return response({ok:true,shift:updated,varianceVnd:counted-shift.opening_cash_vnd,testMode:true});
      }
      if(body.action==="sandboxReset"){
        if(role!=="manager") return response({ok:false,error:"Сброс тестовых данных доступен в роли менеджера"},403);
        const {error}=await supabase.from("cafe_test_orders").delete().eq("location_id",locationId);
        if(error) return response({ok:false,error:"Не удалось очистить тестовые заказы"},500);
        await supabase.from("cafe_test_events").delete().eq("location_id",locationId);
        await supabase.from("cafe_test_shifts").delete().eq("location_id",locationId).eq("actor_telegram_id",telegramId);
        return response({ok:true,testMode:true});
      }
    }

    if (body.action === "cashList") {
      let locations = assignedLocationIds;
      let cafesForResponse: {id:string;name:string}[] = [];
      if (actor.role === "super_admin") {
        const { data: cafes, error: cafesError } = await supabase.from("locations").select("id,name").eq("location_type","cafe").eq("is_active",true).order("name");
        if (cafesError) return response({ ok:false, error:"Не удалось загрузить кафе" },500);
        cafesForResponse = cafes ?? [];
        locations = cafesForResponse.map((x:any)=>x.id);
      } else {
        const { data: cafes } = await supabase.from("locations").select("id,name").in("id",locations).eq("is_active",true).order("name");
        cafesForResponse = cafes ?? [];
      }
      const locationId = typeof body.locationId === "string" && locations.includes(body.locationId) ? body.locationId : locations[0];
      if (!locationId) return response({ok:false,error:"Не удалось определить кафе"},403);
      const {data:cashSummary,error:cashSummaryError}=await supabase.rpc("get_cafe_cash_summary",{p_location_id:locationId});
      if(cashSummaryError)return response({ok:false,error:"Не удалось загрузить итог кассы"},500);
      const { data: receipts, error: receiptsError } = await supabase.from("cafe_payment_receipts")
        .select("id,order_id,location_id,collected_by_telegram_id,payment_method,amount_vnd,tendered_amount_vnd,change_given_vnd,receipt_status,collected_at,note")
        .eq("location_id",locationId).order("collected_at",{ascending:false}).limit(100);
      if (receiptsError) return response({ok:false,error:"Не удалось загрузить оплаты"},500);
      const receiptUserIds = Array.from(new Set((receipts ?? []).map((x:any)=>Number(x.collected_by_telegram_id)).filter((x:number)=>Number.isSafeInteger(x))));
      const receiptOrderIds = Array.from(new Set((receipts ?? []).map((x:any)=>x.order_id).filter(Boolean)));
      const [{data:receiptUsers,error:receiptUsersError},{data:receiptOrders,error:receiptOrdersError}] = await Promise.all([
        receiptUserIds.length ? supabase.from("telegram_users").select("telegram_id,first_name,last_name,username").in("telegram_id",receiptUserIds) : Promise.resolve({data:[],error:null}),
        receiptOrderIds.length ? supabase.from("cafe_orders").select("id,order_number").in("id",receiptOrderIds) : Promise.resolve({data:[],error:null})
      ]);
      if(receiptUsersError||receiptOrdersError) return response({ok:false,error:"Не удалось загрузить сведения об оплатах"},500);
      const userByTelegramId = new Map((receiptUsers??[]).map((u:any)=>[Number(u.telegram_id),{name:[u.first_name,u.last_name].filter(Boolean).join(" ")|| (u.username ? "@"+u.username : "Сотрудник")} ]));
      const orderNumberById = new Map((receiptOrders??[]).map((o:any)=>[o.id,o.order_number]));
      const receiptsWithDetails = (receipts??[]).map((x:any)=>({...x,collector:userByTelegramId.get(Number(x.collected_by_telegram_id))?.name||"Сотрудник",order_number:orderNumberById.get(x.order_id)??null}));
      const { data: handovers, error: handoversError } = await supabase.from("cafe_cash_handovers")
        .select("id,location_id,from_telegram_id,to_telegram_id,amount_vnd,handover_status,created_at,accepted_at,accepted_by_telegram_id,note")
        .eq("location_id",locationId).gte("created_at",new Date(Date.now()-7*24*60*60*1000).toISOString()).order("created_at",{ascending:false}).limit(100);
      if (handoversError) return response({ok:false,error:"Не удалось загрузить передачи денег"},500);
      const { data: staff, error: staffError } = await supabase.from("cafe_staff")
        .select("telegram_id,staff_role").eq("location_id",locationId).eq("is_active",true);
      if (staffError) return response({ok:false,error:"Не удалось загрузить персонал"},500);
      const { data: cafe } = await supabase.from("locations").select("id,name").eq("id",locationId).maybeSingle();
      const { data: shifts, error: shiftsError } = await supabase.from("cafe_staff_shifts").select("*").eq("location_id",locationId).eq("shift_status","open").order("opened_at",{ascending:false});
      if (shiftsError) return response({ok:false,error:"Не удалось загрузить смены"},500);
      const {data:refunds,error:refundsError}=await supabase.from("cafe_order_refunds").select("id,order_id,amount_vnd,payment_method,reason,refunded_at,actor_telegram_id").eq("location_id",locationId).order("refunded_at",{ascending:false}).limit(100);
      if(refundsError)return response({ok:false,error:"Не удалось загрузить возвраты"},500);
      return response({ok:true,refunds,cashSummary,locationId,cafeName:cafe?.name||"Кафе",locations:cafesForResponse,receipts:receiptsWithDetails,handovers:handovers??[],staff:staff??[],shifts:shifts??[],actorTelegramId:telegramId,staffRole});
    }

    if (body.action === "openShift") {
      const locationId=body.locationId;
      const openingCash=Number(body.openingCashVnd);
      if(typeof locationId!=="string"||!/^[0-9a-f-]{36}$/i.test(locationId)||!Number.isSafeInteger(openingCash)||openingCash<0) return response({ok:false,error:"Укажите корректную начальную сумму"},400);
      const {data,error}=await supabase.rpc("open_cafe_staff_shift",{p_location_id:locationId,p_actor_telegram_id:telegramId,p_staff_telegram_id:telegramId,p_opening_cash_vnd:openingCash});
      if(error){const clientError=/Доступ|смена|назначен|право|отрицательн/i.test(error.message);return response({ok:false,error:clientError?error.message:"Не удалось открыть смену"},clientError?400:500);}
      return response(data??{ok:true});
    }

    if (body.action === "closeShift") {
      const shiftId=body.shiftId;
      const counted=Number(body.countedCashVnd);
      if(typeof shiftId!=="string"||!/^[0-9a-f-]{36}$/i.test(shiftId)||!Number.isSafeInteger(counted)||counted<0) return response({ok:false,error:"Укажите корректную фактическую сумму"},400);
      const {data,error}=await supabase.rpc("close_cafe_staff_shift",{p_shift_id:shiftId,p_actor_telegram_id:telegramId,p_counted_cash_vnd:counted,p_note:typeof body.note==="string"?body.note.slice(0,1000):null});
      if(error){const clientError=/Доступ|смена|право|отрицательн|закрыта/i.test(error.message);return response({ok:false,error:clientError?error.message:"Не удалось закрыть смену"},clientError?400:500);}
      return response(data??{ok:true});
    }

    if (body.action === "createHandover") {
      const locationId = body.locationId;
      const toTelegramId = Number(body.toTelegramId);
      const amountVnd = Number(body.amountVnd);
      if (typeof locationId !== "string" || !/^[0-9a-f-]{36}$/i.test(locationId) || !Number.isSafeInteger(toTelegramId) || toTelegramId<=0 || !Number.isSafeInteger(amountVnd) || amountVnd<=0) return response({ok:false,error:"Проверьте получателя и сумму"},400);
      const {data,error}=await supabase.rpc("create_cafe_cash_handover",{p_location_id:locationId,p_from_telegram_id:telegramId,p_to_telegram_id:toTelegramId,p_amount_vnd:amountVnd,p_note:typeof body.note==="string"?body.note.slice(0,500):null});
      if(error){const clientError=/Invalid cash handover|access denied|active assignment|role cannot|only be handed|must hand|themselves|different/.test(error.message);return response({ok:false,error:clientError?error.message:"Не удалось создать передачу денег"},clientError?400:500);}
      return response(data??{ok:true});
    }

    if (body.action === "respondHandover") {
      const handoverId=body.handoverId, accept=body.accept;
      if(typeof handoverId!=="string"||!/^[0-9a-f-]{36}$/i.test(handoverId)||typeof accept!=="boolean") return response({ok:false,error:"Некорректная передача денег"},400);
      const {data,error}=await supabase.rpc("respond_cafe_cash_handover",{p_handover_id:handoverId,p_actor_telegram_id:telegramId,p_accept:accept,p_note:typeof body.note==="string"?body.note.slice(0,500):null});
      if(error){const clientError=/Cash handover|Only the intended receiver|access denied|active assignment|Only cashier or administrator/.test(error.message);return response({ok:false,error:clientError?error.message:"Не удалось обработать передачу денег"},clientError?400:500);}
      return response(data??{ok:true});
    }

    if (body.action === "assignCourier") {
      const orderId=body.orderId, targetTelegramId=Number(body.courierTelegramId);
      if(typeof orderId!=="string"||!/^[0-9a-f-]{36}$/i.test(orderId)||!Number.isSafeInteger(targetTelegramId)||targetTelegramId<=0) return response({ok:false,error:"Выберите заказ и курьера"},400);
      const {data:assigned,error:assignError}=await supabase.rpc("offer_cafe_courier",{p_order_id:orderId,p_actor_telegram_id:telegramId,p_courier_telegram_id:targetTelegramId});
      if(assignError) return response({ok:false,error:assignError.message},400);
      const order=assigned.order, updated=assigned.order;
      try{await dispatchCourierQueue(supabase,botToken);}catch{console.error("Courier notification deferred");}
      return response({ok:true,order:updated});
    }

    if(body.action==="courierOffers"){
      const {data,error}=await supabase.rpc("list_cafe_courier_offers",{p_actor:telegramId});return response(error?{ok:false,error:error.message}:{ok:true,offers:data},error?400:200);
    }
    if(body.action==="respondCourierOffer"){
      if(typeof body.orderId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.orderId)||typeof body.accept!=="boolean")return response({ok:false,error:"Некорректное предложение"},400);
      const {data,error}=await supabase.rpc("respond_cafe_courier_offer",{p_order_id:body.orderId,p_actor_telegram_id:telegramId,p_accept:body.accept,p_reason:typeof body.reason==="string"?body.reason:null});
      if(error)return response({ok:false,error:error.code==="P0001"?error.message:"Не удалось ответить на предложение"},error.code==="P0001"?400:500);
      try{await dispatchCustomerNotifications(supabase,botToken);}catch{console.error("Customer notification deferred");}
      try{await dispatchCourierQueue(supabase,botToken);}catch{console.error("Courier notification deferred");}return response(data);
    }
    if(body.action==="courierPosition"){
      const {data,error}=await supabase.rpc("update_cafe_courier_position",{p_actor:telegramId,p_lat:body.latitude,p_lng:body.longitude,p_accuracy:body.accuracy});return response(error?{ok:false,error:error.message}:data,error?400:200);
    }
    if(body.action==="setDeliveryTracking"||body.action==="deliveryPosition"){
      if(typeof body.orderId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.orderId))return response({ok:false,error:"Некорректный заказ"},400);
      const setting=body.action==="setDeliveryTracking";
      if(setting&&typeof body.enabled!=="boolean")return response({ok:false,error:"Некорректный режим"},400);
      const args=setting?{p_order:body.orderId,p_actor:telegramId,p_enabled:body.enabled}:{p_order:body.orderId,p_actor:telegramId,p_session:body.sessionId,p_sequence:body.sequence,p_lat:body.latitude,p_lng:body.longitude,p_accuracy:body.accuracy};
      const {data,error}=await supabase.rpc(setting?"set_cafe_delivery_tracking":"update_cafe_delivery_tracking",args);
      return response(error?{ok:false,error:error.message}:data,error?400:200);
    }
    if(body.action==="uploadDeliveryProof"){
      try{
        const result=await uploadDeliveryProof(supabase,telegramId,body);
        const notifications=dispatchCustomerNotifications(supabase,botToken).catch(()=>{console.error("Customer notification deferred");});
        if(typeof EdgeRuntime!=="undefined") EdgeRuntime.waitUntil(notifications); else await notifications;
        return response(result);
      }catch(e){return response({ok:false,error:e instanceof Error?e.message:"Фото не сохранено"},/access denied|not allowed|Invalid delivery photo|Use JPEG|key reused|new photo/.test(String(e))?400:500);}
    }
    if(body.action==="viewDeliveryProof"){
      const {data,error}=await supabase.rpc("authorize_cafe_delivery_proof_view",{p_proof:body.proofId,p_actor:telegramId});if(error)return response({ok:false,error:error.message},400);
      const signed=await supabase.storage.from("cafe-delivery-evidence").createSignedUrl(data.path,60);if(signed.error)return response({ok:false,error:"Не удалось открыть фото"},500);return response({ok:true,url:signed.data.signedUrl});
    }

    if (body.action === "list") {
      const { data: orders, error } = await loadCafeOrders(supabase, {
        locationIds: actor.role === "super_admin" && !courierWorkspace ? null : assignedLocationIds,
        courierId: courierWorkspace ? telegramId : actor.role !== "super_admin" && assignmentsForResponse.length > 0 &&
          assignmentsForResponse.every((item) => item.staff_role === "courier") ? telegramId : null,
      });
      if (error) {
        console.error("Kitchen order list failed", error.message);
        return response({ ok: false, error: "Не удалось загрузить заказы" }, 500);
      }
      const {data:mapLocations,error:mapLocationsError}=await supabase.from("locations")
        .select("id,name,location_type,address,city,country,latitude,longitude,is_active")
        .eq("is_active",true).order("name",{ascending:true});
      if(mapLocationsError) console.error("Location map lookup failed",mapLocationsError.message);
      const roleByLocation = new Map(
        (assignmentsForResponse ?? []).map((item: { location_id: string; staff_role: string; can_accept_payments: boolean }) => [item.location_id, { role: item.staff_role, canAcceptPayments: item.can_accept_payments }]),
      );
      const ordersWithRoles = courierWorkspace ? (orders??[]).map((order:any)=>({...order,staffRole:"courier",canAcceptPayments:actor.role === "super_admin" || roleByLocation.get(order.location_id)?.canAcceptPayments === true})) : actor.role === "super_admin"
        ? (orders ?? []).map((order: { location_id: string | null }) => ({ ...order, staffRole: "manager", canAcceptPayments: true }))
        : (orders ?? []).map((order: { location_id: string | null }) => {
            const assignment = order.location_id ? roleByLocation.get(order.location_id) : null;
            return { ...order, staffRole: assignment?.role ?? null, canAcceptPayments: assignment?.canAcceptPayments === true };
          });
      const courierQuery=supabase.from("cafe_staff").select("telegram_id,location_id,staff_role,courier_available").eq("is_active",true);
      if(actor.role!=="super_admin") courierQuery.in("location_id",assignedLocationIds);
      const {data:courierAssignments,error:courierError}=await courierQuery;
      if(courierError) return response({ok:false,error:"Не удалось загрузить список курьеров"},500);
      const eligibleAssignments=[];
      for(const assignment of (courierAssignments||[]).filter((s:any)=>s.staff_role==="courier"||s.courier_available)){const {data:active,error}=await supabase.rpc("cafe_active_courier",{p_actor:assignment.telegram_id,p_location:assignment.location_id});if(error)return response({ok:false,error:"Не удалось проверить курьера"},500);if(active)eligibleAssignments.push(assignment);}
      const courierIds=Array.from(new Set((eligibleAssignments).map((x:any)=>Number(x.telegram_id))));
      const {data:courierUsers,error:courierUsersError}=courierIds.length?await supabase.from("telegram_users").select("telegram_id,first_name,last_name,username").in("telegram_id",courierIds).eq("is_active",true):{data:[],error:null};
      if(courierUsersError) return response({ok:false,error:"Не удалось загрузить профили курьеров"},500);
      const userById=new Map((courierUsers??[]).map((u:any)=>[Number(u.telegram_id),u]));
      const couriers=(eligibleAssignments).map((x:any)=>{const u=userById.get(Number(x.telegram_id));return {telegram_id:x.telegram_id,location_id:x.location_id,name:u?([u.first_name,u.last_name].filter(Boolean).join(" ")||(u.username?"@"+u.username:String(u.telegram_id))):String(x.telegram_id)}}).filter((x:any)=>userById.has(Number(x.telegram_id)));
      const orderIds=(ordersWithRoles??[]).map((o:any)=>o.id);
      const {data:statusEvents,error:statusEventsError}=orderIds.length?await supabase.from("cafe_order_events").select("order_id,actor_telegram_id,from_status,to_status,created_at").in("order_id",orderIds).order("created_at",{ascending:false}).limit(500):{data:[],error:null};
      if(statusEventsError) console.error("Order status history lookup failed",statusEventsError.message);
      const statusActorIds=Array.from(new Set((statusEvents??[]).map((e:any)=>Number(e.actor_telegram_id)).filter((id:number)=>Number.isSafeInteger(id))));
      const {data:statusActors,error:statusActorsError}=statusActorIds.length?await supabase.from("telegram_users").select("telegram_id,first_name,last_name,username").in("telegram_id",statusActorIds):{data:[],error:null};
      if(statusActorsError) console.error("Order status actor lookup failed",statusActorsError.message);
      const statusActorById=new Map((statusActors??[]).map((u:any)=>[Number(u.telegram_id),[u.first_name,u.last_name].filter(Boolean).join(" ")||(u.username?"@"+u.username:"Сотрудник")]));
      const latestEventByOrder=new Map<string,any>();
      for(const event of statusEvents??[]){if(!latestEventByOrder.has(event.order_id))latestEventByOrder.set(event.order_id,{...event,actor_name:statusActorById.get(Number(event.actor_telegram_id))||("Сотрудник ID "+event.actor_telegram_id)});}
      const ordersWithAudit=ordersWithRoles.map((o:any)=>({...o,lastStatusEvent:latestEventByOrder.get(o.id)||null}));
      const [{data:offers,error:offersError},{data:proofs,error:proofsError}]=await Promise.all([
        supabase.rpc("list_cafe_courier_offers",{p_actor:telegramId}),
        orderIds.length?supabase.from("cafe_delivery_proofs").select("id,order_id,courier_telegram_id,kind,verified_at").in("order_id",orderIds).not("verified_at","is",null):Promise.resolve({data:[],error:null})
      ]);
      if(offersError||proofsError)return response({ok:false,error:"Не удалось загрузить предложения или фото доставки"},500);
      const enrichedOrders=ordersWithAudit.map((o:any)=>({...o,deliveryProofs:(proofs||[]).filter((p:any)=>p.order_id===o.id)}));
      return response({ ok: true, orders: enrichedOrders, courierOffers:offers||[], staffRole, locationIds: assignedLocationIds, couriers, actorTelegramId: telegramId, locations: mapLocations ?? [] });
    }

    if (body.action === "addItems") {
      const orderId = body.orderId;
      const items = body.items;
      if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId) ||
          !Array.isArray(items) || items.length < 1 || items.length > 50 ||
          items.some((item: any) => !item || typeof item.productId !== "string" ||
            !/^[0-9a-f-]{36}$/i.test(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)) {
        return response({ ok: false, error: "Некорректный заказ или состав" }, 400);
      }
      const { data, error } = await submitCafeOperation(supabase, telegramId, body.requestKey, "addItems", {
        p_staff_telegram_id: telegramId,
        p_order_id: orderId,
        p_items: items.map((item: { productId: string; quantity: number }) => ({ productId: item.productId, quantity: item.quantity })),
      });
      if (error) {
        const clientError = /Invalid idempotent order request|Idempotency key reused|Staff operation access denied|Order operation access denied|Invalid staff|Staff access denied|Order not found|Only dine-in bills|Bill is already closed|Staff cannot add items|Invalid order items|Invalid item|Invalid item quantity|Product not found or unavailable/.test(error.message);
        return response({ ok: false, error: clientError ? error.message : "Не удалось добавить блюда в счёт" }, clientError ? 400 : 500);
      }
      try{await dispatchCustomerNotifications(supabase,botToken);}catch{console.error("Customer notification deferred");}
      return response({ ...(data ?? { ok: true }), staffRole });
    }

    if (body.action === "refundOrder") {
      if(typeof body.orderId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.orderId)||typeof body.requestKey!=="string"||!/^[0-9a-f-]{36}$/i.test(body.requestKey)||body.payoutConfirmed!==true||typeof body.reason!=="string"||body.reason.trim().length<3||body.reason.trim().length>500)return response({ok:false,error:"Укажите причину и подтвердите фактический возврат денег"},400);
      const {data,error}=await supabase.rpc("refund_cafe_order",{p_order_id:body.orderId,p_actor_telegram_id:telegramId,p_request_key:body.requestKey,p_reason:body.reason,p_payout_confirmed:body.payoutConfirmed});
      if(error)return response({ok:false,error:error.code==="P0001"?error.message:"Не удалось записать возврат"},error.code==="P0001"?400:500);
      return response(data);
    }

    if (body.action === "updatePayment") {
      const orderId = body.orderId;
      const paymentStatus = body.paymentStatus;
      if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId) || !["paid", "pending"].includes(paymentStatus)) {
        return response({ ok: false, error: "Некорректный заказ или статус оплаты" }, 400);
      }
      if(paymentStatus==="paid"){
        const {data:paymentOrder,error:paymentOrderError}=await supabase.from("cafe_orders").select("id,payment_method").eq("id",orderId).maybeSingle();
        if(paymentOrderError||!paymentOrder)return response({ok:false,error:"Заказ не найден"},404);
        if(paymentOrder.payment_method==="bank_transfer"){
          const {data:proofs,error:proofError}=await supabase.from("cafe_transfer_proofs").select("id").eq("order_id",orderId).eq("review_status","pending").limit(1);
          if(proofError||!proofs?.length)return response({ok:false,error:"Для банковского перевода сначала требуется скриншот платежа"},400);
        }
      }
      const tenderedAmount = body.tenderedAmountVnd == null ? null : Number(body.tenderedAmountVnd);
      const changeGiven = body.changeGivenVnd == null ? null : Number(body.changeGivenVnd);
      if (paymentStatus === "paid" && body.paymentMethod === "cash" &&
          (!Number.isSafeInteger(tenderedAmount) || !Number.isSafeInteger(changeGiven) || tenderedAmount < 0 || changeGiven < 0)) {
        return response({ ok: false, error: "Укажите сумму, полученную от клиента, и сдачу" }, 400);
      }
      const { data, error } = await supabase.rpc("update_cafe_order_payment_cash", {
        p_order_id: orderId,
        p_actor_telegram_id: telegramId,
        p_payment_status: paymentStatus,
        p_note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
        p_tendered_amount_vnd: tenderedAmount,
        p_change_given_vnd: changeGiven,
      });
      if (error) {
        const clientError = /Courier can accept payment only for own collected delivery|Closed order cannot receive payment changes|Use recorded refund instead of voiding payment|Invalid payment|Payment already confirmed|Invalid cash received amount or change|Cash receipt was not recorded|Order not found|Payment management access denied|Payment acceptance permission denied|No active staff assignment|Staff role cannot update payment/.test(error.message);
        return response({ ok: false, error: clientError ? error.message : "Не удалось обновить оплату" }, clientError ? 400 : 500);
      }
      if(paymentStatus==="paid")await supabase.from("cafe_transfer_proofs").update({review_status:"confirmed",reviewed_by_telegram_id:telegramId,reviewed_at:new Date().toISOString()}).eq("order_id",orderId).eq("review_status","pending");
      try{await dispatchCustomerNotifications(supabase,botToken);}catch{console.error("Customer notification deferred");}
      return response({ ...(data ?? { ok: true }), staffRole });
    }

    if (body.action === "updateDelivery") {
      const orderId = body.orderId;
      const deliveryStatus = body.deliveryStatus;
      if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId) || !["waiting_courier", "courier_assigned", "picked_up", "delivered"].includes(deliveryStatus)) {
        return response({ ok: false, error: "Некорректный заказ или статус доставки" }, 400);
      }
      const { data, error } = await supabase.rpc("update_cafe_delivery_status", {
        p_order_id: orderId,
        p_actor_telegram_id: telegramId,
        p_delivery_status: deliveryStatus,
        p_note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
      });
      if (error) {
        const clientError = error.code === "P0001";
        return response({ ok: false, error: clientError ? error.message : "Не удалось обновить доставку" }, clientError ? 400 : 500);
      }
      try{await dispatchCustomerNotifications(supabase,botToken);}catch{console.error("Customer notification deferred");}
      return response({ ...(data ?? { ok: true }), staffRole });
    }

    if (body.action === "updateStatus") {
      const orderId = body.orderId;
      const status = body.status;
      const allowedStatuses = ["confirmed", "preparing", "ready", "completed", "cancelled"];
      if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId) || !allowedStatuses.includes(status)) {
        return response({ ok: false, error: "Некорректный заказ или статус" }, 400);
      }
      const { data, error } = await supabase.rpc("update_cafe_order_status", {
        p_order_id: orderId,
        p_actor_telegram_id: telegramId,
        p_new_status: status,
        p_note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
      });
      if (error) {
        const clientError = /Paid order requires recorded refund before cancellation|Staff role cannot perform this order status transition|Invalid order status transition|Order cannot be completed before payment is confirmed|Delivery must be confirmed before completing the order|Order already has this status|Order already accepted by another employee|Order not found|Order management access denied|Invalid order status/.test(error.message);
        return response({ ok: false, error: clientError ? error.message : "Не удалось обновить статус" }, clientError ? 400 : 500);
      }
      // Notify the customer and all other staff after the database commits the transition.
      try {
        const { data: updatedOrder, error: notifyLookupError } = await supabase
          .from("cafe_orders")
          .select("customer_telegram_id, order_number, status, location_id, accepted_by_telegram_id")
          .eq("id", orderId)
          .maybeSingle();

        if (notifyLookupError) {
          console.error("Order notification lookup failed", notifyLookupError.message);
        } else if (updatedOrder) {
          if (status === "confirmed" && updatedOrder.location_id) {
            const [{ data: location }, { data: assignments, error: assignmentsError }] = await Promise.all([
              supabase.from("locations").select("name").eq("id", updatedOrder.location_id).maybeSingle(),
              supabase.from("cafe_staff").select("telegram_id").eq("location_id", updatedOrder.location_id).eq("is_active", true).neq("staff_role","courier").neq("telegram_id", telegramId),
            ]);
            if (assignmentsError) console.error("Staff acceptance notification lookup failed", assignmentsError.message);
            else {
              const recipients = Array.from(new Set((assignments ?? []).map((a: {telegram_id:number}) => Number(a.telegram_id)).filter(id => Number.isSafeInteger(id) && id > 0)));
              await Promise.all(recipients.map(async (recipient) => {
                try {
                  const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: recipient,
                      text: `Umma Cafe · Заказ №${updatedOrder.order_number}\n\nЗаказ уже принял другой сотрудник.\nКафе: ${location?.name ?? "HALAL UMMA"}\nСтатус: принят в работу.` }),
                  });
                  if (!r.ok) console.error("Telegram staff acceptance notification failed", recipient, r.status);
                } catch (e) { console.error("Staff acceptance notification error", e); }
              }));
            }
          }
        }
      } catch (notificationError) {
        console.error("Telegram notification error", notificationError);
      }

      try{await dispatchCustomerNotifications(supabase,botToken);}catch{console.error("Customer notification deferred");}
      return response({ ...(data ?? { ok: true }), staffRole });
    }

    return response({ ok: false, error: "Неизвестное действие" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const authError = /Telegram|signature/i.test(message);
    return response({ ok: false, error: authError ? "Ошибка проверки Telegram" : "Некорректный запрос" }, authError ? 401 : 400);
  }
});
