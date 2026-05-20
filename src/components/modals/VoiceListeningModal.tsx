import { Mic, X } from 'lucide-react';

type State = 'ready' | 'recording' | 'done';

type Props = {
  open: boolean;
  state: State;
  onStart: () => void;
  onSkip: () => void;
  time: number;
};

export function VoiceListeningModal({ open, state, onStart, onSkip, time }: Props) {
  if (!open) return null;
  const label =
    state === 'ready' ? '点击开始' : state === 'recording' ? '正在听…' : '好了，我们继续';
  const mm = String(Math.floor(time / 60)).padStart(2, '0');
  const ss = String(time % 60).padStart(2, '0');

  return (
    <>
      <div className="mp-backdrop" onClick={onSkip} />
      <div className="mp-modal-wrap" style={{ maxWidth: 320 }}>
        <div
          style={{
            background: 'rgba(248,243,238,0.95)',
            borderRadius: 28,
            padding: 24,
            boxShadow: '0 12px 28px rgba(107,93,79,0.25)',
            position: 'relative',
          }}
        >
          <button
            onClick={onSkip}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.6)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} color="#5a4a3a" />
          </button>

          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 500, color: '#7b8c76' }}>
              听听您的声音
            </h2>
            <p style={{ margin: 0, fontSize: 15, color: '#6b5d4f' }}>请自然读出这句话</p>
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.9)',
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 4px 8px rgba(107,93,79,0.06)',
              marginBottom: 12,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 500,
                color: '#5a4a3a',
                textAlign: 'center',
                lineHeight: 1.55,
              }}
            >
              今天天气很好，
              <br />
              我现在感觉还可以。
            </p>
          </div>
          <p
            style={{
              margin: '0 0 24px',
              fontSize: 13,
              color: 'rgba(107,93,79,0.7)',
              textAlign: 'center',
            }}
          >
            用平时说话的方式读就好
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            <div style={{ position: 'relative' }}>
              {state === 'recording' && (
                <div
                  className="anim-glow"
                  style={{
                    position: 'absolute',
                    inset: -16,
                    borderRadius: 999,
                    background: '#7b8c76',
                  }}
                />
              )}
              <button
                onClick={state === 'ready' ? onStart : undefined}
                disabled={state !== 'ready'}
                className={state === 'recording' ? 'anim-breath' : ''}
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 999,
                  background: '#7b8c76',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6px 12px rgba(107,93,79,0.2)',
                  position: 'relative',
                  cursor: state === 'ready' ? 'pointer' : 'default',
                }}
              >
                <Mic size={32} color="#fff" />
              </button>
            </div>
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 15, color: '#6b5d4f' }}>{label}</p>
              {state === 'recording' && (
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7b8c76' }}>
                  {mm}:{ss}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onSkip}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.8)',
              color: '#6b5d4f',
              border: 'none',
              fontSize: 15,
              fontWeight: 500,
              padding: '14px 0',
              borderRadius: 16,
              boxShadow: '0 4px 6px rgba(107,93,79,0.08)',
              cursor: 'pointer',
            }}
          >
            稍后再说
          </button>
        </div>
      </div>
    </>
  );
}
