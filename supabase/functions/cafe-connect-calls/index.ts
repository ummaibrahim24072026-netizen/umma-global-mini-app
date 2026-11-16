import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.99.1';
import {sha256, verifyWebStaffSession} from '../_shared/web-staff-auth.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status, headers});
const uuid = (value: unknown) => typeof value === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: {persistSession: false, autoRefreshToken: false}
});

async function iceServers(device: string) {
  const servers: Array<{urls: string | string[]; username?: string; credential?: string}> = [{urls: 'stun:stun.l.google.com:19302'}];
  const urls = Deno.env.get('UMMA_CALL_TURN_URLS')?.split(',').map(url => url.trim()).filter(Boolean);
  const secret = Deno.env.get('UMMA_CALL_TURN_SECRET');
  if (urls?.length && secret) {
    const username = Math.floor(Date.now() / 1000 + 3600 * 4) + ':' + device;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-1'}, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(username));
    servers.push({urls, username, credential: btoa(String.fromCharCode(...new Uint8Array(signature)))});
  }
  return servers;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers});
  if (req.method !== 'POST') return reply({ok: false}, 405);
  let b;
  try {
    const raw = await req.text();
    if (raw.length > 60000) return reply({ok: false}, 413);
    b = JSON.parse(raw);
  } catch {
    return reply({ok: false}, 400);
  }
  if (!b || !['poll', 'start', 'answer', 'end', 'ice'].includes(b.action) || !uuid(b.device) ||
      (b.action !== 'poll' && b.action !== 'ice' && !uuid(b.id)) ||
      (b.id != null && !uuid(b.id)) || (b.clientId != null && !uuid(b.clientId)) ||
      (b.action === 'start' && !['audio', 'video'].includes(b.mode)) ||
      (['start', 'answer'].includes(b.action) && (typeof b.sdp !== 'string' || b.sdp.length > 48000 || !b.sdp.startsWith('v=0')))) {
    return reply({ok: false}, 400);
  }
  try {
    const actor = typeof b.initData === 'string' ? await verifyWebStaffSession(db, b.initData) : null;
    if (actor === null && (typeof b.token !== 'string' || !/^[a-f0-9]{64}$/.test(b.token))) return reply({ok: false}, 401);
    const hash = actor === null ? await sha256(b.token) : null;
    const {data, error} = await db.rpc('cafe_connect_call', {
      p_action: b.action === 'ice' ? 'poll' : b.action,
      p_device: b.device,
      p_hash: hash,
      p_actor: actor,
      p_client: b.clientId ?? null,
      p_call: b.id ?? null,
      p_mode: b.mode ?? null,
      p_sdp: b.sdp ?? null
    });
    if (error) {
      if (error.message === 'Access denied') return reply({ok: false}, 403);
      if (error.message === 'Please wait') return reply({ok: false, busy: true}, 429);
      console.error('Call signaling failed', error.code);
      return reply({ok: false}, 500);
    }
    return reply(b.action === 'ice' ? {ok: true, servers: await iceServers(b.device)} : data);
  } catch (error) {
    if (String(error).startsWith('Error: Web ')) return reply({ok: false}, 403);
    console.error('Call request failed', (error as Error).name);
    return reply({ok: false}, 500);
  }
});
