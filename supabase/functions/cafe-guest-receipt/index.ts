import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.99.1';

const headers = {
 'Access-Control-Allow-Origin': '*',
 'Access-Control-Allow-Headers': 'content-type',
 'Access-Control-Allow-Methods': 'POST,OPTIONS',
 'Content-Type': 'application/json',
 'Cache-Control': 'no-store',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {headers, status});
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

Deno.serve(async req => {
 if (req.method === 'OPTIONS') return new Response(null, {headers, status: 204});
 if (req.method !== 'POST') return reply({ok:false}, 405);
 let body;
 try {
  const raw = await req.text();
  if (raw.length > 512) return reply({ok:false}, 413);
  body = JSON.parse(raw);
 } catch {
  return reply({ok:false}, 400);
 }
 if (typeof body?.orderId !== 'string' || typeof body.requestKey !== 'string' ||
   !uuid.test(body.orderId) || !uuid.test(body.requestKey)) return reply({ok:false}, 400);

 const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error} = await db.rpc('confirm_cafe_guest_delivery_received', {
  p_request_key:body.requestKey, p_order_id:body.orderId,
 });
 if (error) return reply({ok:false,code:'RECEIPT_UNAVAILABLE'}, 503);
 if (!data?.ok) return reply(data, data?.code === 'ORDER_UNAVAILABLE' ? 404 : 409);
 return reply(data);
});
