// Short-lived, HMAC-signed tokens for one media object at a time.
// This is what lets a private R2 bucket serve a single image to an
// external fetcher (fal.ai, during LoRA training) or to our own
// frontend's <img> tags, without making the bucket public or trying
// to have fal.ai present our Supabase session.
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function signMediaToken(
  secret: string,
  resourceId: string,
  ttlMs = DEFAULT_TTL_MS
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + ttlMs;
  const sig = await hmac(secret, `${resourceId}.${expiresAt}`);
  return { token: `${expiresAt}.${toBase64Url(sig)}`, expiresAt };
}

export async function verifyMediaToken(secret: string, resourceId: string, token: string): Promise<boolean> {
  const [expiresAtStr, sigPart] = token.split('.');
  const expiresAt = Number(expiresAtStr);
  if (!expiresAt || Number.isNaN(expiresAt) || !sigPart || Date.now() > expiresAt) return false;
  const expectedSig = toBase64Url(await hmac(secret, `${resourceId}.${expiresAt}`));
  return timingSafeEqual(expectedSig, sigPart);
}

async function hmac(secret: string, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
