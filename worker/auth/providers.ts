// Per-provider ID-token verification.
//
// Each function takes a raw ID token from the client and returns a normalized
// identity record. The client IDs / audiences come from Worker bindings (set
// via `wrangler secret put` or [vars] in wrangler.toml).
//
// Microsoft's `iss` includes the tenant id, so for a "common"/multi-tenant
// configuration we accept any `https://login.microsoftonline.com/{tid}/v2.0`
// issuer rather than a fixed string.

import { verifyProviderIdToken, type JwtPayload } from './jwt';

export type Provider = 'google' | 'apple' | 'microsoft';

export interface VerifiedIdentity {
  provider: Provider;
  subject: string; // stable per-provider user id (the `sub` claim)
  email: string | null;
  name: string | null;
}

interface ProviderEnv {
  GOOGLE_CLIENT_ID?: string;
  APPLE_CLIENT_ID?: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_TENANT?: string; // "common" by default
}

function require(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function nameFrom(p: JwtPayload): string | null {
  if (typeof p.name === 'string' && p.name.trim()) return p.name.trim();
  const parts = [p.given_name, p.family_name].filter((s) => typeof s === 'string' && s.length > 0);
  return parts.length ? parts.join(' ') : null;
}

export async function verifyGoogle(idToken: string, env: ProviderEnv): Promise<VerifiedIdentity> {
  const audience = require(env.GOOGLE_CLIENT_ID, 'GOOGLE_CLIENT_ID');
  // Some flows return tokens minted for the iOS client id and others for the
  // web/server client id. Either is fine — we accept a comma-separated list.
  const audiences = audience.split(',').map((s) => s.trim()).filter(Boolean);
  const payload = await verifyProviderIdToken(idToken, {
    jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
    audiences,
  });
  if (!payload.sub) throw new Error('google: missing sub');
  return {
    provider: 'google',
    subject: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    name: nameFrom(payload),
  };
}

export async function verifyApple(idToken: string, env: ProviderEnv): Promise<VerifiedIdentity> {
  const audience = require(env.APPLE_CLIENT_ID, 'APPLE_CLIENT_ID');
  const audiences = audience.split(',').map((s) => s.trim()).filter(Boolean);
  const payload = await verifyProviderIdToken(idToken, {
    jwksUri: 'https://appleid.apple.com/auth/keys',
    issuers: ['https://appleid.apple.com'],
    audiences,
  });
  if (!payload.sub) throw new Error('apple: missing sub');
  // Apple only sends `name` in the *first* sign-in's authorization response,
  // not in the JWT. The client may pass it separately on /api/auth/apple.
  return {
    provider: 'apple',
    subject: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    name: nameFrom(payload),
  };
}

export async function verifyMicrosoft(idToken: string, env: ProviderEnv): Promise<VerifiedIdentity> {
  const audience = require(env.MICROSOFT_CLIENT_ID, 'MICROSOFT_CLIENT_ID');
  const audiences = audience.split(',').map((s) => s.trim()).filter(Boolean);
  const tenant = env.MICROSOFT_TENANT || 'common';

  // Parse first so we can pick the right tenant-scoped JWKS endpoint and
  // accept a matching `iss`. For multi-tenant apps (tenant=common) Microsoft
  // returns issuers of the form https://login.microsoftonline.com/{tid}/v2.0
  // where {tid} is the user's home tenant — we accept anything matching that
  // shape rather than a fixed string.
  const [, payloadB64] = idToken.split('.');
  if (!payloadB64) throw new Error('microsoft: malformed token');
  // Parse twice (here for issuer derivation, again inside verifyProviderIdToken
  // for full verification) — cheap and keeps the verifier provider-agnostic.
  const peek = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
  const issuer = typeof peek.iss === 'string' ? peek.iss : '';
  const issuerOk =
    tenant === 'common' || tenant === 'organizations'
      ? /^https:\/\/login\.microsoftonline\.com\/[^/]+\/v2\.0$/.test(issuer)
      : issuer === `https://login.microsoftonline.com/${tenant}/v2.0`;
  if (!issuerOk) throw new Error(`microsoft: unexpected issuer: ${issuer}`);

  const payload = await verifyProviderIdToken(idToken, {
    jwksUri: `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
    issuers: [issuer], // we already pattern-matched it above
    audiences,
  });
  if (!payload.sub) throw new Error('microsoft: missing sub');
  // Microsoft sometimes ships email in `preferred_username` instead of `email`.
  const email =
    (typeof payload.email === 'string' && payload.email) ||
    (typeof payload.preferred_username === 'string' ? (payload.preferred_username as string) : null);
  return {
    provider: 'microsoft',
    subject: payload.sub,
    email,
    name: nameFrom(payload),
  };
}
