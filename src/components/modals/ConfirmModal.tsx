type Props = {
  open: boolean;
  title: string;
  body: string;
  primary: string;
  secondary: string;
  onPrimary: () => void;
  onSecondary: () => void;
};

export function ConfirmModal({
  open,
  title,
  body,
  primary,
  secondary,
  onPrimary,
  onSecondary,
}: Props) {
  if (!open) return null;
  return (
    <>
      <div className="mp-backdrop" onClick={onSecondary} />
      <div className="mp-modal-wrap" style={{ maxWidth: 340 }}>
        <div
          style={{
            background: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 20,
            padding: 24,
            boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
            border: '1.18px solid rgba(111,184,153,0.15)',
          }}
        >
          <h3
            style={{
              margin: '0 0 12px',
              fontSize: 20,
              fontWeight: 700,
              color: '#000',
              fontFamily: 'var(--font-display)',
            }}
          >
            {title}
          </h3>
          <p style={{ margin: '0 0 24px', fontSize: 15, color: '#6b5d4f', lineHeight: 1.6 }}>
            {body}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onSecondary}
              style={{
                flex: 1,
                padding: '12px 0',
                borderRadius: 999,
                border: '1.18px solid rgba(111,184,153,0.3)',
                background: 'transparent',
                fontSize: 16,
                fontWeight: 500,
                color: '#6b5d4f',
                cursor: 'pointer',
              }}
            >
              {secondary}
            </button>
            <button onClick={onPrimary} className="mp-btn-pri" style={{ flex: 1 }}>
              {primary}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
