import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Send } from 'lucide-react';
import { ShanShuiBackground } from '../components/ShanShuiBackground';
import { SettingsTile } from '../components/SettingsTile';
import { ShiqingButton } from '../components/ShiqingButton';
import { DoctorAvatar } from '../components/DoctorAvatar';
import { useApp } from '../contexts/AppContext';
import { startRecognition, type SttController } from '../lib/stt';

export function ChatPage() {
  const nav = useNavigate();
  const app = useApp();
  const { user, messages, streaming, sendUserMessage, healthReport } = app;

  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sttRef = useRef<SttController | null>(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  useEffect(() => () => sttRef.current?.stop(), []);

  const send = (txt: string) => {
    const t = txt.trim();
    if (!t || streaming) return;
    sendUserMessage(t);
    setInput('');
  };

  const toggleMic = () => {
    if (listening) {
      sttRef.current?.stop();
      sttRef.current = null;
      setListening(false);
      return;
    }
    const ctrl = startRecognition({
      onPartial: (text) => setInput(text),
      onEnd: () => {
        sttRef.current = null;
        setListening(false);
      },
      onError: () => {
        sttRef.current = null;
        setListening(false);
      },
    });
    if (ctrl) {
      sttRef.current = ctrl;
      setListening(true);
    }
  };

  const lastMsg = messages[messages.length - 1];
  const showThinking = streaming && lastMsg?.role === 'assistant' && !lastMsg.content;

  return (
    <div className="app-frame" style={{ position: 'relative' }}>
      <ShanShuiBackground />

      <div className="shanshui-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p className="mp-h1" style={{ margin: 0 }}>你好，{user?.name || '朋友'}</p>
          <p className="mp-h1" style={{ margin: 0 }}>我是脉大夫</p>
        </div>
        <SettingsTile />
      </div>

      <div
        style={{
          position: 'absolute',
          top: 240,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        <DoctorAvatar height={360} />
      </div>

      <div
        ref={scrollerRef}
        className="chat-scroll"
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          top: 145,
          bottom: 100,
          overflowY: 'auto',
          zIndex: 30,
        }}
      >
        <div
          style={{
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: 12,
            padding: '16px 4px',
          }}
        >
          {messages.map((m, idx) => {
            const old = idx < messages.length - 3;
            const opacity = old && m.role === 'assistant' ? 0.65 : 1;
            if (m.role === 'assistant' && !m.content) return null;
            return (
              <div
                key={m.id}
                className="anim-rise"
                style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                  opacity,
                }}
              >
                <div className={m.role === 'user' ? 'bubble-user' : 'bubble-ai'}>{m.content}</div>
              </div>
            );
          })}

          {showThinking && (
            <div className="anim-rise" style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div className="bubble-ai" style={{ letterSpacing: 2 }}>···</div>
            </div>
          )}

          {healthReport && (
            <div
              className="anim-rise"
              style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}
            >
              <ShiqingButton onClick={() => nav('/app/summary')}>查看检测报告</ShiqingButton>
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'absolute', left: 24, right: 24, bottom: 14, zIndex: 40 }}>
        <div style={{ position: 'relative', height: 51, display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255,255,255,0.5)',
              borderRadius: 999,
              boxShadow: '0 4px 8px rgba(107,93,79,0.05)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 4,
              right: 50,
              top: 3,
              bottom: 3,
              background: '#fff',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              gap: 8,
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send(input)}
              placeholder={streaming ? '脉大夫正在回复…' : '输入您的回答...'}
              disabled={streaming}
              style={{
                flex: 1,
                background: 'transparent',
                outline: 'none',
                border: 'none',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                color: 'rgba(42,42,42,0.85)',
                minWidth: 0,
              }}
            />
            <button
              onClick={toggleMic}
              style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}
              aria-label="语音输入"
            >
              <Mic size={20} color={listening ? '#c2473d' : '#7B8C76'} />
            </button>
          </div>
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            aria-label="发送"
            style={{
              position: 'absolute',
              right: -2,
              width: 40,
              height: 40,
              borderRadius: 999,
              background: '#D7C8B0',
              color: '#fff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: input.trim() && !streaming ? 1 : 0.6,
              cursor: input.trim() && !streaming ? 'pointer' : 'default',
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
