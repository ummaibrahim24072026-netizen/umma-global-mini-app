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

export async function notifyCall(
  callId: string, targets: Target[], config: {publicKey: string; privateKey: string}
) {
  if (!config?.publicKey || !config.privateKey) return;
  await Promise.allSettled(targets.map(async target => {
    const ttl = Math.floor((Date.parse(target.expires_at) - Date.now()) / 1000);
    if (ttl < 2 || !validSubscription(target.subscription)) return;
    const copy = labels[target.language as keyof typeof labels] || labels.en;
    await webpush.sendNotification(target.subscription, JSON.stringify({
      kind: 'call', callId, staff: target.staff, title: copy[target.mode],
      body: target.staff ? copy.customer : copy.cafe
    }), {
      TTL: Math.min(ttl, 45), urgency: 'high', timeout: 5000,
      vapidDetails: {
        subject: 'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/',
        publicKey: config.publicKey, privateKey: config.privateKey
      }
    });
  }));
}
