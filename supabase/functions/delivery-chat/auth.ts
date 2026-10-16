async function hmac(key: CryptoKey, value: string): Promise<ArrayBuffer> {
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
}
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(v => v.toString(16).padStart(2, "0")).join("");
}
export async function verifyTelegramInitData(initData: string, botToken: string): Promise<number> {
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

