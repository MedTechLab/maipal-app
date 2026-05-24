// Worker runtime bindings. Kept separate from `types.ts` (which the React client
// imports) because it references Cloudflare-only globals (D1Database, Fetcher).
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SESSION_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  APPLE_CLIENT_ID?: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_TENANT?: string;

  // ── AI layer ──────────────────────────────────────────────
  // Secret: `wrangler secret put CODEBUDDY_API_KEY` (and .dev.vars locally).
  CODEBUDDY_API_KEY: string;
  // Optional model/voice overrides (wrangler.toml [vars]).
  CHAT_MODEL?: string;
  VISION_MODEL?: string;
  TTS_VOICE?: string;
}
