import webpush from 'npm:web-push@3.6.7';

type Subscription = {endpoint: string; keys: {p256dh: string; auth: string}};
type Target = {subscription: Subscription; language: string; staff: boolean; mode: 'audio' | 'video'; expires_at: string};
const labels = {
  ru: {audio: 'Входящий голосовой звонок', video: 'Входящий видеозвонок', customer: 'Клиент звонит в кафе', cafe: 'Вам звонит кафе UMMA'},
  en: {audio: 'Incoming voice call', video: 'Incoming video call', customer: 'A customer is calling the café', cafe: 'UMMA Café is calling you'},
  vi: {audio: 'Cuộc gọi thoại đến', video: 'Cuộc gọi video đến', customer: 'Khách hàng đang gọi quán', cafe: 'Quán UMMA đang gọi cho bạn'}
};

export function validSubscription(value: unknown): value is Subscription {
  const s = value as Subscription;
  try {
    const url = new URL(s.endpoint);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      s.endpoint.length < 4096 && ['fcm.googleapis.com', 'updates.push.services.mozilla.com',
        'web.push.apple.com', 'wns2-par02p.wns.windows.com'].includes(url.hostname) &&
      typeof s.keys.p256dh === 'string' && /^[A-Za-z0-9_-]{87}$/.test(s.keys.p256dh) &&
      typeof s.keys.auth === 'string' && /^[A-Za-z0-9_-]{22}$/.test(s.keys.auth);
  } catch {
    return false;
  }
}

function retryDelay(error: {statusCode?: number; headers?: Record<string, string>} | null, attempt: number) {
  const status = error?.statusCode;
  if (status && status !== 429 && status < 500) return null;
  const after = error?.headers?.['retry-after'];
  const fallback = attempt === 0 ? 500 : 1200;
  if (!after) return fallback;
  const seconds = Number(after);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(after) - Date.now();
  return Number.isFinite(delay) ? Math.max(fallback, delay) : fallback;
}

export async function notifyCall(
  callId: string, targets: Target[], config: {publicKey: string; privateKey: string}
) {
  if (!config?.publicKey || !config.privateKey) throw Error('Push configuration missing');
  const results = await Promise.all(targets.map(async target => {
    if (!validSubscription(target.subscription)) return 'invalid';
    const expiresAt = Date.parse(target.expires_at);
    if (!Number.isFinite(expiresAt)) return 'invalid';
    const copy = labels[target.language as keyof typeof labels] || labels.en;
    const payload = JSON.stringify({
      kind: 'call', callId, staff: target.staff, title: copy[target.mode],
      body: target.staff ? copy.customer : copy.cafe
    });
    for (let attempt = 0; attempt < 3; attempt++) {
      const ttl = Math.floor((expiresAt - Date.now()) / 1000);
      if (ttl < 2) return 'expired';
      try {
        await webpush.sendNotification(target.subscription, payload, {
          TTL: Math.min(ttl, 75), urgency: 'high', timeout: Math.min(5000, ttl * 1000),
          topic: callId.replaceAll('-', ''),
          vapidDetails: {
            subject: 'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/',
            publicKey: config.publicKey, privateKey: config.privateKey
          }
        });
        return 'accepted';
      } catch (error) {
        const failure = error as {statusCode?: number; headers?: Record<string, string>} | null;
        const delay = retryDelay(failure, attempt);
        if (attempt === 2 || delay === null || Date.now() + delay + 2000 >= expiresAt) {
          return 'failed:' + (failure?.statusCode ?? 'network');
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return 'expired';
  }));
  if (results.some(result => result !== 'accepted')) {
    console.warn('Call push outcomes', results);
  }
}
