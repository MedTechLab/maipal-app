import { X } from 'lucide-react';

type State = 'ready' | 'observing' | 'holding' | 'done';
type Kind = 'face' | 'tongue';

type Props = {
  open: boolean;
  state: State;
  kind?: Kind;
  onStart: () => void;
  onClose: () => void;
};

const TEXTS: Record<State, { main: string; sub: string }> = {
  ready: { main: '脉大夫准备看一看', sub: '建议在光线自然的环境下进行' },
  observing: { main: '脉大夫正在观察中…', sub: '请放松，不需要刻意调整' },
  holding: { main: '很好，保持一下', sub: '自然看向屏幕就好' },
  done: { main: '好了，我们继续聊聊', sub: '谢谢配合，我已经大致看过了' },
};

const PROGRESS: Record<State, number> = { ready: 0, observing: 1, holding: 2, done: 3 };

export function FaceObservationModal({ open, state, kind = 'face', onStart, onClose }: Props) {
  if (!open) return null;
  const t = TEXTS[state];
  const isTongue = kind === 'tongue';
  const heading = isTongue ? '我看看您的舌头' : '我先看看您的气色';
  const subheading = isTongue ? '请伸出舌头，正对屏幕' : '请看向屏幕，保持自然表情';
  const frameHint = isTongue ? '请将舌头保持在框内' : '请将面部保持在框内';
  const btnDisabled = state === 'observing' || state === 'holding';
  const btnLabel = state === 'ready' ? '开始' : state === 'done' ? '继续聊天' : '正在看…';
  const progressIdx = PROGRESS[state];

  return (
    <>
      <div className="mp-backdrop" onClick={onClose} />
      <div className="mp-modal-wrap" style={{ maxWidth: 320 }}>
        <div
          style={{
            background: 'rgba(248,243,238,0.95)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 28,
            padding: 24,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 12px 28px rgba(107,93,79,0.25)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 1,
              width: 32,
              height: 32,
              borderRadius: 999,
              border: 'none',
              background: 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
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
              {heading}
            </h2>
            <p style={{ margin: 0, fontSize: 15, color: '#6b5d4f' }}>{subheading}</p>
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 220,
              borderRadius: 22,
              overflow: 'hidden',
              background: 'linear-gradient(135deg, rgba(215,200,176,0.4), rgba(123,140,118,0.2))',
              boxShadow: 'inset 0 2px 12px rgba(0,0,0,.05)',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                className={btnDisabled ? 'anim-breath' : ''}
                style={{
                  width: 140,
                  height: 170,
                  borderRadius: 28,
                  border: '2px dashed rgba(215,200,176,0.8)',
                  position: 'relative',
                  boxShadow: '0 0 0 2px rgba(215,200,176,0.2)',
                }}
              />
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.3)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                color: '#fff',
                padding: '6px 14px',
                borderRadius: 999,
                fontSize: 13,
              }}
            >
              {frameHint}
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.8)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              borderRadius: 18,
              padding: 14,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              boxShadow: '0 4px 8px rgba(107,93,79,0.08)',
              marginBottom: 18,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                overflow: 'hidden',
                flexShrink: 0,
                background: '#f8f3ee',
              }}
            >
              <img
                src="/assets/doctor-maipal.png"
                alt="脉医生"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center 6%',
                  transform: 'scale(1.6) translateY(8px)',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 500, color: '#5a4a3a' }}>
                {t.main}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(107,93,79,0.8)' }}>{t.sub}</p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 18,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: i <= progressIdx ? '#7b8c76' : 'rgba(215,200,176,0.4)',
                }}
              />
            ))}
          </div>

          <button
            onClick={state === 'ready' ? onStart : state === 'done' ? onClose : undefined}
            disabled={btnDisabled}
            style={{
              width: '100%',
              background: '#7b8c76',
              color: '#fff',
              border: 'none',
              fontSize: 16,
              fontWeight: 500,
              padding: '14px 0',
              borderRadius: 16,
              boxShadow: '0 4px 8px rgba(107,93,79,0.2)',
              opacity: btnDisabled ? 0.5 : 1,
              cursor: btnDisabled ? 'default' : 'pointer',
            }}
          >
            {btnLabel}
          </button>
        </div>
      </div>
    </>
  );
}
