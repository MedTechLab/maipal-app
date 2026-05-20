import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShanShuiBackground } from '../components/ShanShuiBackground';
import { useApp, type User } from '../contexts/AppContext';

const CONCERNS = [
  { id: 'diet', label: '饮食调理', icon: '🍽️' },
  { id: 'sleep', label: '睡眠质量', icon: '😴' },
  { id: 'exercise', label: '运动健康', icon: '🏃' },
  { id: 'emotion', label: '情绪管理', icon: '🧘' },
];

export function UserInfoPage() {
  const nav = useNavigate();
  const app = useApp();
  const [name, setName] = useState('小芳');
  const [gender, setGender] = useState<'' | 'male' | 'female'>('');
  const [age, setAge] = useState('52');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [concerns, setConcerns] = useState<Set<string>>(new Set(['sleep']));
  const [err, setErr] = useState<{ name?: boolean; gender?: boolean; age?: boolean }>({});

  const toggleConcern = (id: string) => {
    const s = new Set(concerns);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setConcerns(s);
  };

  const submit = () => {
    const e = {
      name: !name.trim(),
      gender: !gender,
      age: !age || +age <= 0,
    };
    setErr(e);
    if (Object.values(e).some(Boolean)) return;
    const u: User = {
      name: name.trim(),
      gender: gender as 'male' | 'female',
      age: +age,
      height: height ? +height : undefined,
      weight: weight ? +weight : undefined,
      concerns: [...concerns],
    };
    app.setUser(u);
    nav('/app/chat');
  };

  const Input = ({
    value,
    onChange,
    placeholder,
    errKey,
    suffix,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    errKey?: 'name' | 'age';
    suffix?: string;
  }) => (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        inputMode="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          if (errKey) setErr({ ...err, [errKey]: false });
        }}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.97)',
          padding: suffix ? '14px 36px 14px 16px' : '14px 16px',
          borderRadius: 16,
          fontSize: 16,
          color: '#2a2a2a',
          outline: 'none',
          border: `1.18px solid ${
            errKey && err[errKey] ? '#d4183d' : 'rgba(111,184,153,0.15)'
          }`,
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          fontFamily: 'var(--font-sans)',
        }}
      />
      {suffix && (
        <span
          style={{
            position: 'absolute',
            right: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 14,
            color: '#6b5d4f',
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  );

  const genderBtn = (g: 'male' | 'female', glyph: string, label: string) => (
    <button
      onClick={() => {
        setGender(g);
        setErr({ ...err, gender: false });
      }}
      style={{
        flex: 1,
        padding: '16px 0',
        borderRadius: 16,
        fontSize: 16,
        fontWeight: 500,
        background: gender === g ? '#7b8c76' : 'rgba(255,255,255,0.97)',
        color: gender === g ? '#fff' : '#6b5d4f',
        border: `1.18px solid ${
          err.gender ? '#d4183d' : gender === g ? '#7b8c76' : 'rgba(111,184,153,0.15)'
        }`,
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {glyph} {label}
    </button>
  );

  return (
    <div className="app-frame mp-screen">
      <ShanShuiBackground />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: 'calc(var(--safe-top) + 12px) 24px 110px',
          height: '100%',
          overflowY: 'auto',
        }}
      >
        <div className="anim-rise" style={{ marginBottom: 32 }}>
          <h1 className="mp-h1">完善个人信息</h1>
          <p style={{ margin: '8px 0 0', fontSize: 16, color: '#6b5d4f' }}>
            帮助脉医生更好地了解你
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 16,
                fontWeight: 500,
                color: '#2a2a2a',
                marginBottom: 8,
              }}
            >
              昵称 <span style={{ color: '#d4183d' }}>*</span>
            </label>
            <Input value={name} onChange={setName} placeholder="请输入您的昵称" errKey="name" />
            {err.name && (
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#d4183d' }}>请输入昵称</p>
            )}
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 16,
                fontWeight: 500,
                color: '#2a2a2a',
                marginBottom: 12,
              }}
            >
              性别 <span style={{ color: '#d4183d' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: 16 }}>
              {genderBtn('male', '👨', '男')}
              {genderBtn('female', '👩', '女')}
            </div>
            {err.gender && (
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#d4183d' }}>请选择性别</p>
            )}
          </div>

          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#2a2a2a',
                    marginBottom: 8,
                  }}
                >
                  年龄 <span style={{ color: '#d4183d' }}>*</span>
                </label>
                <Input value={age} onChange={setAge} placeholder="0" errKey="age" suffix="岁" />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#2a2a2a',
                    marginBottom: 8,
                  }}
                >
                  身高
                </label>
                <Input value={height} onChange={setHeight} placeholder="0" suffix="cm" />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#2a2a2a',
                    marginBottom: 8,
                  }}
                >
                  体重
                </label>
                <Input value={weight} onChange={setWeight} placeholder="0" suffix="kg" />
              </div>
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 16,
                fontWeight: 500,
                color: '#2a2a2a',
                marginBottom: 12,
              }}
            >
              健康关注
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {CONCERNS.map((o) => {
                const active = concerns.has(o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggleConcern(o.id)}
                    style={{
                      padding: '14px 12px',
                      borderRadius: 16,
                      fontSize: 15,
                      background: active ? '#7b8c76' : 'rgba(255,255,255,0.97)',
                      color: active ? '#fff' : '#6b5d4f',
                      border: `1.18px solid ${
                        active ? '#7b8c76' : 'rgba(111,184,153,0.15)'
                      }`,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{o.icon}</span>
                    <span>{o.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '24px 24px calc(24px + var(--safe-bottom))',
          zIndex: 5,
        }}
      >
        <button
          onClick={submit}
          className="mp-btn-pri mp-btn-block"
          style={{ height: 56, fontSize: 18 }}
        >
          下一步
        </button>
      </div>
    </div>
  );
}
