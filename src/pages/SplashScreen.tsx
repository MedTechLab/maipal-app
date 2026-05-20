import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

export function SplashScreen() {
  const nav = useNavigate();
  const { isAuthenticated, authLoading, user } = useApp();

  useEffect(() => {
    // Show the splash for at least 1.2s so it doesn't flash, then route based
    // on session state. While `authLoading` is true we just wait — the effect
    // re-fires when it flips false.
    if (authLoading) return;
    const t = setTimeout(() => {
      if (!isAuthenticated) {
        nav('/login', { replace: true });
      } else if (!user?.name) {
        nav('/userinfo', { replace: true });
      } else {
        nav('/app/chat', { replace: true });
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [nav, authLoading, isAuthenticated, user]);

  return (
    <div
      className="mp-screen"
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(180deg, #7b8c76 0%, #f5e6d3 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="anim-rise" style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 24,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            marginLeft: 'auto',
            marginRight: 'auto',
            boxShadow: '0 8px 16px rgba(107,93,79,0.15)',
            border: '1.5px solid rgba(123,140,118,0.2)',
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
          <p style={{ margin: 0, fontSize: 48, fontWeight: 700, color: '#7b8c76' }}>脉</p>
        </div>
        <h1
          style={{
            margin: '0 0 8px',
            fontSize: 32,
            fontWeight: 700,
            color: '#5a4a3a',
            fontFamily: 'var(--font-sans)',
          }}
        >
          MaiPal
        </h1>
        <p style={{ margin: 0, fontSize: 16, color: '#6b5d4f' }}>脉伴 · 您的中医健康管家</p>
      </div>
    </div>
  );
}
