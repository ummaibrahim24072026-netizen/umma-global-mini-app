// Compatibility for a cached customer form. Caller must verify Telegram HMAC first.
// One identical legacy checkout per signed Telegram session; retries reuse its order.
// Never fall back to a random key: a lost response could then create a second order.
export async function submitCafeOperation(client: any, actor: number, requestKey: unknown, action: string, args: unknown, verifiedSession?: string) {
  if (requestKey === undefined && action === 'customerOrder' && verifiedSession) {
    const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
    const sessionHash = new URLSearchParams(verifiedSession).get('hash');
    if (!sessionHash) return {data:null,error:{message:'Invalid idempotent order request'}};
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(
      JSON.stringify(['umma:legacy-customer:v1', actor, sessionHash.toLowerCase(), canonical(args)])
    )));
    bytes[6] = (bytes[6] & 15) | 80;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes.slice(0,16), byte => byte.toString(16).padStart(2,'0')).join('');
    requestKey = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  if (typeof requestKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)) {
    return Promise.resolve({data:null,error:{message:'Invalid idempotent order request'}});
  }
  return client.rpc('execute_cafe_order_operation', {
    p_actor_telegram_id: actor, p_request_key: requestKey, p_action: action, p_arguments: args,
  });
}
