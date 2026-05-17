/**
 * Signed-cookie session. HMAC-SHA256 JWT carries the Steam ID + expiry; the
 * cookie itself is HttpOnly so it survives a tab close but is never reachable
 * from page JS. KV is intentionally not involved at this layer — SPEC §6
 * names "Worker-issued JWT" for session storage; KV is for manifest + HLTB +
 * IGDB caches (Phase 2 slices 2–4).
 */

const ALG = { name: 'HMAC', hash: 'SHA-256' } as const;
const SESSION_COOKIE = 'lw_session';
const SESSION_TTL_S = 60 * 60 * 24 * 7; // 7 days

export interface SessionClaims {
  /** Steam ID 64 (string — JS numbers can't represent it precisely). */
  sub: string;
  /** Issued-at, seconds since epoch. */
  iat: number;
  /** Expiry, seconds since epoch. */
  exp: number;
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const std = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(std);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    ALG,
    false,
    ['sign', 'verify'],
  );
}

export async function signSession(steamId: string, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: SessionClaims = { sub: steamId, iat: now, exp: now + SESSION_TTL_S };
  const header = b64urlEncode(
    new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
  );
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify(claims)));
  const data = `${header}.${payload}`;
  const key = await importHmacKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign(ALG, key, new TextEncoder().encode(data)),
  );
  return `${data}.${b64urlEncode(sig)}`;
}

export async function verifySession(
  token: string,
  secret: string,
): Promise<SessionClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let sig: Uint8Array;
  try {
    sig = b64urlDecode(parts[2]);
  } catch {
    return null;
  }
  const key = await importHmacKey(secret);
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const ok = await crypto.subtle.verify(ALG, key, sig, data);
  if (!ok) return null;
  let claims: SessionClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1]))) as SessionClaims;
  } catch {
    return null;
  }
  if (typeof claims.sub !== 'string' || typeof claims.exp !== 'number') return null;
  if (claims.exp * 1000 < Date.now()) return null;
  return claims;
}

export function readSessionCookie(req: Request): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name === SESSION_COOKIE) return part.slice(eq + 1).trim();
  }
  return null;
}

export function setSessionCookieHeader(token: string, secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_TTL_S}`,
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export function clearSessionCookieHeader(secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE}=`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=0',
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}
