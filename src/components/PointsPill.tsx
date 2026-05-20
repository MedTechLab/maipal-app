import { Gift } from 'lucide-react';

export function PointsPill({ points }: { points: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(240,230,220,0.8)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        padding: '8px 16px',
        borderRadius: 999,
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
        border: '1.18px solid rgba(123,140,118,0.1)',
      }}
    >
      <Gift size={20} color="#7b8c76" strokeWidth={2} />
      <span style={{ fontSize: 16, fontWeight: 500, color: '#5a4a3a' }}>
        {points} 积分
      </span>
    </div>
  );
}
