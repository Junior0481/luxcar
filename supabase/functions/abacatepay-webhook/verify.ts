type VerifyInput = {
  expectedSecret: string | undefined;
  receivedSecret: string | null;
  publicKey: string | undefined;
  signature: string | null;
  rawBody: string;
};
type VerifyResult = { ok: true } | { ok: false; status: 401 | 500; error: string };

const encoder = new TextEncoder();

function timingSafeEqual(a: string, b: string) {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
}

export async function hmacBase64(key: string, body: string) {
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(body)));
  return btoa(String.fromCharCode(...signature));
}

/** webhookSecret in the URL proves the origin; the HMAC header proves the body was not altered. */
export async function verifyWebhook({ expectedSecret, receivedSecret, publicKey, signature, rawBody }: VerifyInput): Promise<VerifyResult> {
  if (!expectedSecret) return { ok: false, status: 500, error: 'Webhook secret not configured' };
  if (!receivedSecret || !timingSafeEqual(receivedSecret, expectedSecret)) return { ok: false, status: 401, error: 'Unauthorized' };
  if (publicKey) {
    if (!signature) return { ok: false, status: 401, error: 'Missing signature' };
    const expected = await hmacBase64(publicKey, rawBody);
    if (!timingSafeEqual(signature, expected)) return { ok: false, status: 401, error: 'Invalid signature' };
  }
  return { ok: true };
}
