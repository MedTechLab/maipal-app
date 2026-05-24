import type { Env } from './env';

// Microsoft Edge "read aloud" TTS — the same free endpoint the `edge-tts` Python
// library (used by the v5 server) drives. We talk to it directly over a WebSocket
// from the Worker instead of shelling out to Python.
//
// Caveat: this is an undocumented endpoint and Microsoft rotates the auth token
// scheme periodically. When it breaks, the route returns 5xx and the client
// falls back to the browser's speechSynthesis. Keep that fallback working.

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
// Workers' fetch-based WebSocket upgrade requires an http(s) scheme (the runtime
// upgrades it to wss); a literal wss:// URL is rejected with "Fetch API cannot load".
const WS_CONNECT_BASE =
  'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const GEC_VERSION = '1-130.0.2849.68';
const DEFAULT_VOICE = 'zh-CN-YunjianNeural';
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const MAX_CHARS = 2000;
const TIMEOUT_MS = 15000;

const WIN_EPOCH_SECONDS = 11644473600;
const FIVE_MIN_SECONDS = 300;

// Sec-MS-GEC: SHA-256 of (FILETIME-ticks-rounded-to-5min + trusted token),
// uppercased hex. Ticks are 100ns units since 1601.
//
// IMPORTANT: edge-tts computes this in float64 and the final value (~1.3e17)
// exceeds 2^53, so it is *rounded* to the nearest representable double. We must
// reproduce that same rounding (Number, not BigInt) or Microsoft returns 403.
async function generateSecMsGec(): Promise<string> {
  let ticks = Date.now() / 1000 + WIN_EPOCH_SECONDS;
  ticks -= ticks % FIVE_MIN_SECONDS;
  ticks *= 1e7;
  const ticksStr = ticks.toFixed(0);
  const bytes = new TextEncoder().encode(ticksStr + TRUSTED_CLIENT_TOKEN);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function edgeDateString(): string {
  // edge-tts format: "Sat May 24 2026 12:00:00 GMT+0000 (Coordinated Universal Time)"
  const d = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${p(d.getUTCDate())} ` +
    `${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} ` +
    `GMT+0000 (Coordinated Universal Time)`
  );
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function configMessage(): string {
  const config = {
    context: {
      synthesis: {
        audio: {
          metadataoptions: {
            sentenceBoundaryEnabled: 'false',
            wordBoundaryEnabled: 'true',
          },
          outputFormat: OUTPUT_FORMAT,
        },
      },
    },
  };
  return (
    `X-Timestamp:${edgeDateString()}\r\n` +
    `Content-Type:application/json; charset=utf-8\r\n` +
    `Path:speech.config\r\n\r\n` +
    JSON.stringify(config)
  );
}

function ssmlMessage(text: string, voice: string, requestId: string): string {
  const ssml =
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
    `<voice name='${voice}'>` +
    `<prosody pitch='-8Hz' rate='-10%' volume='+0%'>${xmlEscape(text)}</prosody>` +
    `</voice></speak>`;
  return (
    `X-RequestId:${requestId}\r\n` +
    `Content-Type:application/ssml+xml\r\n` +
    `X-Timestamp:${edgeDateString()}Z\r\n` +
    `Path:ssml\r\n\r\n` +
    ssml
  );
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/** Synthesize `text` to MP3 bytes. Throws on any failure (caller returns 5xx). */
export async function synthesizeSpeech(env: Env, text: string): Promise<Uint8Array> {
  const clean = text.trim().slice(0, MAX_CHARS);
  if (!clean) throw new Error('TTS: empty text');

  const voice = env.TTS_VOICE || DEFAULT_VOICE;
  const requestId = crypto.randomUUID().replace(/-/g, '');
  const connectionId = crypto.randomUUID().replace(/-/g, '');
  const gec = await generateSecMsGec();

  const url =
    `${WS_CONNECT_BASE}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${GEC_VERSION}` +
    `&ConnectionId=${connectionId}`;

  const resp = await fetch(url, {
    headers: {
      Upgrade: 'websocket',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
      Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.9',
      Pragma: 'no-cache',
      'Cache-Control': 'no-cache',
    },
  });
  const ws = resp.webSocket;
  if (!ws) {
    throw new Error(`TTS: WebSocket not established (status ${resp.status})`);
  }
  ws.accept();

  return await new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* already closed */ }
      fn();
    };
    const timer = setTimeout(
      () => finish(() => reject(new Error('TTS: timeout'))),
      TIMEOUT_MS,
    );

    ws.addEventListener('message', (event: MessageEvent) => {
      const data = event.data;
      if (typeof data === 'string') {
        if (data.includes('Path:turn.end')) {
          finish(() =>
            chunks.length
              ? resolve(concatChunks(chunks))
              : reject(new Error('TTS: no audio received')),
          );
        }
        return;
      }
      // Binary frame: 2-byte big-endian header length, header text, then MP3.
      const buf = data as ArrayBuffer;
      if (buf.byteLength < 2) return;
      const headerLen = new DataView(buf).getUint16(0);
      const header = new TextDecoder().decode(new Uint8Array(buf, 2, headerLen));
      if (header.includes('Path:audio')) {
        chunks.push(new Uint8Array(buf, 2 + headerLen));
      }
    });

    ws.addEventListener('close', () => {
      finish(() =>
        chunks.length
          ? resolve(concatChunks(chunks))
          : reject(new Error('TTS: closed before audio')),
      );
    });

    ws.addEventListener('error', () => {
      finish(() => reject(new Error('TTS: websocket error')));
    });

    try {
      ws.send(configMessage());
      ws.send(ssmlMessage(clean, voice, requestId));
    } catch (e) {
      finish(() => reject(e instanceof Error ? e : new Error('TTS: send failed')));
    }
  });
}
