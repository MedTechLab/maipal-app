type Props = {
  open: boolean;
  type: 'camera' | 'mic';
  onAllow: () => void;
  onDeny: () => void;
};

export function PermissionModal({ open, type, onAllow, onDeny }: Props) {
  if (!open) return null;
  const title = type === 'camera' ? '"脉伴"想访问您的相机' : '"脉伴"想访问您的麦克风';
  const detail =
    type === 'camera'
      ? '用于面部气色分析，帮助更好地了解您的健康状况'
      : '用于声音分析，帮助更好地了解您的健康状况';

  return (
    <>
      <div className="mp-backdrop" />
      <div className="mp-modal-wrap">
        <div
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 28,
            boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
            padding: '28px 26px 24px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 6,
              background: 'linear-gradient(90deg, #7b8c76, #D7C8B0)',
            }}
          />
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 20,
              fontWeight: 500,
              color: '#5a4a3a',
              textAlign: 'center',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {title}
          </h2>
          <p
            style={{
              margin: '0 0 24px',
              fontSize: 16,
              color: '#6b5d4f',
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            {detail}
          </p>
          <button
            onClick={onAllow}
            style={{
              width: '100%',
              height: 52,
              background: '#7b8c76',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              fontSize: 16,
              fontWeight: 500,
              boxShadow: '0 4px 6px rgba(107,93,79,0.15)',
              marginBottom: 8,
              cursor: 'pointer',
            }}
          >
            允许
          </button>
          <button
            onClick={onDeny}
            style={{
              width: '100%',
              height: 44,
              background: '#f8f3ee',
              color: '#6b5d4f',
              border: '1.18px solid rgba(123,140,118,0.2)',
              borderRadius: 999,
              fontSize: 16,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            不允许
          </button>
        </div>
      </div>
    </>
  );
}
