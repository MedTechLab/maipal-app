import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShanShuiBackground } from '../components/ShanShuiBackground';
import { useApp } from '../contexts/AppContext';
import type { AuthProvider } from '../lib/social-login';

type ButtonState = { loading: AuthProvider | null; error: string | null };

const PROVIDERS: { id: AuthProvider; label: string; bg: string; fg: string; icon: string }[] = [
  { id: 'apple', label: '使用 Apple 登录', bg: '#000', fg: '#fff', icon: '' },
  { id: 'google', label: '使用 Google 登录', bg: '#fff', fg: '#3c4043', icon: 'G' },
  { id: 'microsoft', label: '使用 Microsoft 登录', bg: '#2f2f2f', fg: '#fff', icon: '⊞' },
];

export function LoginPage() {
  const nav = useNavigate();
  const app = useApp();
  const [state, setState] = useState<ButtonState>({ loading: null, error: null });

  const signIn = async (provider: AuthProvider) => {
    setState({ loading: provider, error: null });
    try {
      const user = await app.signInWith(provider);
      // First-time users have no profile yet — send them through onboarding.
      nav(user.name ? '/app/chat' : '/userinfo', { replace: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '登录失败，请重试';
      setState({ loading: null, error: msg });
    }
  };

  return (
    <div className="app-frame mp-screen">
      <ShanShuiBackground />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: 'calc(var(--safe-top) + 48px) 24px calc(var(--safe-bottom) + 32px)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="anim-rise" style={{ textAlign: 'center', marginTop: 48, marginBottom: 48 }}>
          <div
            style={{
              width: 96,
              height: 96,
              margin: '0 auto 20px',
              borderRadius: 24,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 16px rgba(107,93,79,0.15)',
              border: '1.5px solid rgba(123,140,118,0.2)',
            }}
          >
            <p style={{ margin: 0, fontSize: 40, fontWeight: 700, color: '#7b8c76' }}>脉</p>
          </div>
          <h1 className="mp-h1" style={{ margin: 0 }}>欢迎来到脉伴</h1>
          <p style={{ margin: '12px 0 0', fontSize: 15, color: '#6b5d4f', lineHeight: 1.5 }}>
            登录后，脉医生可以为你保存
            <br />
            健康记录、每日计划与积分
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto' }}>
          {PROVIDERS.map((p) => {
            const loading = state.loading === p.id;
            const disabled = state.loading !== null;
            return (
              <button
                key={p.id}
                onClick={() => signIn(p.id)}
                disabled={disabled}
                style={{
                  width: '100%',
                  height: 52,
                  borderRadius: 16,
                  background: p.bg,
                  color: p.fg,
                  border: p.bg === '#fff' ? '1.18px solid rgba(0,0,0,0.12)' : 'none',
                  fontSize: 16,
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  cursor: disabled ? 'default' : 'pointer',
                  opacity: disabled && !loading ? 0.5 : 1,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.08)',
                  transition: 'transform 120ms',
                }}
              >
                {p.icon && (
                  <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{p.icon}</span>
                )}
                <span>{loading ? '登录中…' : p.label}</span>
              </button>
            );
          })}

          {state.error && (
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 13,
                color: '#d4183d',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.9)',
                padding: '8px 12px',
                borderRadius: 12,
              }}
            >
              {state.error}
            </p>
          )}

          <p
            style={{
              margin: '12px 0 0',
              fontSize: 12,
              color: '#6b5d4f',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            登录即表示同意《用户协议》与《隐私政策》
          </p>
        </div>
      </div>
    </div>
  );
}
