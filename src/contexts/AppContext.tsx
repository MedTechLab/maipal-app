import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, loadSessionToken, setSessionToken, type User as ServerUser } from '../lib/api';
import { login as oauthLogin, logout as oauthLogout, type AuthProvider } from '../lib/social-login';
import type { DoctorReport } from '../../worker/types';
import { extractToolCall, cleanTextForTTS, stripForDisplay, type ToolCallSignal } from '../lib/tool-call';
import { speakText, stopSpeaking } from '../lib/tts';

export type Gender = 'male' | 'female';

export type ProfileDraft = {
  name: string;
  gender: Gender;
  age: number;
  height?: number;
  weight?: number;
  concerns: string[];
};

export type User = ServerUser;

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type HealthReport = {
  date: string;
  faceAnalysis: string;
  voiceAnalysis: string;
  suggestions: string[];
  /** Full rich report from GENERATE_REPORT, when available. */
  report?: DoctorReport;
};

export type Task = {
  id: string;
  text: string;
  completed: boolean;
};

type Permission = null | true | false;
type AvatarState = 'standby' | 'speaking';
type FaceKind = 'face' | 'tongue';
type Pending = { type: 'face'; kind: FaceKind } | { type: 'voice' } | null;

type AppContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  signInWith: (provider: AuthProvider) => Promise<User>;
  devSignIn: () => Promise<User>;
  signOut: () => Promise<void>;
  saveProfile: (p: ProfileDraft) => Promise<User>;

  cameraPerm: Permission;
  micPerm: Permission;
  setCameraPerm: (p: Permission) => void;
  setMicPerm: (p: Permission) => void;

  // Chat
  messages: ChatMessage[];
  streaming: boolean;
  sendUserMessage: (text: string) => void;
  avatarState: AvatarState;
  /** id of the message currently being read aloud, or null. */
  speakingId: string | null;
  /** Replay (or stop) TTS for a specific message. */
  toggleSpeak: (id: string, text: string) => void;
  /** Clear the conversation and restart from the doctor's opening. */
  startNewConsultation: () => void;

  healthReport: HealthReport | null;

  hasPlan: boolean;
  tasks: Task[];
  generatePlan: () => void;
  toggleTask: (id: string, forceComplete?: boolean) => void;

  points: number;
  addPoints: (n: number, reason?: string, taskId?: string) => void;

  // Modal flow (driven by the doctor's tool_call signals)
  permModal: 'camera' | 'mic' | null;
  faceModal: 'ready' | 'observing' | 'holding' | 'done' | null;
  faceKind: FaceKind;
  voiceModal: 'ready' | 'recording' | 'done' | null;
  voiceGuidance: string;
  recTime: number;
  openPermModal: (t: 'camera' | 'mic' | null) => void;
  openFaceModal: (s: AppContextValue['faceModal']) => void;
  openVoiceModal: (s: AppContextValue['voiceModal']) => void;
  setRecTime: (n: number) => void;

  // Called by ModalHost once a capture / recording is collected
  submitFaceResult: (imageDataUrl: string) => void;
  submitVoiceResult: (transcript: string, voiceMetrics?: unknown) => void;
  onPermissionResult: (type: 'camera' | 'mic', granted: boolean) => void;
  cancelFace: () => void;
  cancelVoice: () => void;
};

const Ctx = createContext<AppContextValue | null>(null);

const FALLBACK_OPENING =
  '您好，欢迎来找我聊聊。我是脉大夫，平时大家也叫我老脉。今天不管是身体哪里不舒服，还是想聊聊养生调理，都可以跟我说。先问一下，怎么称呼您呢？';

const FALLBACK_TASK_TEXTS = [
  '早上8点：枸杞红枣茶',
  '中午12点：午休30分钟',
  '下午5点：散步30分钟',
  '晚上9点：足浴泡脚20分钟',
  '晚上10:30：准备睡眠',
];

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const swallow = (e: unknown) => {
  console.warn('[api]', e);
};

function safeParse<T>(s: string | null | undefined): T | undefined {
  if (!s) return undefined;
  try {
    return JSON.parse(s) as T;
  } catch {
    return undefined;
  }
}

function buildHealthReport(report: DoctorReport): HealthReport {
  const faceItems = report.sizhen?.face?.items ?? [];
  const voiceItems = report.sizhen?.voice?.items ?? [];
  const join = (items: { key: string; value: string }[], status?: string) =>
    items.length ? items.map((i) => `${i.key}：${i.value}`).join('；') : status ?? '';
  const suggestionSrc =
    report.advice?.lifestyle?.length
      ? report.advice.lifestyle
      : report.advice?.food?.recipes?.map((r) => r.name) ?? [];
  return {
    date: new Date().toLocaleDateString('zh-CN'),
    faceAnalysis: join(faceItems, report.sizhen?.face?.status),
    voiceAnalysis: join(voiceItems, report.sizhen?.voice?.status),
    suggestions: suggestionSrc.slice(0, 5),
    report,
  };
}

function deriveTasks(report: DoctorReport): string[] {
  const a = report.advice;
  if (!a) return [];
  const tasks: string[] = [];
  a.lifestyle?.forEach((l) => tasks.push(l));
  a.food?.recipes?.forEach((r) => tasks.push(r.name));
  a.acupoints?.forEach((p) => tasks.push(`${p.name}${p.method ? '：' + p.method : ''}`));
  if (a.exercise) tasks.push(a.exercise);
  return tasks;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cameraPerm, setCameraPermState] = useState<Permission>(null);
  const [micPerm, setMicPermState] = useState<Permission>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'opening', role: 'assistant', content: FALLBACK_OPENING },
  ]);
  const [streaming, setStreaming] = useState(false);
  const [avatarState, setAvatarState] = useState<AvatarState>('standby');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [healthReport, setHealthReportState] = useState<HealthReport | null>(null);
  const [hasPlan, setHasPlan] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([
    { id: 'd1', text: '早 7:30 · 晨起温水 + 枸杞红枣茶', completed: false },
    { id: 'd2', text: '上午 9:00 · 八段锦「调理脾胃须单举」×8次', completed: false },
    { id: 'd3', text: '午间 12:30 · 闭目静养 20 分钟', completed: false },
    { id: 'd4', text: '下午 17:00 · 散步 30 分钟', completed: false },
    { id: 'd5', text: '晚 21:00 · 按揉足三里+三阴交各 3 分钟', completed: false },
  ]);
  const [points, setPoints] = useState(0);

  const [permModal, openPermModal] = useState<AppContextValue['permModal']>(null);
  const [faceModal, openFaceModal] = useState<AppContextValue['faceModal']>(null);
  const [faceKind, setFaceKind] = useState<FaceKind>('face');
  const [voiceModal, openVoiceModal] = useState<AppContextValue['voiceModal']>(null);
  const [voiceGuidance, setVoiceGuidance] = useState('请朗读：今天来看看我这身体情况');
  const [recTime, setRecTime] = useState(0);

  // Refs that async signal handlers read for current values.
  const messagesRef = useRef(messages);
  const cameraPermRef = useRef<Permission>(null);
  const micPermRef = useRef<Permission>(null);
  const faceKindRef = useRef<FaceKind>('face');
  const healthReportRef = useRef<HealthReport | null>(null);
  const pendingRef = useRef<Pending>(null);
  const streamingRef = useRef(false);
  // Monotonic token so a stale TTS onStart/onEnd can't clobber a newer one.
  const speakTokenRef = useRef(0);
  const speakingIdRef = useRef<string | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    healthReportRef.current = healthReport;
  }, [healthReport]);

  const setCameraPerm = useCallback((p: Permission) => {
    cameraPermRef.current = p;
    setCameraPermState(p);
  }, []);
  const setMicPerm = useCallback((p: Permission) => {
    micPermRef.current = p;
    setMicPermState(p);
  }, []);

  const persist = useCallback((role: 'user' | 'assistant', content: string) => {
    api.postMessage({ role, content }).catch(swallow);
  }, []);

  // ─── TTS playback + avatar (shared by autoplay and manual replay) ──
  const speak = useCallback((id: string, rawText: string) => {
    const speakable = cleanTextForTTS(rawText);
    if (!speakable) return;
    const token = ++speakTokenRef.current;
    speakingIdRef.current = id;
    setSpeakingId(id);
    setAvatarState('speaking');
    speakText(speakable, {
      onStart: () => {
        if (speakTokenRef.current !== token) return;
        speakingIdRef.current = id;
        setSpeakingId(id);
        setAvatarState('speaking');
      },
      onEnd: () => {
        if (speakTokenRef.current !== token) return;
        speakingIdRef.current = null;
        setSpeakingId(null);
        setAvatarState('standby');
      },
    });
  }, []);

  const stopSpeak = useCallback(() => {
    speakTokenRef.current++;
    stopSpeaking();
    speakingIdRef.current = null;
    setSpeakingId(null);
    setAvatarState('standby');
  }, []);

  const toggleSpeak = useCallback(
    (id: string, rawText: string) => {
      if (speakingIdRef.current === id) stopSpeak();
      else speak(id, rawText);
    },
    [speak, stopSpeak],
  );

  // ─── Plan / report ────────────────────────────────────────
  const applyPlan = useCallback((taskTexts: string[]) => {
    setHasPlan(true);
    const optimistic = (taskTexts.length ? taskTexts : FALLBACK_TASK_TEXTS).map((t, i) => ({
      id: `t-${i}`,
      text: t,
      completed: false,
    }));
    setTasks(optimistic);
    api
      .createPlan(taskTexts.length ? taskTexts.map((text) => ({ text })) : undefined)
      .then((p) => setTasks(p.tasks.map((t) => ({ id: t.id, text: t.text, completed: t.completed }))))
      .catch(swallow);
  }, []);

  const applyReport = useCallback(
    (report: DoctorReport) => {
      const r = buildHealthReport(report);
      setHealthReportState(r);
      healthReportRef.current = r;
      api
        .postReport({
          date: r.date,
          face_analysis: r.faceAnalysis,
          voice_analysis: r.voiceAnalysis,
          suggestions: r.suggestions,
          report_json: JSON.stringify(report),
        })
        .catch(swallow);
      applyPlan(deriveTasks(report));
    },
    [applyPlan],
  );

  // ─── Signal dispatch (declared before the streaming turn that calls it) ──
  const dispatchSignalRef = useRef<(s: ToolCallSignal) => void>(() => {});

  const submitUserTurnRef = useRef<(content: string) => void>(() => {});

  const requestCapture = useCallback((kind: FaceKind) => {
    setFaceKind(kind);
    faceKindRef.current = kind;
    const perm = cameraPermRef.current;
    if (perm === false) return submitUserTurnRef.current('[望诊·失败]');
    if (perm === null) {
      pendingRef.current = { type: 'face', kind };
      return openPermModal('camera');
    }
    openFaceModal('ready');
  }, []);

  const requestVoice = useCallback((guidance: string) => {
    setVoiceGuidance(guidance);
    const perm = micPermRef.current;
    if (perm === false) return submitUserTurnRef.current('[闻诊·失败]');
    if (perm === null) {
      pendingRef.current = { type: 'voice' };
      return openPermModal('mic');
    }
    openVoiceModal('ready');
  }, []);

  const dispatchSignal = useCallback(
    (signal: ToolCallSignal) => {
      switch (signal.action) {
        case 'CAPTURE_FACE':
          return requestCapture('face');
        case 'CAPTURE_TONGUE':
          return requestCapture('tongue');
        case 'RECORD_VOICE':
          return requestVoice(signal.guidance?.trim() || '请朗读：今天来看看我这身体情况');
        case 'GENERATE_REPORT':
          if (signal.report) applyReport(signal.report);
          return;
        default:
          return;
      }
    },
    [requestCapture, requestVoice, applyReport],
  );
  useEffect(() => {
    dispatchSignalRef.current = dispatchSignal;
  }, [dispatchSignal]);

  // ─── Streaming assistant turn ─────────────────────────────
  const runAssistantTurn = useCallback(
    async (history: ChatMessage[]) => {
      setStreaming(true);
      streamingRef.current = true;
      const assistantId = uid('a');
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      let full = '';
      try {
        await api.chatStream(
          history.map((m) => ({ role: m.role, content: m.content })),
          (delta) => {
            full += delta;
            const shown = stripForDisplay(full);
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: shown } : m)),
            );
          },
        );
      } catch (e) {
        swallow(e);
      }

      const { cleaned, signal } = extractToolCall(full);
      const finalText =
        cleaned || stripForDisplay(full) || '抱歉，我这边连接不太稳，您再说一次好吗？';
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: finalText } : m)),
      );
      persist('assistant', finalText);
      setStreaming(false);
      streamingRef.current = false;

      speak(assistantId, finalText);
      if (signal) setTimeout(() => dispatchSignalRef.current(signal), 600);
    },
    [persist, speak],
  );

  const submitUserTurn = useCallback(
    (content: string) => {
      const userMsg: ChatMessage = { id: uid('u'), role: 'user', content };
      const history = [...messagesRef.current, userMsg];
      messagesRef.current = history;
      setMessages(history);
      persist('user', content);
      runAssistantTurn(history);
    },
    [persist, runAssistantTurn],
  );
  useEffect(() => {
    submitUserTurnRef.current = submitUserTurn;
  }, [submitUserTurn]);

  const sendUserMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streamingRef.current) return;
      submitUserTurn(trimmed);
    },
    [submitUserTurn],
  );

  const startNewConsultation = useCallback(async () => {
    stopSpeak();
    let opening = FALLBACK_OPENING;
    try {
      const o = await api.getOpening();
      opening = o.opening || FALLBACK_OPENING;
    } catch {
      /* use fallback */
    }
    await api.clearMessages().catch(swallow);
    const openMsg: ChatMessage = { id: uid('a'), role: 'assistant', content: opening };
    messagesRef.current = [openMsg];
    setMessages([openMsg]);
    persist('assistant', openMsg.content);
  }, [persist, stopSpeak]);

  // ─── Diagnosis results (from ModalHost) ───────────────────
  const submitFaceResult = useCallback(
    async (imageDataUrl: string) => {
      const kind = faceKindRef.current;
      openFaceModal('observing');
      try {
        const { summary } = await api.diagnose(kind, { image: imageDataUrl });
        openFaceModal('done');
        setTimeout(() => {
          openFaceModal(null);
          submitUserTurnRef.current(summary);
        }, 800);
      } catch (e) {
        swallow(e);
        openFaceModal(null);
        submitUserTurnRef.current('[望诊·失败]');
      }
    },
    [],
  );

  const submitVoiceResult = useCallback(async (transcript: string, voiceMetrics?: unknown) => {
    const t = transcript.trim();
    if (!t && !voiceMetrics) {
      openVoiceModal(null);
      submitUserTurnRef.current('[闻诊·失败]');
      return;
    }
    openVoiceModal('done');
    try {
      const { summary } = await api.diagnose('voice', { transcript: t, voiceMetrics });
      setTimeout(() => {
        openVoiceModal(null);
        submitUserTurnRef.current(summary);
      }, 600);
    } catch (e) {
      swallow(e);
      openVoiceModal(null);
      submitUserTurnRef.current('[闻诊·失败]');
    }
  }, []);

  const onPermissionResult = useCallback(
    (type: 'camera' | 'mic', granted: boolean) => {
      openPermModal(null);
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (type === 'camera') {
        setCameraPerm(granted);
        if (pending?.type === 'face') {
          if (granted) setTimeout(() => openFaceModal('ready'), 250);
          else submitUserTurnRef.current('[望诊·失败]');
        }
      } else {
        setMicPerm(granted);
        if (pending?.type === 'voice') {
          if (granted) setTimeout(() => openVoiceModal('ready'), 250);
          else submitUserTurnRef.current('[闻诊·失败]');
        }
      }
    },
    [setCameraPerm, setMicPerm],
  );

  const cancelFace = useCallback(() => {
    openFaceModal(null);
    submitUserTurnRef.current('[望诊·失败]');
  }, []);
  const cancelVoice = useCallback(() => {
    openVoiceModal(null);
    submitUserTurnRef.current('[闻诊·失败]');
  }, []);

  // ─── Data hydration ───────────────────────────────────────
  const hydrateUserData = useCallback(async () => {
    try {
      const [msgs, report, plan, opening] = await Promise.all([
        api.listMessages().catch(() => [] as ChatMessage[]),
        api.latestReport().catch(() => null),
        api.getPlan().catch(() => null),
        api.getOpening().catch(() => ({ opening: FALLBACK_OPENING })),
      ]);

      if (Array.isArray(msgs) && msgs.length > 0) {
        const mapped = msgs.map((r) => ({ id: r.id, role: r.role, content: r.content }));
        setMessages(mapped);
        messagesRef.current = mapped;
      } else {
        const openMsg: ChatMessage = {
          id: uid('a'),
          role: 'assistant',
          content: opening.opening || FALLBACK_OPENING,
        };
        setMessages([openMsg]);
        messagesRef.current = [openMsg];
        persist('assistant', openMsg.content);
      }

      if (report) {
        const r: HealthReport = {
          date: report.date,
          faceAnalysis: report.face_analysis ?? '',
          voiceAnalysis: report.voice_analysis ?? '',
          suggestions: report.suggestions,
          report: safeParse<DoctorReport>(report.report_json),
        };
        setHealthReportState(r);
        healthReportRef.current = r;
      }
      if (plan) {
        setHasPlan(true);
        setTasks(plan.tasks.map((t) => ({ id: t.id, text: t.text, completed: t.completed })));
      }
    } catch (e) {
      swallow(e);
    }
  }, [persist]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Dev bypass: skip real auth, use a mock user
      if (localStorage.getItem('maipal.dev-bypass') === 'true') {
        if (!cancelled) {
          setUser({
            id: 'dev-user-001',
            auth_provider: 'google',
            email: 'dev@maipal.local',
            name: 'Dev User',
            gender: null,
            age: null,
            height: undefined,
            weight: undefined,
            concerns: [],
            points: 100,
            created_at: Date.now(),
            updated_at: Date.now(),
          });
          setAuthLoading(false);
        }
        return;
      }

      const token = await loadSessionToken().catch(() => null);
      if (!token) {
        if (!cancelled) setAuthLoading(false);
        return;
      }
      try {
        const me = await api.me();
        if (cancelled) return;
        setUser(me);
        setPoints(me.points);
        await hydrateUserData();
      } catch {
        await setSessionToken(null).catch(() => undefined);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateUserData]);

  // ─── Auth ─────────────────────────────────────────────────
  const signInWith = useCallback(
    async (provider: AuthProvider): Promise<User> => {
      const { idToken, name } = await oauthLogin(provider);
      const resp =
        provider === 'google'
          ? await api.loginGoogle(idToken)
          : provider === 'apple'
            ? await api.loginApple(idToken, name)
            : await api.loginMicrosoft(idToken);
      await setSessionToken(resp.token);
      setUser(resp.user);
      setPoints(resp.user.points);
      hydrateUserData().catch(swallow);
      return resp.user;
    },
    [hydrateUserData],
  );

  const devSignIn = useCallback(async (): Promise<User> => {
    const resp = await api.devLogin();
    await setSessionToken(resp.token);
    setUser(resp.user);
    setPoints(resp.user.points);
    hydrateUserData().catch(swallow);
    return resp.user;
  }, [hydrateUserData]);

  const signOut = useCallback(async () => {
    stopSpeaking();
    if (user?.auth_provider && user.auth_provider !== 'phone') {
      await oauthLogout(user.auth_provider).catch(() => undefined);
    }
    localStorage.removeItem('maipal.dev-bypass');
    await setSessionToken(null);
    setUser(null);
    setMessages([{ id: 'opening', role: 'assistant', content: FALLBACK_OPENING }]);
    messagesRef.current = [];
    setHealthReportState(null);
    healthReportRef.current = null;
    setHasPlan(false);
    setTasks([]);
    setPoints(0);
  }, [user]);

  const saveProfile = useCallback(async (p: ProfileDraft): Promise<User> => {
    const u = await api.updateProfile({
      name: p.name,
      gender: p.gender,
      age: p.age,
      height: p.height,
      weight: p.weight,
      concerns: p.concerns,
    });
    setUser(u);
    setPoints(u.points);
    return u;
  }, []);

  // ─── Plan (manual button) / tasks / points ────────────────
  const generatePlan = useCallback(() => {
    const report = healthReportRef.current?.report;
    applyPlan(report ? deriveTasks(report) : []);
  }, [applyPlan]);

  const toggleTask = useCallback((id: string, forceComplete?: boolean) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, completed: forceComplete ? true : !t.completed } : t,
      ),
    );
    if (forceComplete) api.completeTask(id).catch(swallow);
  }, []);

  const addPoints = useCallback((n: number, reason = 'check-in', taskId?: string) => {
    setPoints((p) => p + n);
    api
      .addPoints(n, reason, taskId)
      .then((r) => setPoints(r.points))
      .catch(swallow);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      authLoading,
      signInWith,
      devSignIn,
      signOut,
      saveProfile,
      cameraPerm,
      micPerm,
      setCameraPerm,
      setMicPerm,
      messages,
      streaming,
      sendUserMessage,
      avatarState,
      speakingId,
      toggleSpeak,
      startNewConsultation,
      healthReport,
      hasPlan,
      tasks,
      generatePlan,
      toggleTask,
      points,
      addPoints,
      permModal,
      faceModal,
      faceKind,
      voiceModal,
      voiceGuidance,
      recTime,
      openPermModal,
      openFaceModal,
      openVoiceModal,
      setRecTime,
      submitFaceResult,
      submitVoiceResult,
      onPermissionResult,
      cancelFace,
      cancelVoice,
    }),
    [
      user,
      authLoading,
      signInWith,
      devSignIn,
      signOut,
      saveProfile,
      cameraPerm,
      micPerm,
      setCameraPerm,
      setMicPerm,
      messages,
      streaming,
      sendUserMessage,
      avatarState,
      speakingId,
      toggleSpeak,
      startNewConsultation,
      healthReport,
      hasPlan,
      tasks,
      generatePlan,
      toggleTask,
      points,
      addPoints,
      permModal,
      faceModal,
      faceKind,
      voiceModal,
      voiceGuidance,
      recTime,
      submitFaceResult,
      submitVoiceResult,
      onPermissionResult,
      cancelFace,
      cancelVoice,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used within AppProvider');
  return v;
}
