// Thin wrapper over @capgo/capacitor-social-login.
//
// One-time initialize on app boot, then a single login(provider) that returns
// the ID token + optional display name we need to send to the Worker. Native
// (iOS/Android) uses the platform SDKs; in the web build the same plugin falls
// back to the OAuth2 popup/redirect flow.

import { SocialLogin } from '@capgo/capacitor-social-login';

export type AuthProvider = 'google' | 'apple' | 'microsoft';

export interface ProviderToken {
  provider: AuthProvider;
  idToken: string;
  name?: string;
}

const MICROSOFT_PROVIDER_ID = 'azure';

let initialized = false;
let initPromise: Promise<void> | null = null;

/** Reads the OAuth client IDs the app was built with. See README. */
function env() {
  return {
    googleWebClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined,
    googleIosClientId: import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID as string | undefined,
    appleClientId: import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined,
    appleRedirectUrl: import.meta.env.VITE_APPLE_REDIRECT_URL as string | undefined,
    microsoftClientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID as string | undefined,
    microsoftTenant:
      (import.meta.env.VITE_MICROSOFT_TENANT as string | undefined) ?? 'common',
    microsoftRedirectUrl: import.meta.env.VITE_MICROSOFT_REDIRECT_URL as string | undefined,
  };
}

export async function initSocialLogin(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;
  const e = env();

  const oauth2: Record<string, Parameters<typeof SocialLogin.initialize>[0]['oauth2'] extends infer R | undefined ? R extends Record<string, infer V> ? V : never : never> = {};
  if (e.microsoftClientId && e.microsoftRedirectUrl) {
    const base = `https://login.microsoftonline.com/${e.microsoftTenant}/oauth2/v2.0`;
    oauth2[MICROSOFT_PROVIDER_ID] = {
      appId: e.microsoftClientId,
      authorizationBaseUrl: `${base}/authorize`,
      accessTokenEndpoint: `${base}/token`,
      redirectUrl: e.microsoftRedirectUrl,
      // openid is required for an ID token; email/profile populate the claims
      // the Worker reads in verifyMicrosoft().
      scopes: ['openid', 'email', 'profile'],
      pkceEnabled: true,
      responseType: 'code',
    };
  }

  initPromise = SocialLogin.initialize({
    google: e.googleWebClientId
      ? {
          webClientId: e.googleWebClientId,
          iOSClientId: e.googleIosClientId,
          mode: 'online',
        }
      : undefined,
    apple: e.appleClientId
      ? {
          clientId: e.appleClientId,
          redirectUrl: e.appleRedirectUrl,
        }
      : undefined,
    oauth2: Object.keys(oauth2).length ? oauth2 : undefined,
  }).then(() => {
    initialized = true;
  });
  return initPromise;
}

export async function login(provider: AuthProvider): Promise<ProviderToken> {
  await initSocialLogin();
  const e = env();

  if (provider === 'google') {
    if (!e.googleWebClientId) throw new Error('VITE_GOOGLE_WEB_CLIENT_ID not set');
    const res = await SocialLogin.login({
      provider: 'google',
      options: { scopes: ['email', 'profile'] },
    });
    if (res.provider !== 'google') throw new Error('google: unexpected response shape');
    if (res.result.responseType !== 'online') {
      // We initialize with mode:'online', so this branch shouldn't fire.
      throw new Error('google: offline response not supported in this flow');
    }
    const idToken = res.result.idToken;
    if (!idToken) throw new Error('google: no idToken returned');
    const profile = res.result.profile;
    const name =
      profile.name ??
      [profile.givenName, profile.familyName].filter(Boolean).join(' ') ??
      undefined;
    return { provider, idToken, name: name || undefined };
  }

  if (provider === 'apple') {
    if (!e.appleClientId) throw new Error('VITE_APPLE_CLIENT_ID not set');
    const res = await SocialLogin.login({
      provider: 'apple',
      options: { scopes: ['email', 'name'] },
    });
    if (res.provider !== 'apple') throw new Error('apple: unexpected response shape');
    const idToken = res.result.idToken;
    if (!idToken) throw new Error('apple: no idToken returned');
    const profile = res.result.profile;
    const name =
      [profile.givenName, profile.familyName].filter(Boolean).join(' ') || undefined;
    return { provider, idToken, name };
  }

  if (provider === 'microsoft') {
    if (!e.microsoftClientId) throw new Error('VITE_MICROSOFT_CLIENT_ID not set');
    const res = await SocialLogin.login({
      provider: 'oauth2',
      options: { providerId: MICROSOFT_PROVIDER_ID },
    });
    if (res.provider !== 'oauth2') throw new Error('microsoft: unexpected response shape');
    const idToken = res.result.idToken;
    if (!idToken) throw new Error('microsoft: no idToken returned (request `openid` scope)');
    return { provider, idToken };
  }

  throw new Error(`unsupported provider: ${provider}`);
}

export async function logout(provider: AuthProvider): Promise<void> {
  await initSocialLogin();
  try {
    if (provider === 'microsoft') {
      await SocialLogin.logout({ provider: 'oauth2', providerId: MICROSOFT_PROVIDER_ID });
    } else {
      await SocialLogin.logout({ provider });
    }
  } catch {
    // Logging out is best-effort — the local session is what actually matters.
  }
}
