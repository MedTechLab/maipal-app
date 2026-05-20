import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

type Props = {
  children: ReactNode;
  onClick: () => void;
  dot?: boolean;
};

export function QuickChip({ children, onClick, dot }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.9)',
        boxShadow: '0 4px 4px rgba(107,93,79,0.1)',
        height: 36,
        borderRadius: 999,
        display: 'flex',
        alignItems: 'center',
        padding: dot ? '0 14px 0 6px' : '0 16px',
        gap: 6,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        border: 'none',
      }}
    >
      {dot && (
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: '#7b8c76',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={12} color="#fff" strokeWidth={3} />
        </div>
      )}
      <span style={{ fontSize: 14, color: '#5a4a3a' }}>{children}</span>
    </button>
  );
}
