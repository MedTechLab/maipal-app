import type { Env } from './env';

const API_URL = 'https://copilot.tencent.com/v2/chat/completions';
const DEFAULT_CHAT_MODEL = 'claude-sonnet-4.6-1m';

// OpenAI-style message. `content` is a plain string for chat, or a content-part
// array for vision (text + image_url).
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

interface CallOpts {
  model?: string;
  stream?: boolean;
  responseFormat?: 'json_object';
}

// CodeBuddy answers the first POST with a 30x to a regional host. `fetch` follows
// redirects by default, but per spec a 301/302 turns a POST into a GET — which
// drops our body. So we follow manually and re-POST. (The v5 Node server does
// the same dance.)
async function postFollowing(body: string, key: string, maxHops = 3): Promise<Response> {
  let url = API_URL;
  for (let hop = 0; hop <= maxHops; hop++) {
    const res = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body,
    });
    if ([301, 302, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      url = new URL(loc, url).toString();
      continue;
    }
    return res;
  }
  throw new Error('CodeBuddy: too many redirects');
}

/** Low-level call. Returns the raw upstream Response (use for streaming). */
export function callCodeBuddy(
  env: Env,
  messages: LlmMessage[],
  opts: CallOpts = {},
): Promise<Response> {
  const payload: Record<string, unknown> = {
    model: opts.model ?? env.CHAT_MODEL ?? DEFAULT_CHAT_MODEL,
    messages,
    stream: opts.stream ?? false,
  };
  if (opts.responseFormat) payload.response_format = { type: opts.responseFormat };
  return postFollowing(JSON.stringify(payload), env.CODEBUDDY_API_KEY);
}

/** Non-streaming convenience: returns the assistant message text. */
export async function callCodeBuddyText(
  env: Env,
  messages: LlmMessage[],
  opts: CallOpts = {},
): Promise<string> {
  const res = await callCodeBuddy(env, messages, { ...opts, stream: false });
  if (!res.ok) {
    throw new Error(`CodeBuddy ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? '';
}
