import { useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type CalendarRecord = {
  hasDetection: boolean;
  tasksCompleted: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  records: Map<string, CalendarRecord>;
  onSelectDate: (date: Date) => void;
};

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MonthCalendar({ open, onClose, records, onSelectDate }: Props) {
  const [viewMonth, setViewMonth] = useState(() => new Date());

  if (!open) return null;

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startWeekday = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const todayStr = dateKey(today);

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setViewMonth(new Date(year, month + 1, 1));

  // Gather recent records for the list
  const recentRecords: { date: Date; record: CalendarRecord }[] = [];
  records.forEach((rec, key) => {
    const [y, m] = key.split('-').map(Number);
    if (y === year && m === month + 1) {
      const d = Number(key.split('-')[2]);
      recentRecords.push({ date: new Date(y, m - 1, d), record: rec });
    }
  });
  recentRecords.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div style={OVERLAY}>
      {/* Header */}
      <div style={HEADER}>
        <button onClick={onClose} style={BACK_BTN}>
          <ChevronLeft size={20} color="#5a4a3a" />
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#2a2a2a' }}>健康日历</h1>
        <div style={{ width: 36 }} />
      </div>

      {/* Month selector */}
      <div style={MONTH_SEL}>
        <button onClick={prevMonth} style={NAV_BTN}>
          <ChevronLeft size={18} color="#6b5d4f" />
        </button>
        <span style={{ fontSize: 17, fontWeight: 600, color: '#2a2a2a' }}>
          {year}年{month + 1}月
        </span>
        <button onClick={nextMonth} style={NAV_BTN}>
          <ChevronRight size={18} color="#6b5d4f" />
        </button>
      </div>

      {/* Day labels */}
      <div style={GRID_HEADER}>
        {DAY_LABELS.map((l) => (
          <span key={l} style={{ fontSize: 12, color: '#9a8e80', textAlign: 'center' }}>
            {l}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div style={GRID}>
        {cells.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />;
          const key = dateKey(d);
          const isToday = key === todayStr;
          const rec = records.get(key);
          return (
            <button
              key={key}
              onClick={() => onSelectDate(d)}
              style={{
                ...CELL,
                background: isToday ? '#7b8c76' : rec ? 'rgba(111,184,153,0.15)' : 'transparent',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 500, color: isToday ? '#fff' : '#2a2a2a' }}>
                {d.getDate()}
              </span>
              {rec && (
                <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                  {rec.hasDetection && <div style={{ ...DOT, background: '#22c55e' }} />}
                  {rec.tasksCompleted > 0 && <div style={{ ...DOT, background: '#3b82f6' }} />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={LEGEND}>
        <div style={LEGEND_ITEM}>
          <div style={{ ...DOT, background: '#22c55e' }} />
          <span style={{ fontSize: 12, color: '#6b5d4f' }}>有检测</span>
        </div>
        <div style={LEGEND_ITEM}>
          <div style={{ ...DOT, background: '#3b82f6' }} />
          <span style={{ fontSize: 12, color: '#6b5d4f' }}>完成任务</span>
        </div>
      </div>

      {/* Recent records */}
      <div style={{ padding: '0 24px', flex: 1, overflowY: 'auto' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#5a4a3a', margin: '16px 0 10px' }}>
          本月记录
        </h3>
        {recentRecords.length === 0 && (
          <p style={{ fontSize: 13, color: '#9a8e80' }}>暂无记录</p>
        )}
        {recentRecords.map(({ date, record }) => (
          <div
            key={dateKey(date)}
            onClick={() => onSelectDate(date)}
            style={RECORD_ROW}
          >
            <div style={RECORD_DATE_BADGE}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#2a2a2a' }}>{date.getDate()}</span>
              <span style={{ fontSize: 10, color: '#9a8e80' }}>{month + 1}月</span>
            </div>
            <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {record.hasDetection && (
                <span style={{ ...TAG, background: '#dcfce7', color: '#15803d' }}>健康检测</span>
              )}
              {record.tasksCompleted > 0 && (
                <span style={{ ...TAG, background: '#dbeafe', color: '#1d4ed8' }}>
                  完成{record.tasksCompleted}项任务
                </span>
              )}
            </div>
            <ChevronRight size={16} color="#9a8e80" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const OVERLAY: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 180,
  background: '#faf5f0',
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
};
const HEADER: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid rgba(123,140,118,0.1)',
};
const BACK_BTN: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: 'none',
  background: 'rgba(123,140,118,0.1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};
const MONTH_SEL: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 20,
  padding: '16px 0',
};
const NAV_BTN: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  border: '1px solid rgba(123,140,118,0.2)',
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};
const GRID_HEADER: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  padding: '0 24px 8px',
};
const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 4,
  padding: '0 24px 16px',
};
const CELL: CSSProperties = {
  aspectRatio: '1/1',
  borderRadius: 12,
  border: 'none',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
};
const DOT: CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: 999,
};
const LEGEND: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 20,
  padding: '4px 0 12px',
  borderBottom: '1px solid rgba(123,140,118,0.08)',
};
const LEGEND_ITEM: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};
const RECORD_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 0',
  borderBottom: '1px solid rgba(123,140,118,0.06)',
  cursor: 'pointer',
};
const RECORD_DATE_BADGE: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 12,
  background: 'rgba(111,184,153,0.1)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
const TAG: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  padding: '3px 8px',
  borderRadius: 999,
};
