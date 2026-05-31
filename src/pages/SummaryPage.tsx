import { useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Gift,
} from 'lucide-react';
import { ShanShuiBackground } from '../components/ShanShuiBackground';
import { ShanShuiHeader } from '../components/ShanShuiHeader';
import { PointsPill } from '../components/PointsPill';
import { ShiqingButton } from '../components/ShiqingButton';
import { X } from 'lucide-react';
import { ConfirmModal } from '../components/modals/ConfirmModal';
import { CheckInModal } from '../components/CheckInModal';
import { MonthCalendar, type CalendarRecord } from '../components/MonthCalendar';
import { DateDetailSheet, type DateRecord } from '../components/DateDetailSheet';
import { TaskExtra, type TaskExtraData } from '../components/TaskExtra';
import { useApp, type HealthReport } from '../contexts/AppContext';
import type { SizhenSection } from '../../worker/types';

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

// ─── Demo task extras (v5 样式的学习链接 + 音乐) ──────────────
const TASK_EXTRAS: Record<string, TaskExtraData> = {
  '枸杞红枣茶': {
    links: [
      { title: '枸杞红枣茶的功效与泡法', source: '丁香医生', url: 'https://dxy.com', icon: '🍵' },
      { title: '养生茶饮搭配指南', source: '中医药在线', url: 'https://tcm.org', icon: '📚' },
    ],
  },
  '八段锦': {
    links: [
      { title: '央视·八段锦第三式教学', source: 'CCTV生活圈', url: 'https://tv.cctv.com/2024/05/01/VIDECLmtBXu8BkReYR6VUSNs240501.shtml', icon: '🏋️' },
    ],
  },
  '闭目静养': {
    music: { title: '冥想轻音乐 · 20分钟', url: 'https://cdn.pixabay.com/audio/2024/11/01/audio_4956b4eff1.mp3', duration: 1200 },
  },
  '散步': {
    music: { title: '自然漫步轻音乐 · 30分钟', url: 'https://cdn.pixabay.com/audio/2025/03/06/audio_28c035e1a4.mp3', duration: 1800 },
  },
  '足三里': {
    links: [
      { title: '足三里+三阴交按摩图文教学', source: '微信公众号', url: 'https://mp.weixin.qq.com/s/xVJ44C7DJyJM-7gFF-BJEw', icon: '🦶' },
    ],
  },
};

function getTaskExtra(taskText: string): TaskExtraData | null {
  for (const [key, val] of Object.entries(TASK_EXTRAS)) {
    if (taskText.includes(key)) return val;
  }
  return null;
}

export function SummaryPage() {
  const nav = useNavigate();
  const app = useApp();
  const { healthReport, hasPlan, tasks, toggleTask, generatePlan, points, addPoints } = app;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const [showFullReport, setShowFullReport] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Month calendar state
  const [showMonthCal, setShowMonthCal] = useState(false);
  // Date detail sheet state
  const [detailDate, setDetailDate] = useState<Date | null>(null);
  const [showDateDetail, setShowDateDetail] = useState(false);

  const today = new Date();
  const isToday = selectedDate.toDateString() === today.toDateString();
  const weekDays: Date[] = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    weekDays.push(d);
  }

  const completedCount = tasks.filter((t) => t.completed).length;

  // Build calendar records from current data
  const calendarRecords = new Map<string, CalendarRecord>();
  if (healthReport) {
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    calendarRecords.set(todayKey, { hasDetection: true, tasksCompleted: completedCount });
  }

  // Build date detail record
  const getDateRecord = (d: Date): DateRecord | null => {
    if (d.toDateString() === today.toDateString() && healthReport) {
      return {
        detection: [
          { label: '面部气色', value: 78, max: 100 },
          { label: '语声中气', value: 65, max: 100 },
          { label: '整体评估', value: 72, max: 100 },
        ],
        tasks: tasks.filter((t) => t.completed).map((t) => t.text),
      };
    }
    return null;
  };

  const handleMonthDateSelect = (d: Date) => {
    setDetailDate(d);
    setShowDateDetail(true);
  };

  const completeCheckin = (imageDataUrl: string) => {
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
              <button
                onClick={() => setShowMonthCal(true)}
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: '#2a2a2a',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {selectedDate.getFullYear()}年 {selectedDate.getMonth() + 1}月
                <ChevronDown size={14} color="#6b5d4f" />
              </button>
              <ChevronRight size={20} color="#6b5d4f" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
              {weekDays.map((d) => {
                const isSel = d.toDateString() === selectedDate.toDateString();
                const isTod = d.toDateString() === today.toDateString();
                const hasData = isTod && !!healthReport;
                const hasTask = isTod && completedCount > 0;
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
                    <div style={{ display: 'flex', gap: 3, marginTop: 3, minHeight: 6 }}>
                      {hasData && (
                        <div style={{ width: 5, height: 5, borderRadius: 999, background: isSel ? 'rgba(255,255,255,0.8)' : '#D7C8B0' }} />
                      )}
                      {hasTask && (
                        <div style={{ width: 5, height: 5, borderRadius: 999, background: isSel ? 'rgba(255,255,255,0.6)' : '#8cc9a8' }} />
                      )}
                    </div>
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
                onClick={() => setShowFullReport(true)}
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

        {/* Default plan prompt */}
        {isToday && hasPlan && !healthReport && (
          <div style={{ padding: '0 24px', marginBottom: 16 }}>
            <div
              className="mp-card"
              style={{
                padding: 20,
                border: '1.5px solid rgba(123,140,118,0.25)',
                background: 'linear-gradient(135deg, rgba(123,140,118,0.04), rgba(215,200,176,0.06))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #7b8c76, #a8b0a5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 20 }}>📋</span>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: '#2a2a2a' }}>
                    通用养生计划
                  </h3>
                  <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b5d4f', lineHeight: 1.6 }}>
                    当前为中医基础养生方案，适合日常保健。完成问诊后，脉医生将为您定制专属调理计划。
                  </p>
                </div>
              </div>
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

              {/* Points progress */}
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

              {/* Task list with expandable extras */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tasks.map((t) => {
                  const extra = getTaskExtra(t.text);
                  const isExpanded = expandedTaskId === t.id;
                  return (
                    <div
                      key={t.id}
                      style={{
                        background: '#fff',
                        borderRadius: 12,
                        border: t.completed
                          ? '2px solid #e8b563'
                          : '2px solid rgba(111,184,153,0.2)',
                        boxShadow: t.completed
                          ? '0 2px 12px rgba(232,181,99,0.2)'
                          : '0 1px 2px rgba(0,0,0,.03)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        onClick={() => {
                          if (!t.completed) {
                            setSelectedTaskId(t.id);
                            setShowCheckInModal(true);
                          } else if (extra) {
                            setExpandedTaskId(isExpanded ? null : t.id);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: 12,
                          cursor: 'pointer',
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {extra && (
                              <ChevronDown
                                size={14}
                                color="#9a8e80"
                                style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                              />
                            )}
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
                          </div>
                        )}
                      </div>

                      {/* Expandable task extra (links + music) */}
                      {extra && (
                        <TaskExtra data={extra} expanded={isExpanded} />
                      )}
                    </div>
                  );
                })}
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

      {/* Generate plan modal */}
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

      {/* Check-in photo modal */}
      <CheckInModal
        open={showCheckInModal}
        onConfirm={completeCheckin}
        onCancel={() => {
          setShowCheckInModal(false);
          setSelectedTaskId(null);
        }}
      />

      {/* Month calendar full page */}
      <MonthCalendar
        open={showMonthCal}
        onClose={() => setShowMonthCal(false)}
        records={calendarRecords}
        onSelectDate={handleMonthDateSelect}
      />

      {/* Date detail sheet */}
      <DateDetailSheet
        open={showDateDetail}
        date={detailDate}
        record={detailDate ? getDateRecord(detailDate) : null}
        onClose={() => setShowDateDetail(false)}
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

      {showFullReport && healthReport && (
        <ReportDetail hr={healthReport} onClose={() => setShowFullReport(false)} />
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

const SECTION_TITLE: CSSProperties = {
  margin: '0 0 12px',
  fontSize: 16,
  fontWeight: 700,
  color: '#2a2a2a',
  fontFamily: 'var(--font-display)',
};
const CARD: CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  padding: 16,
  boxShadow: '0 1px 6px rgba(107,93,79,0.07)',
  border: '1px solid rgba(123,140,118,0.14)',
};
const ADVICE_ITEM: CSSProperties = {
  fontSize: 13.5,
  color: '#6b5d4f',
  lineHeight: 1.7,
  marginBottom: 4,
};

function statusColor(status?: string): { bg: string; fg: string } {
  const s = status ?? '';
  if (/正常|平和|尚和|基本/.test(s)) return { bg: 'rgba(123,140,118,0.16)', fg: '#5f7059' };
  if (/重点|异常/.test(s)) return { bg: 'rgba(194,71,61,0.12)', fg: '#c2473d' };
  if (/未完成|未采集/.test(s)) return { bg: 'rgba(0,0,0,0.05)', fg: '#9a8e80' };
  return { bg: 'rgba(212,165,116,0.18)', fg: '#a9772f' };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={SECTION_TITLE}>{title}</h3>
      {children}
    </div>
  );
}

function SizhenCard({ label, sec }: { label: string; sec?: SizhenSection }) {
  const empty = !sec || !sec.items?.length;
  const status = empty ? '未完成' : sec!.status;
  const sc = statusColor(status);
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: empty ? 0 : 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#5a4a3a' }}>{label}</span>
        <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, background: sc.bg, color: sc.fg }}>{status}</span>
      </div>
      {empty ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sec!.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5 }}>
              <span style={{ color: '#9a8e80', flexShrink: 0 }}>{it.key}</span>
              <span style={{ color: '#5a4a3a', fontWeight: 500, textAlign: 'right' }}>
                {it.value}{it.tag ? ` · ${it.tag}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'gold' }) {
  const c = tone === 'gold'
    ? { bg: 'rgba(212,165,116,0.18)', fg: '#a9772f' }
    : { bg: 'rgba(123,140,118,0.14)', fg: '#5f7059' };
  return (
    <span style={{ display: 'inline-block', padding: '4px 11px', margin: '0 6px 6px 0', fontSize: 12, fontWeight: 500, borderRadius: 999, background: c.bg, color: c.fg }}>
      {children}
    </span>
  );
}

function Badge({ text, tone }: { text: string; tone: 'gold' | 'green' }) {
  const c = tone === 'gold'
    ? { bg: 'rgba(212,165,116,0.2)', fg: '#a9772f' }
    : { bg: 'rgba(123,140,118,0.18)', fg: '#5f7059' };
  return (
    <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: c.bg, color: c.fg, verticalAlign: 'middle' }}>
      {text}
    </span>
  );
}

function AdviceGroup({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#7b8c76', marginBottom: 6 }}>{title}{badge}</div>
      {children}
    </div>
  );
}

function ReportDetail({ hr, onClose }: { hr: HealthReport; onClose: () => void }) {
  const r = hr.report;
  const a = r?.analysis;
  const adv = r?.advice;

  const analysisRow = (k: string, v: ReactNode) => (
    <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
      <span style={{ fontSize: 12.5, color: '#9a8e80', width: 64, flexShrink: 0 }}>{k}</span>
      <span style={{ fontSize: 13.5, color: '#5a4a3a', flex: 1 }}>{v}</span>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(248,243,238,0.98)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 24px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#000', fontFamily: 'var(--font-display)' }}>中医健康调理报告</h2>
          <button onClick={onClose} aria-label="关闭" style={{ width: 36, height: 36, borderRadius: 999, border: 'none', background: 'rgba(123,140,118,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={20} color="#5a4a3a" />
          </button>
        </div>

        <p style={{ margin: '0 0 20px', fontSize: 12.5, color: '#9a8e80' }}>四诊合参 · 辨证论治 · {hr.date}</p>

        {r?.doctorNote && (
          <div style={{ ...CARD, background: 'linear-gradient(135deg, rgba(123,140,118,0.12), rgba(215,200,176,0.14))', marginBottom: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7b8c76', marginBottom: 6 }}>大夫的话</div>
            <div style={{ fontSize: 15, color: '#5a4a3a', lineHeight: 1.75 }}>{r.doctorNote}</div>
          </div>
        )}

        {(r?.patientName || r?.age || r?.chiefComplaint || r?.bodyType) && (
          <div style={{ ...CARD, marginBottom: 22 }}>
            {r?.patientName && analysisRow('称呼', r.patientName)}
            {r?.age && analysisRow('年龄', r.age)}
            {r?.chiefComplaint && analysisRow('主诉', r.chiefComplaint)}
            {r?.bodyType && analysisRow('体型', r.bodyType)}
          </div>
        )}

        <Section title="四诊合参摘要">
          {r?.sizhen ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <SizhenCard label="望 · 面色" sec={r.sizhen.face} />
              <SizhenCard label="望 · 舌象" sec={r.sizhen.tongue} />
              <SizhenCard label="闻 · 语声" sec={r.sizhen.voice} />
              <SizhenCard label="问 · 主诉" sec={r.sizhen.inquiry} />
            </div>
          ) : (
            <div style={CARD}>
              {hr.faceAnalysis && <div style={ADVICE_ITEM}>面色：{hr.faceAnalysis}</div>}
              {hr.voiceAnalysis && <div style={ADVICE_ITEM}>声音：{hr.voiceAnalysis}</div>}
            </div>
          )}
        </Section>

        {a && (
          <Section title="辨证分析">
            <div style={CARD}>
              {a.bagang && analysisRow('八纲定位', <strong style={{ color: '#7b8c76' }}>{a.bagang}</strong>)}
              {a.organs && analysisRow('病位脏腑', a.organs)}
              {a.nature && analysisRow('病性归纳', a.nature)}
              {a.zhengxing?.length ? analysisRow('主要证型', <span>{a.zhengxing.map((z, i) => <Pill key={i}>{z}</Pill>)}</span>) : null}
              {a.tizhi ? analysisRow('体质辨识', <span><Pill tone="gold">{a.tizhi}</Pill>{a.tizhiNote ? <span style={{ fontSize: 12, color: '#9a8e80' }}>（{a.tizhiNote}）</span> : null}</span>) : null}
              {r?.reasoning?.length ? (
                <div style={{ marginTop: 12, paddingTop: 14, borderTop: '1px dashed rgba(123,140,118,0.3)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#7b8c76', marginBottom: 10 }}>我是怎么得出这个判断的</div>
                  {r.reasoning.map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                      <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 999, background: '#7b8c76', color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
                      <div style={{ fontSize: 13, color: '#5a4a3a', lineHeight: 1.6 }}>
                        <span style={{ color: '#7b8c76' }}>{step.observation}</span>{step.principle ? ` → ${step.principle}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </Section>
        )}

        {adv && (
          <Section title="调养方案">
            <div style={CARD}>
              {adv.zhifa && (
                <AdviceGroup title="治法总纲">
                  <div style={ADVICE_ITEM}>以<strong style={{ color: '#2a2a2a' }}>{adv.zhifa}</strong>为根本大法。</div>
                </AdviceGroup>
              )}
              {adv.food && (
                <AdviceGroup title="食疗调理" badge={<Badge text="最重要" tone="gold" />}>
                  {adv.food.recommended?.length || adv.food.recipes?.length ? (
                    <div style={{ background: 'rgba(123,140,118,0.07)', borderRadius: 12, padding: 12, marginBottom: 6 }}>
                      {adv.food.recommended?.length ? (
                        <div style={{ marginBottom: adv.food.recipes?.length ? 8 : 0 }}>
                          {adv.food.recommended.map((f, i) => <Pill key={i}>{f}</Pill>)}
                        </div>
                      ) : null}
                      {adv.food.recipes?.map((rec, i) => (
                        <div key={i} style={{ ...ADVICE_ITEM, marginBottom: 6 }}>
                          <strong style={{ color: '#2a2a2a' }}>{rec.name}</strong><br />
                          <span style={{ fontSize: 12, color: '#9a8e80' }}>{rec.detail}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {adv.food.avoid && <div style={{ ...ADVICE_ITEM, color: '#c2473d' }}>忌口提醒：{adv.food.avoid}</div>}
                </AdviceGroup>
              )}
              {adv.lifestyle?.length ? (
                <AdviceGroup title="作息起居" badge={<Badge text="坚持" tone="green" />}>
                  {adv.lifestyle.map((l, i) => <div key={i} style={ADVICE_ITEM}>· {l}</div>)}
                </AdviceGroup>
              ) : null}
              {adv.acupoints?.length ? (
                <AdviceGroup title="穴位自我保健">
                  {adv.acupoints.map((p, i) => (
                    <div key={i} style={ADVICE_ITEM}>
                      <strong style={{ color: '#2a2a2a' }}>{p.name}</strong>
                      {p.location ? `（${p.location}）` : ''}{p.method ? `：${p.method}` : ''}
                      {p.effect ? <span style={{ color: '#9a8e80' }}> · 功效：{p.effect}</span> : null}
                    </div>
                  ))}
                </AdviceGroup>
              ) : null}
              {adv.exercise && <AdviceGroup title="养生功法"><div style={ADVICE_ITEM}>{adv.exercise}</div></AdviceGroup>}
              {adv.warning && <AdviceGroup title="特别叮嘱"><div style={{ ...ADVICE_ITEM, color: '#c2473d', marginBottom: 0 }}>{adv.warning}</div></AdviceGroup>}
            </div>
          </Section>
        )}

        <p style={{ fontSize: 12, color: 'rgba(107,93,79,0.7)', lineHeight: 1.6, marginTop: 8 }}>
          本报告由脉大夫 AI 中医助手基于四诊信息自动生成，仅供参考与健康管理之用，不作为疾病诊断依据，不替代执业医师面诊开方。如有不适，请及时前往正规医疗机构就诊。
        </p>
      </div>
    </div>
  );
}
