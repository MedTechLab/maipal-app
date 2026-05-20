import { Settings } from 'lucide-react';

export function SettingsTile({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#f0e6dc',
        filter: 'drop-shadow(0 4px 4.75px rgba(185,185,185,0.23))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 66,
        width: 50,
        borderRadius: 10,
        cursor: 'pointer',
        gap: 2,
        border: 'none',
        padding: 0,
      }}
    >
      <Settings size={20} color="#7b8c76" strokeWidth={2} />
      <span style={{ fontSize: 12, color: '#5a4a3a' }}>设置</span>
    </button>
  );
}
