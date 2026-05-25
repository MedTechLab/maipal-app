import { useEffect, useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';

export type DateRecord = {
  detection?: { label: string; value: number; max: number }[];
  tasks?: string[];
};

type Props = {
  open: boolean;
  date: Date | null;
  record: DateRecord | null;
  onClose: () => void;
};

const DAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export function DateDetailSheet({ open, date, record, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [animIn, setAnimIn] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimIn(true)));
    } else {
      setAnimIn(false);
      const t = setTimeout(() => setVisible(false), 320);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!visible || !date) return null;

  const title = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  const weekday = DAY_NAMES[date.getDay()];

  return (
    <>
      <div
        onClick={onClose}
        style={{
          ...BACKDROP,
          opacity: animIn ? 1 : 0,
        }}
      />
      <div
        style={{
          ...SHEET,
          transform: animIn ? 'translateY(0)' : 'translateY(100%)',
        }}
      >
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(123,140,118,0.2)' }} />
        </div>

        {/* Header */}
        <div style={SHEET_HEADER}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#2a2a2a' }}>{title}</h3>
            <span style={{ fontSize: 13, color: '#9a8e80' }}>{weekday}</span>
          </div>
          <button onClick={onClose} style={CLOSE_BTN}>
            <X size={18} color="#5a4a3a" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '0 24px 32px', overflowY: 'auto', maxHeight: '50vh' }}>
          {(!record || (!record.detection?.length && !record.tasks?.length)) && (
            <p style={{ fontSize: 14, color: '#9a8e80', textAlign: 'center', padding: '24px 0' }}>
              当天暂无记录
            </p>
          )}

          {record?.detection && record.detection.length > 0 && (
            <div style={SECTION_HEALTH}>
              <h4 style={SECTION_TITLE}>🏥 健康检测</h4>
              {record.detection.map((item, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#5a4a3a' }}>{item.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>
                      {item.value}/{item.max}
                    </span>
                  </div>
                  <div style={PROGRESS_BG}>
                    <div
                      style={{
                        ...PROGRESS_FILL,
                        width: `${Math.min((item.value / item.max) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {record?.tasks && record.tasks.length > 0 && (
            <div style={SECTION_TASKS}>
              <h4 style={SECTION_TITLE}>✓ 完成任务</h4>
              {record.tasks.map((task, i) => (
                <div key={i} style={TASK_ROW}>
                  <div style={CHECK_CIRCLE}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span style={{ fontSize: 14, color: '#5a4a3a' }}>{task}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const BACKDROP: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 190,
  background: 'rgba(0,0,0,0.4)',
  transition: 'opacity 0.3s ease',
};
const SHEET: CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 191,
  background: '#fff',
  borderRadius: '24px 24px 0 0',
  boxShadow: '0 -8px 30px rgba(0,0,0,0.12)',
  transition: 'transform 0.3s ease',
  maxHeight: '70vh',
  display: 'flex',
  flexDirection: 'column',
};
const SHEET_HEADER: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '16px 24px 12px',
  borderBottom: '1px solid rgba(123,140,118,0.08)',
};
const CLOSE_BTN: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  border: 'none',
  background: 'rgba(123,140,118,0.1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};
const SECTION_HEALTH: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  background: 'linear-gradient(135deg, #f0fdf4, rgba(240,253,244,0.5))',
  border: '1px solid rgba(34,197,94,0.12)',
  marginBottom: 16,
  marginTop: 16,
};
const SECTION_TASKS: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  background: 'linear-gradient(135deg, #eff6ff, rgba(239,246,255,0.5))',
  border: '1px solid rgba(59,130,246,0.12)',
  marginBottom: 16,
  marginTop: 16,
};
const SECTION_TITLE: CSSProperties = {
  margin: '0 0 12px',
  fontSize: 14,
  fontWeight: 600,
  color: '#2a2a2a',
};
const PROGRESS_BG: CSSProperties = {
  height: 6,
  borderRadius: 3,
  background: 'rgba(34,197,94,0.12)',
  overflow: 'hidden',
};
const PROGRESS_FILL: CSSProperties = {
  height: '100%',
  borderRadius: 3,
  background: 'linear-gradient(90deg, #60a5fa, #2563eb)',
  transition: 'width 0.6s ease',
};
const TASK_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 0',
};
const CHECK_CIRCLE: CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 999,
  background: '#3b82f6',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
