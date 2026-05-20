import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, MessageCircle, Store } from 'lucide-react';

const TABS = [
  { id: 'summary', label: '调理', icon: Calendar, path: '/app/summary' },
  { id: 'chat', label: '脉医生', icon: MessageCircle, path: '/app/chat' },
  { id: 'store', label: '医馆', icon: Store, path: '/app/store' },
] as const;

export function MainLayout() {
  const loc = useLocation();
  const nav = useNavigate();
  const activeId =
    loc.pathname.includes('/summary') ? 'summary' :
    loc.pathname.includes('/store') ? 'store' :
    'chat';

  const pillLeft =
    activeId === 'summary' ? 'calc(16.67% - 37px)' :
    activeId === 'chat' ? 'calc(50% - 37px)' :
    'calc(83.33% - 37px)';

  return (
    <div
      className="app-frame"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Outlet />
      </div>
      <div className="mp-tabbar">
        <div className="pill" style={{ left: pillLeft }} />
        {TABS.map((t) => {
          const active = t.id === activeId;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={'mp-tab' + (active ? ' active' : '')}
              onClick={() => nav(t.path)}
            >
              <Icon size={20} color={active ? '#fff' : '#6B5D4F'} strokeWidth={2} />
              <span className="lbl">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
