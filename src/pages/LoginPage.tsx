import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShanShuiBackground } from '../components/ShanShuiBackground';
import { useApp } from '../contexts/AppContext';
import { api, setSessionToken } from '../lib/api';
import type { AuthProvider } from '../lib/social-login';

type Mode = 'main' | 'phone-login' | 'phone-register';

const OAUTH_PROVIDERS: { id: AuthProvider; label: string; bg: string; fg: string; icon: string }[] = [
  { id: 'apple', label: 'Apple', bg: '#000', fg: '#fff', icon: '' },
  { id: 'google', label: 'Google', bg: '#fff', fg: '#3c4043', icon: 'G' },
];

export function LoginPage() {
  const nav = useNavigate();
  const app = useApp();
  const [mode, setMode] = useState<Mode>('main');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oauthSignIn = async (provider: AuthProvider) => {
    setLoading(true);
    setError(null);
    try {
      const user = await app.signInWith(provider);
      nav(user.name ? '/app/chat' : '/userinfo', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const phoneRegister = async () => {
    if (!phone.trim() || !password.trim()) { setError('请填写手机号和密码'); return; }
    setLoading(true);
    setError(null);
    try {
      const resp = await api.phoneRegister(phone.replace(/\s+/g, ''), password);
      await setSessionToken(resp.token);
      nav(resp.user.name ? '/app/chat' : '/userinfo', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const phoneLogin = async () => {
    if (!phone.trim() || !password.trim()) { setError('请填写手机号和密码'); return; }
    setLoading(true);
    setError(null);
    try {
      const resp = await api.phoneLogin(phone.replace(/\s+/g, ''), password);
      await setSessionToken(resp.token);
      nav(resp.user.name ? '/app/chat' : '/userinfo', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const quickEntry = () => {
    localStorage.setItem('maipal.dev-bypass', 'true');
    window.location.href = '/app/chat';
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 48,
    borderRadius: 14,
    border: '1.5px solid rgba(123,140,118,0.3)',
    background: '#fff',
    padding: '0 16px',
    fontSize: 16,
    fontFamily: 'var(--font-sans)',
    color: '#2c2c2c',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const btnPrimary: React.CSSProperties = {
    width: '100%',
    height: 48,
    borderRadius: 14,
    background: '#7b8c76',
    color: '#fff',
    border: 'none',
    fontSize: 16,
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(123,140,118,0.3)',
  };

  return (
    <div className="app-frame mp-screen">
      <ShanShuiBackground />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: 'calc(var(--safe-top) + 40px) 24px calc(var(--safe-bottom) + 24px)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Logo */}
        <div className="anim-rise" style={{ textAlign: 'center', marginTop: 36, marginBottom: 32 }}>
          <div
            style={{
              width: 80,
              height: 80,
              margin: '0 auto 16px',
              borderRadius: 20,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 12px rgba(107,93,79,0.12)',
              border: '1.5px solid rgba(123,140,118,0.2)',
            }}
          >
            <p style={{ margin: 0, fontSize: 36, fontWeight: 700, color: '#7b8c76' }}>脉</p>
          </div>
          <h1 className="mp-h1" style={{ margin: 0, fontSize: 22 }}>欢迎来到脉伴</h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#6b5d4f' }}>
            {mode === 'main' ? '选择登录方式' : mode === 'phone-register' ? '注册新账号' : '手机号登录'}
          </p>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto' }}>

          {/* ─── Main mode: show all options ─── */}
          {mode === 'main' && (
            <>
              {/* Phone login/register buttons */}
              <button
                onClick={() => { setMode('phone-login'); setError(null); }}
                style={{ ...btnPrimary }}
              >
                📱 手机号登录
              </button>
              <button
                onClick={() => { setMode('phone-register'); setError(null); }}
                style={{ ...btnPrimary, background: '#fff', color: '#7b8c76', border: '1.5px solid #7b8c76', boxShadow: 'none' }}
              >
                ✨ 手机号注册
              </button>

              {/* OAuth row */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                {OAUTH_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => oauthSignIn(p.id)}
                    disabled={loading}
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 12,
                      background: p.bg,
                      color: p.fg,
                      border: p.bg === '#fff' ? '1px solid rgba(0,0,0,0.12)' : 'none',
                      fontSize: 14,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>

              {/* Quick entry */}
              <button
                onClick={quickEntry}
                style={{
                  width: '100%',
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(123,140,118,0.1)',
                  color: '#7b8c76',
                  border: 'none',
                  fontSize: 13,
                  cursor: 'pointer',
                  marginTop: 4,
                }}
              >
                ⚡ 快捷体验（无需登录）
              </button>
            </>
          )}

          {/* ─── Phone Login ─── */}
          {mode === 'phone-login' && (
            <>
              <input
                type="tel"
                placeholder="手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && phoneLogin()}
                style={inputStyle}
              />
              <button
                onClick={phoneLogin}
                disabled={loading}
                style={{ ...btnPrimary, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? '登录中…' : '登录'}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => { setMode('main'); setError(null); }} style={{ background: 'none', border: 'none', color: '#7b8c76', fontSize: 14, cursor: 'pointer' }}>← 返回</button>
                <button onClick={() => { setMode('phone-register'); setError(null); }} style={{ background: 'none', border: 'none', color: '#7b8c76', fontSize: 14, cursor: 'pointer' }}>去注册 →</button>
              </div>
            </>
          )}

          {/* ─── Phone Register ─── */}
          {mode === 'phone-register' && (
            <>
              <input
                type="tel"
                placeholder="手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="设置密码（至少4位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && phoneRegister()}
                style={inputStyle}
              />
              <button
                onClick={phoneRegister}
                disabled={loading}
                style={{ ...btnPrimary, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? '注册中…' : '注册并登录'}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => { setMode('main'); setError(null); }} style={{ background: 'none', border: 'none', color: '#7b8c76', fontSize: 14, cursor: 'pointer' }}>← 返回</button>
                <button onClick={() => { setMode('phone-login'); setError(null); }} style={{ background: 'none', border: 'none', color: '#7b8c76', fontSize: 14, cursor: 'pointer' }}>已有账号 →</button>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#d4183d', textAlign: 'center', background: 'rgba(255,255,255,0.9)', padding: '8px 12px', borderRadius: 12 }}>
              {error}
            </p>
          )}

          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b5d4f', textAlign: 'center', lineHeight: 1.5 }}>
            登录即表示同意《用户协议》与《隐私政策》
          </p>
        </div>
      </div>
    </div>
  );
}
