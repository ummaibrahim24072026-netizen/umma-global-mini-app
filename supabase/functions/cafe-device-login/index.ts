import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.99.1';
import {sha256} from '../_shared/web-staff-auth.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
};
const reply = (data: object, status = 200) => new Response(JSON.stringify(data), {status, headers});
const isToken = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const secret = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers});
  if (req.method !== 'POST') return reply({ok: false}, 405);
  try {
    const raw = await req.text();
    if (raw.length > 512) return reply({ok: false}, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ok: false}, 400); }

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: {persistSession: false, autoRefreshToken: false},
    });
    if (body?.action === 'issue' || body?.action === 'cancel') {
      const source = typeof body.credential === 'string' && body.credential.startsWith('web:')
        ? body.credential.slice(4) : null;
      if (!isToken(source)) return reply({ok: false, error: 'Войдите в аккаунт сотрудника.'}, 401);
      const sourceHash = await sha256(source);
      if (body.action === 'cancel') {
        if (!isToken(body.code)) return reply({ok: false}, 400);
        const {error} = await db.from('cafe_web_device_codes').delete()
          .eq('source_hash', sourceHash).eq('code_hash', await sha256(body.code));
        if (error) throw error;
        return reply({ok: true});
      }
      const code = secret();
      const {data, error} = await db.rpc('cafe_web_issue_device_code', {
        p_source_hash: sourceHash, p_code_hash: await sha256(code),
      });
      if (error) throw error;
      if (!data) return reply({ok: false, error: 'Войдите в рабочий аккаунт ещё раз.'}, 401);
      return reply({ok: true, code, validForSeconds: 60});
    }

    if (body?.action !== 'redeem' || !isToken(body.code)) return reply({ok: false, error: 'Некорректный QR-код.'}, 400);
    const token = secret();
    const {data, error} = await db.rpc('cafe_web_redeem_device_code', {
      p_code_hash: await sha256(body.code), p_session_hash: await sha256(token),
    });
    if (error) throw error;
    if (!data) return reply({ok: false, error: 'Код истёк, отменён или уже использован. Создайте новый на телефоне.'}, 410);
    return reply({ok: true, token});
  } catch (error) {
    console.error('Staff device login failed', error instanceof Error ? error.name : 'database error');
    return reply({ok: false, error: 'Не удалось подключить устройство. Попробуйте ещё раз.'}, 503);
  }
});
