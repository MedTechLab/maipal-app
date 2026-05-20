import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Send } from 'lucide-react';
import { ShanShuiBackground } from '../components/ShanShuiBackground';
import { SettingsTile } from '../components/SettingsTile';
import { QuickChip } from '../components/QuickChip';
import { ShiqingButton } from '../components/ShiqingButton';
import { useApp } from '../contexts/AppContext';

export function ChatPage() {
  const nav = useNavigate();
  const app = useApp();
  const { user, messages, addMessage } = app;

  const [input, setInput] = useState('');
  const [step, setStep] = useState<0 | 2 | 3 | 4>(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (step === 2) {
      const t = setTimeout(() => {
        addMessage('assistant', '我看您今天气色略偏淡，声音也略显疲惫。最近睡眠怎么样？');
        setStep(3);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [step, addMessage]);

  const send = (txt: string) => {
    if (!txt.trim()) return;
    addMessage('user', txt);
    setInput('');
    setTimeout(() => {
      if (step === 0 && txt.includes('需要') && !txt.includes('不需要')) {
        addMessage('assistant', '我先看看你的气色。');
        setTimeout(() => app.runCheckup(() => setStep(2)), 700);
      } else if (step === 0 && txt.includes('不需要')) {
        addMessage('assistant', '好的，有需要随时来找我，我会一直陪伴着你。😊');
      } else if (step === 3) {
        if (txt.includes('睡') || txt.includes('失眠') || txt.includes('不太好')) {
          addMessage('assistant', '了解了。建议您每晚11点前入睡，睡前可以泡泡脚放松身心。');
        } else {
          addMessage('assistant', '感谢您的回答。');
        }
        setTimeout(() => {
          addMessage('assistant', '检测完成！我已经为您准备了详细的健康建议。');
          setStep(4);
        }, 1200);
      } else {
        addMessage('assistant', '我明白了，让我继续为您分析。');
      }
    }, 700);
  };

  const showQuickReply = step === 0 || step === 3;

  return (
    <div className="app-frame" style={{ position: 'relative' }}>
      <ShanShuiBackground />

      <div className="shanshui-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p className="mp-h1" style={{ margin: 0 }}>你好，{user?.name || '朋友'}</p>
          <p className="mp-h1" style={{ margin: 0 }}>我是脉医生</p>
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
        <img
          src="/assets/doctor-maipal.png"
          alt="脉医生"
          style={{ height: 360, width: 170, objectFit: 'contain', objectPosition: 'bottom' }}
        />
      </div>

      <div
        ref={scrollerRef}
        className="chat-scroll"
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          top: 145,
          bottom: showQuickReply ? 130 : 100,
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
                <div className={m.role === 'user' ? 'bubble-user' : 'bubble-ai'}>
                  {m.content}
                </div>
              </div>
            );
          })}
          {step === 4 && (
            <div
              className="anim-rise"
              style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}
            >
              <ShiqingButton onClick={() => nav('/app/summary')}>查看检测报告</ShiqingButton>
            </div>
          )}
        </div>
      </div>

      {showQuickReply && (
        <div
          className="anim-rise"
          style={{
            position: 'absolute',
            left: 24,
            right: 24,
            bottom: 70,
            zIndex: 40,
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
          }}
        >
          {step === 0 && (
            <>
              <QuickChip onClick={() => send('需要检测')} dot>需要检测</QuickChip>
              <QuickChip onClick={() => send('暂时不需要')}>暂时不需要</QuickChip>
            </>
          )}
          {step === 3 && (
            <>
              <QuickChip onClick={() => send('睡眠不太好')} dot>睡眠不太好</QuickChip>
              <QuickChip onClick={() => send('还可以')}>还可以</QuickChip>
            </>
          )}
        </div>
      )}

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
              placeholder="输入您的回答..."
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
              style={{
                background: 'transparent',
                border: 'none',
                padding: 4,
                cursor: 'pointer',
              }}
              aria-label="语音"
            >
              <Mic size={20} color="#7B8C76" />
            </button>
          </div>
          <button
            onClick={() => send(input)}
            disabled={!input.trim()}
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
              opacity: input.trim() ? 1 : 0.6,
              cursor: input.trim() ? 'pointer' : 'default',
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
