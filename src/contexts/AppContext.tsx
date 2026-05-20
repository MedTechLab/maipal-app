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
};

export type Task = {
  id: string;
  text: string;
  completed: boolean;
};

type Permission = null | true | false;

type AppContextValue = {
  /** null until the session check is done; thereafter the current user or signed-out null. */
  user: User | null;
  isAuthenticated: boolean;
  /** true while we're hydrating the session at boot. */
  authLoading: boolean;
  signInWith: (provider: AuthProvider) => Promise<User>;
  signOut: () => Promise<void>;
  saveProfile: (p: ProfileDraft) => Promise<User>;

  cameraPerm: Permission;
  micPerm: Permission;
  setCameraPerm: (p: Permission) => void;
  setMicPerm: (p: Permission) => void;

  messages: ChatMessage[];
  addMessage: (role: 'user' | 'assistant', content: string) => void;

  healthReport: HealthReport | null;
  setHealthReport: (r: HealthReport) => void;

  hasPlan: boolean;
  tasks: Task[];
  generatePlan: () => void;
  toggleTask: (id: string, forceComplete?: boolean) => void;

  points: number;
  addPoints: (n: number, reason?: string, taskId?: string) => void;

  permModal: 'camera' | 'mic' | null;
  faceModal: 'ready' | 'observing' | 'holding' | 'done' | null;
  voiceModal: 'ready' | 'recording' | 'done' | null;
  recTime: number;
  openPermModal: (t: 'camera' | 'mic' | null) => void;
  openFaceModal: (s: AppContextValue['faceModal']) => void;
  openVoiceModal: (s: AppContextValue['voiceModal']) => void;
  setRecTime: (n: number) => void;

  runCheckup: (onDone: () => void) => void;
  resolveCheckup: () => void;
  finishCheckup: () => void;
};

const Ctx = createContext<AppContextValue | null>(null);

const OPENING_MESSAGE: ChatMessage = {
  id: 'msg-1',
  role: 'assistant',
  content: '你好呀，今天需要脉医生帮你看一下身体状况吗？',
};

const swallow = (e: unknown) => {
  // Network/API errors are non-fatal — the UI keeps its local state.
  console.warn('[api]', e);
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cameraPerm, setCameraPerm] = useState<Permission>(null);
  const [micPerm, setMicPerm] = useState<Permission>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([OPENING_MESSAGE]);
  const [healthReport, setHealthReportState] = useState<HealthReport | null>(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [points, setPoints] = useState(0);

  const [permModal, openPermModal] = useState<AppContextValue['permModal']>(null);
  const [faceModal, openFaceModal] = useState<AppContextValue['faceModal']>(null);
  const [voiceModal, openVoiceModal] = useState<AppContextValue['voiceModal']>(null);
  const [recTime, setRecTime] = useState(0);

  const onDoneRef = useRef<(() => void) | null>(null);

  // Pull the user-scoped data after we have a logged-in user.
  const hydrateUserData = useCallback(async () => {
    try {
      const [msgs, report, plan] = await Promise.all([
        api.listMessages().catch(() => [] as ChatMessage[] | Awaited<ReturnType<typeof api.listMessages>>),
        api.latestReport().catch(() => null as Awaited<ReturnType<typeof api.latestReport>>),
        api.getPlan().catch(() => null as Awaited<ReturnType<typeof api.getPlan>>),
      ]);
      if (Array.isArray(msgs) && msgs.length > 0) {
        setMessages(msgs.map((r) => ({ id: r.id, role: r.role, content: r.content })));
      }
      if (report) {
        setHealthReportState({
          date: report.date,
          faceAnalysis: report.face_analysis ?? '',
          voiceAnalysis: report.voice_analysis ?? '',
          suggestions: report.suggestions,
        });
      }
      if (plan) {
        setHasPlan(true);
        setTasks(plan.tasks.map((t) => ({ id: t.id, text: t.text, completed: t.completed })));
      }
    } catch (e) {
      swallow(e);
    }
  }, []);

  // Boot: if we have a stored session, validate it with /api/auth/me.
  useEffect(() => {
    let cancelled = false;
    (async () => {
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
        // Stale token — clear it so the user sees /login on next render.
        await setSessionToken(null).catch(() => undefined);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateUserData]);

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

  const signOut = useCallback(async () => {
    if (user?.auth_provider) {
      await oauthLogout(user.auth_provider).catch(() => undefined);
    }
    await setSessionToken(null);
    setUser(null);
    setMessages([OPENING_MESSAGE]);
    setHealthReportState(null);
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

  const addMessage = useCallback(
    (role: 'user' | 'assistant', content: string) => {
      const localId = `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setMessages((prev) => [...prev, { id: localId, role, content }]);
      api
        .postMessage({ role, content })
        .then((m) => {
          setMessages((prev) => prev.map((x) => (x.id === localId ? { ...x, id: m.id } : x)));
        })
        .catch(swallow);
    },
    [],
  );

  const setHealthReport = useCallback((r: HealthReport) => {
    setHealthReportState(r);
    api
      .postReport({
        date: r.date,
        face_analysis: r.faceAnalysis,
        voice_analysis: r.voiceAnalysis,
        suggestions: r.suggestions,
      })
      .catch(swallow);
  }, []);

  const generatePlan = useCallback(() => {
    const fallback: Task[] = [
      { id: 't1', text: '早上8点：枸杞红枣茶', completed: false },
      { id: 't2', text: '中午12点：午休30分钟', completed: false },
      { id: 't3', text: '下午5点：散步30分钟', completed: false },
      { id: 't4', text: '晚上9点：足浴泡脚20分钟', completed: false },
      { id: 't5', text: '晚上10:30：准备睡眠', completed: false },
    ];
    setHasPlan(true);
    setTasks(fallback);
    api
      .createPlan()
      .then((p) => {
        setTasks(p.tasks.map((t) => ({ id: t.id, text: t.text, completed: t.completed })));
      })
      .catch(swallow);
  }, []);

  const toggleTask = useCallback((id: string, forceComplete?: boolean) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, completed: forceComplete ? true : !t.completed } : t,
      ),
    );
    if (forceComplete) {
      api.completeTask(id).catch(swallow);
    }
  }, []);

  const addPoints = useCallback((n: number, reason = 'check-in', taskId?: string) => {
    setPoints((p) => p + n);
    api
      .addPoints(n, reason, taskId)
      .then((r) => setPoints(r.points))
      .catch(swallow);
  }, []);

  const runCheckup = useCallback(
    (onDone: () => void) => {
      onDoneRef.current = onDone;
      if (cameraPerm === null) {
        openPermModal('camera');
      } else if (cameraPerm) {
        openFaceModal('ready');
      } else {
        maybeVoice();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cameraPerm, micPerm],
  );

  const maybeVoice = () => {
    if (micPerm === null) {
      openPermModal('mic');
    } else if (micPerm) {
      openVoiceModal('ready');
    } else {
      finishCheckup();
    }
  };

  const finishCheckup = useCallback(() => {
    const report: HealthReport = {
      date: new Date().toLocaleDateString('zh-CN'),
      faceAnalysis: '气色略偏淡，面部气血运行稍显不足',
      voiceAnalysis: '声音略显疲惫，可能存在睡眠不足问题',
      suggestions: [
        '建议每晚11点前入睡，保证7-8小时睡眠',
        '可适当食用枸杞、红枣等补气血食材',
        '每天进行30分钟轻度运动，如散步、太极',
      ],
    };
    setHealthReport(report);
    resolveCheckup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHealthReport]);

  const resolveCheckup = useCallback(() => {
    if (onDoneRef.current) {
      onDoneRef.current();
      onDoneRef.current = null;
    }
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      authLoading,
      signInWith,
      signOut,
      saveProfile,
      cameraPerm,
      micPerm,
      setCameraPerm,
      setMicPerm,
      messages,
      addMessage,
      healthReport,
      setHealthReport,
      hasPlan,
      tasks,
      generatePlan,
      toggleTask,
      points,
      addPoints,
      permModal,
      faceModal,
      voiceModal,
      recTime,
      openPermModal,
      openFaceModal,
      openVoiceModal,
      setRecTime,
      runCheckup,
      resolveCheckup,
      finishCheckup,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      user,
      authLoading,
      cameraPerm,
      micPerm,
      messages,
      healthReport,
      hasPlan,
      tasks,
      points,
      permModal,
      faceModal,
      voiceModal,
      recTime,
      signInWith,
      signOut,
      saveProfile,
      addMessage,
      setHealthReport,
      generatePlan,
      toggleTask,
      addPoints,
      runCheckup,
      resolveCheckup,
      finishCheckup,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used within AppProvider');
  return v;
}
