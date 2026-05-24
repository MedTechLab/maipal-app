// Minimal JWT helpers built on the Web Crypto API (no Node deps).
//
// Two roles:
//   - verifyProviderIdToken: RS256-verify a third-party OIDC ID token against
//     the provider's JWKS, then check iss/aud/exp/iat.
//   - signSession / verifySession: HS256 sign/verify our own session token.
//
// Caches JWKS responses in-module for the lifetime of the isolate (typically
// minutes on Workers) so we don't refetch on every call.

export interface JwtHeader {
  alg: string;
  kid?: string;
  typ?: string;
}

export interface JwtPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  [k: string]: unknown;
}

interface Jwk {
  kty: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  [k: string]: unknown;
}

interface Jwks {
  keys: Jwk[];
}

// base64url encode/decode (no padding, URL-safe alphabet).
const b64uDecode = (s: string): Uint8Array => {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const b64uEncode = (bytes: ArrayBuffer | Uint8Array): string => {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
};

const utf8 = (s: string) => new TextEncoder().encode(s);
const fromUtf8 = (b: Uint8Array) => new TextDecoder().decode(b);

export function parseJwt(token: string): { header: JwtHeader; payload: JwtPayload; signingInput: string; signature: Uint8Array } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed JWT');
  const header = JSON.parse(fromUtf8(b64uDecode(parts[0]))) as JwtHeader;
  const payload = JSON.parse(fromUtf8(b64uDecode(parts[1]))) as JwtPayload;
  const signature = b64uDecode(parts[2]);
  return { header, payload, signingInput: `${parts[0]}.${parts[1]}`, signature };
}

// ─── JWKS cache + RS256 verification ─────────────────────────

const jwksCache = new Map<string, { fetchedAt: number; jwks: Jwks }>();
const JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getJwks(jwksUri: string): Promise<Jwks> {
  const hit = jwksCache.get(jwksUri);
  if (hit && Date.now() - hit.fetchedAt < JWKS_TTL_MS) return hit.jwks;
  const res = await fetch(jwksUri);
  if (!res.ok) throw new Error(`JWKS fetch failed for ${jwksUri}: ${res.status}`);
  const jwks = (await res.json()) as Jwks;
  jwksCache.set(jwksUri, { fetchedAt: Date.now(), jwks });
  return jwks;
}

async function verifyRs256(signingInput: string, signature: Uint8Array, jwk: Jwk): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk as JsonWebKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, utf8(signingInput));
}

export interface ProviderConfig {
  jwksUri: string;
  issuers: string[]; // one or more acceptable `iss` values
  audiences: string[]; // one or more acceptable `aud` values (your client IDs)
}

export async function verifyProviderIdToken(
  token: string,
  cfg: ProviderConfig,
): Promise<JwtPayload> {
  const { header, payload, signingInput, signature } = parseJwt(token);
  if (header.alg !== 'RS256') throw new Error(`unsupported alg: ${header.alg}`);

  const jwks = await getJwks(cfg.jwksUri);
  const jwk = jwks.keys.find((k) => k.kid === header.kid) ?? jwks.keys[0];
  if (!jwk) throw new Error('no JWKS key matched the token kid');
  const ok = await verifyRs256(signingInput, signature, jwk);
  if (!ok) throw new Error('signature verification failed');

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now - 60) throw new Error('token expired');
  if (typeof payload.iat === 'number' && payload.iat > now + 60) throw new Error('token issued in the future');

  if (!payload.iss || !cfg.issuers.includes(payload.iss)) {
    throw new Error(`unexpected issuer: ${payload.iss}`);
  }
  const auds = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
  const audOk = auds.some((a) => cfg.audiences.includes(a));
  if (!audOk) throw new Error(`unexpected audience: ${auds.join(',')}`);

  return payload;
}

// ─── HS256 session tokens ────────────────────────────────────

export interface SessionPayload {
  sub: string; // user id
  iat: number;
  exp: number;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    utf8(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signSession(userId: string, secret: string, ttlSeconds = 60 * 60 * 24 * 30): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: SessionPayload = { sub: userId, iat: now, exp: now + ttlSeconds };
  const signingInput = `${b64uEncode(utf8(JSON.stringify(header)))}.${b64uEncode(utf8(JSON.stringify(payload)))}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, utf8(signingInput));
  return `${signingInput}.${b64uEncode(sig)}`;
}

export async function verifySession(token: string, secret: string): Promise<SessionPayload> {
  const { header, payload, signingInput, signature } = parseJwt(token);
  if (header.alg !== 'HS256') throw new Error(`unsupported session alg: ${header.alg}`);
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify('HMAC', key, signature, utf8(signingInput));
  if (!ok) throw new Error('session signature invalid');
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('session expired');
  if (typeof payload.sub !== 'string') throw new Error('session missing sub');
  return payload as SessionPayload;
}
