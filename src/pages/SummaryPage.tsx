import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Gift,
} from 'lucide-react';
import { ShanShuiBackground } from '../components/ShanShuiBackground';
import { ShanShuiHeader } from '../components/ShanShuiHeader';
import { PointsPill } from '../components/PointsPill';
import { ShiqingButton } from '../components/ShiqingButton';
import { ConfirmModal } from '../components/modals/ConfirmModal';
import { useApp } from '../contexts/AppContext';

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

export function SummaryPage() {
  const nav = useNavigate();
  const app = useApp();
  const { healthReport, hasPlan, tasks, toggleTask, generatePlan, points, addPoints } = app;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [toast, setToast] = useState(false);

  const today = new Date();
  const isToday = selectedDate.toDateString() === today.toDateString();
  const weekDays: Date[] = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    weekDays.push(d);
  }

  const completedCount = tasks.filter((t) => t.completed).length;

  const completeCheckin = () => {
    if (selectedTaskId) {
      toggleTask(selectedTaskId, true);
      addPoints(10);
      setToast(true);
      setTimeout(() => setToast(false), 2400);
    }
    setShowCheckInModal(false);
    setSelectedTaskId(null);
  };

  return (
    <div className="app-frame mp-screen" style={{ position: 'relative' }}>
      <ShanShuiBackground />
      <div style={{ position: 'relative', zIndex: 10, height: '100%', overflowY: 'auto' }}>
        <ShanShuiHeader
          title="调理计划"
          subtitle="查看您的健康报告和调理建议"
          right={<PointsPill points={points} />}
        />

        {/* Calendar */}
        <div style={{ padding: '0 24px', marginBottom: 24 }}>
          <div className="mp-card" style={{ padding: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <ChevronLeft size={20} color="#6b5d4f" />
              <div style={{ fontSize: 16, fontWeight: 500, color: '#2a2a2a' }}>
                {selectedDate.getFullYear()}年 {selectedDate.getMonth() + 1}月
              </div>
              <ChevronRight size={20} color="#6b5d4f" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
              {weekDays.map((d) => {
                const isSel = d.toDateString() === selectedDate.toDateString();
                const isTod = d.toDateString() === today.toDateString();
                const hasData = isTod && !!healthReport;
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => setSelectedDate(d)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderRadius: 12,
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      background: isSel
                        ? '#7b8c76'
                        : isTod
                          ? 'rgba(123,140,118,0.2)'
                          : 'transparent',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: isSel ? 'rgba(255,255,255,0.8)' : '#6b5d4f',
                        marginBottom: 2,
                      }}
                    >
                      {DAY_NAMES[d.getDay()]}
                    </span>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 500,
                        color: isSel ? '#fff' : '#2a2a2a',
                      }}
                    >
                      {d.getDate()}
                    </span>
                    {hasData && (
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: '#D7C8B0',
                          marginTop: 3,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Health report */}
        {isToday && healthReport && (
          <div style={{ padding: '0 24px', marginBottom: 24 }}>
            <div className="mp-card-strong" style={{ padding: 24 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#000',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  今日健康检测
                </h2>
                <span style={{ fontSize: 13, color: '#6b5d4f' }}>{healthReport.date}</span>
              </div>
              <ReportSection title="面部分析" body={healthReport.faceAnalysis} />
              <ReportSection title="声音分析" body={healthReport.voiceAnalysis} />
              <div style={{ marginBottom: 4 }}>
                <h3
                  style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 500, color: '#000' }}
                >
                  调理建议
                </h3>
                {healthReport.suggestions.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 8,
                      fontSize: 14,
                      color: '#6b5d4f',
                      marginBottom: 6,
                      lineHeight: 1.55,
                    }}
                  >
                    <span style={{ color: '#4a7c8e', marginTop: -1 }}>•</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              <button
                style={{
                  width: '100%',
                  height: 48,
                  marginTop: 20,
                  background: '#81917C',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 16,
                  fontSize: 16,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                查看完整报告
              </button>
            </div>
          </div>
        )}

        {/* Tasks */}
        {isToday && hasPlan && (
          <div style={{ padding: '0 24px 32px' }}>
            <div className="mp-card-strong" style={{ padding: 24 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#000',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  今日任务
                </h2>
                <span style={{ fontSize: 13, color: '#6b5d4f' }}>
                  {completedCount}/{tasks.length}
                </span>
              </div>

              <div
                style={{
                  marginBottom: 20,
                  padding: 16,
                  borderRadius: 12,
                  background:
                    'linear-gradient(90deg, rgba(232,181,99,0.08), rgba(212,165,116,0.08))',
                  border: '1.18px solid rgba(232,181,99,0.2)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Gift size={16} color="#d4a574" />
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#000' }}>
                      今日积分进度
                    </span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#d4a574' }}>
                    {points} / 50
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    background: 'rgba(232,181,99,0.15)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min((points / 50) * 100, 100)}%`,
                      background: 'linear-gradient(90deg, #e8b563, #d4a574)',
                      borderRadius: 999,
                      transition: 'width 600ms ease',
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <Camera size={14} color="#d4a574" />
                  <p style={{ margin: 0, fontSize: 12, color: '#6b5d4f' }}>
                    上传照片打卡即可获得{' '}
                    <span style={{ color: '#d4a574', fontWeight: 500 }}>10 积分</span>
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedTaskId(t.id);
                      setShowCheckInModal(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      background: '#fff',
                      borderRadius: 12,
                      cursor: 'pointer',
                      border: t.completed
                        ? '2px solid #e8b563'
                        : '2px solid rgba(111,184,153,0.2)',
                      boxShadow: t.completed
                        ? '0 2px 12px rgba(232,181,99,0.2)'
                        : '0 1px 2px rgba(0,0,0,.03)',
                    }}
                  >
                    {t.completed ? (
                      <CheckCircle2 size={20} color="#d4a574" />
                    ) : (
                      <Circle size={20} color="#6b5d4f" />
                    )}
                    <span
                      style={{
                        flex: 1,
                        fontSize: 15,
                        color: t.completed ? '#6b5d4f' : '#000',
                        textDecoration: t.completed ? 'line-through' : 'none',
                      }}
                    >
                      {t.text}
                    </span>
                    {t.completed ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background:
                            'linear-gradient(90deg, rgba(232,181,99,0.1), rgba(212,165,116,0.1))',
                          border: '1.18px solid rgba(232,181,99,0.3)',
                        }}
                      >
                        <CheckCircle2 size={14} color="#d4a574" />
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#d4a574' }}>
                          已打卡
                        </span>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: 6,
                          borderRadius: 999,
                          background: 'rgba(111,184,153,0.1)',
                          border: '1.18px solid rgba(111,184,153,0.2)',
                        }}
                      >
                        <Camera size={16} color="#4a7c8e" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasPlan && (
          <div style={{ padding: '0 24px 32px' }}>
            <div className="mp-card-strong" style={{ padding: 32, textAlign: 'center' }}>
              {!healthReport ? (
                <>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>👨‍⚕️</div>
                  <h3
                    style={{
                      margin: '0 0 8px',
                      fontSize: 18,
                      fontWeight: 500,
                      color: '#000',
                    }}
                  >
                    还没有健康检测记录
                  </h3>
                  <p
                    style={{
                      margin: '0 0 20px',
                      fontSize: 14,
                      color: '#6b5d4f',
                      lineHeight: 1.6,
                    }}
                  >
                    先让脉医生帮你看看身体状况，才能为你定制专属调理计划哦
                  </p>
                  <ShiqingButton onClick={() => nav('/app/chat')}>去找脉医生</ShiqingButton>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                  <p style={{ margin: '0 0 20px', fontSize: 16, color: '#6b5d4f' }}>
                    还没有调理计划哦
                  </p>
                  <ShiqingButton onClick={() => setShowPlanModal(true)}>
                    生成计划
                  </ShiqingButton>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={showPlanModal}
        title="生成调理计划"
        body="根据您的健康检测结果，为您生成个性化的调理计划吗？"
        primary="确定"
        secondary="取消"
        onPrimary={() => {
          generatePlan();
          setShowPlanModal(false);
        }}
        onSecondary={() => setShowPlanModal(false)}
      />
      <ConfirmModal
        open={showCheckInModal}
        title="打卡照片"
        body="是否要上传打卡照片？上传后将获得 10 积分。"
        primary="上传照片"
        secondary="不用了"
        onPrimary={completeCheckin}
        onSecondary={() => {
          setShowCheckInModal(false);
          setSelectedTaskId(null);
        }}
      />

      {toast && (
        <div
          className="anim-rise"
          style={{
            position: 'absolute',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(90deg, #e8b563, #d4a574)',
            color: '#fff',
            padding: '10px 24px',
            borderRadius: 999,
            zIndex: 95,
            boxShadow: '0 8px 20px rgba(232,181,99,0.3)',
            border: '2px solid rgba(232,181,99,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Gift size={20} color="#fff" />
          <span style={{ fontSize: 16, fontWeight: 500 }}>获得 10 积分！</span>
        </div>
      )}
    </div>
  );
}

function ReportSection({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 500, color: '#000' }}>
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: 14, color: '#6b5d4f', lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}
