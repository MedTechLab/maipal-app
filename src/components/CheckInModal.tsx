import { useRef, useState, type CSSProperties } from 'react';
import { Camera, Gift, X } from 'lucide-react';

type Props = {
  open: boolean;
  onConfirm: (imageDataUrl: string) => void;
  onCancel: () => void;
};

export function CheckInModal({ open, onConfirm, onCancel }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (preview) {
      onConfirm(preview);
      setPreview(null);
    }
  };

  const handleClose = () => {
    setPreview(null);
    onCancel();
  };

  return (
    <>
      <div style={BACKDROP} onClick={handleClose} />
      <div style={MODAL}>
        {/* Top bar gradient */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(to right, #7b8c76, #D7C8B0)' }} />

        {/* Close button */}
        <button onClick={handleClose} style={CLOSE_BTN}>
          <X size={18} color="#5a4a3a" />
        </button>

        <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600, color: '#2a2a2a', textAlign: 'center' }}>
          打卡照片
        </h3>

        <div style={POINTS_HINT}>
          <Gift size={14} color="#d4a574" />
          <span>上传照片打卡获得 <strong style={{ color: '#d4a574' }}>10 积分</strong></span>
        </div>

        {/* Preview or upload area */}
        {preview ? (
          <div style={PREVIEW_WRAP}>
            <img src={preview} alt="预览" style={PREVIEW_IMG} />
            <button
              onClick={() => setPreview(null)}
              style={{ ...CLOSE_BTN, position: 'absolute', top: 8, right: 8 }}
            >
              <X size={14} color="#5a4a3a" />
            </button>
          </div>
        ) : (
          <div
            style={UPLOAD_AREA}
            onClick={() => inputRef.current?.click()}
          >
            <Camera size={32} color="#7b8c76" />
            <p style={{ margin: '8px 0 0', fontSize: 14, color: '#6b5d4f' }}>
              点击拍照或从相册选择
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button onClick={handleClose} style={BTN_CANCEL}>
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!preview}
            style={{
              ...BTN_CONFIRM,
              opacity: preview ? 1 : 0.5,
              cursor: preview ? 'pointer' : 'default',
            }}
          >
            确认打卡
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const BACKDROP: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 300,
  background: 'rgba(0,0,0,0.5)',
};
const MODAL: CSSProperties = {
  position: 'fixed',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 301,
  width: 'calc(100% - 56px)',
  maxWidth: 340,
  background: 'rgba(248,243,238,0.98)',
  backdropFilter: 'blur(4px)',
  borderRadius: 24,
  padding: '28px 24px 24px',
  boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
  overflow: 'hidden',
};
const CLOSE_BTN: CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  width: 28,
  height: 28,
  borderRadius: 999,
  border: 'none',
  background: 'rgba(255,255,255,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};
const POINTS_HINT: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  marginBottom: 16,
  fontSize: 14,
  color: '#6b5d4f',
};
const UPLOAD_AREA: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: 160,
  border: '2px dashed rgba(123,140,118,0.3)',
  borderRadius: 16,
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.5)',
  transition: 'border-color 0.2s',
};
const PREVIEW_WRAP: CSSProperties = {
  position: 'relative',
  borderRadius: 16,
  overflow: 'hidden',
  marginBottom: 4,
};
const PREVIEW_IMG: CSSProperties = {
  width: '100%',
  height: 180,
  objectFit: 'cover',
  borderRadius: 16,
  display: 'block',
};
const BTN_CANCEL: CSSProperties = {
  flex: 1,
  height: 48,
  borderRadius: 999,
  border: '1.18px solid rgba(123,140,118,0.25)',
  background: 'transparent',
  fontSize: 16,
  fontWeight: 500,
  color: '#6b5d4f',
  cursor: 'pointer',
};
const BTN_CONFIRM: CSSProperties = {
  flex: 1,
  height: 48,
  borderRadius: 999,
  border: 'none',
  background: '#7b8c76',
  fontSize: 16,
  fontWeight: 500,
  color: '#fff',
  boxShadow: '0 4px 8px rgba(123,140,118,0.25)',
};
