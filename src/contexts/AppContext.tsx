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
import { api, getDeviceId } from '../lib/api';

export type User = {
  id?: string;
  name: string;
  gender: 'male' | 'female';
  age: number;
  height?: number;
  weight?: number;
  concerns: string[];
};

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
  user: User | null;
  setUser: (u: User) => void;

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
  // We log to the console so the dev still sees them while iterating.
  console.warn('[api]', e);
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
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
  const deviceIdRef = useRef<string | null>(null);

  // Resolve the stable device id once, regardless of whether the user signs up.
  useEffect(() => {
    let cancelled = false;
    getDeviceId()
      .then((id) => {
        if (!cancelled) deviceIdRef.current = id;
      })
      .catch(swallow);
    return () => {
      cancelled = true;
    };
  }, []);

  const setUser = useCallback((u: User) => {
    const id = deviceIdRef.current ?? u.id ?? crypto.randomUUID();
    deviceIdRef.current = id;
    const withId = { ...u, id };
    setUserState(withId);
    api
      .upsertUser({
        id,
        name: u.name,
        gender: u.gender,
        age: u.age,
        height: u.height,
        weight: u.weight,
        concerns: u.concerns,
      })
      .then((srv) => {
        setPoints(srv.points);
      })
      .catch(swallow);
    // Hydrate prior state for returning users.
    api.listMessages(id).then((rows) => {
      if (rows.length > 0) {
        setMessages(rows.map((r) => ({ id: r.id, role: r.role, content: r.content })));
      }
    }).catch(swallow);
    api.latestReport(id).then((r) => {
      if (r) {
        setHealthReportState({
          date: r.date,
          faceAnalysis: r.face_analysis ?? '',
          voiceAnalysis: r.voice_analysis ?? '',
          suggestions: r.suggestions,
        });
      }
    }).catch(swallow);
    api.getPlan(id).then((p) => {
      if (p) {
        setHasPlan(true);
        setTasks(p.tasks.map((t) => ({ id: t.id, text: t.text, completed: t.completed })));
      }
    }).catch(swallow);
  }, []);

  const addMessage = useCallback(
    (role: 'user' | 'assistant', content: string) => {
      const localId = `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setMessages((prev) => [...prev, { id: localId, role, content }]);
      const uid = deviceIdRef.current;
      if (uid) {
        api
          .postMessage(uid, { role, content })
          .then((m) => {
            // Reconcile local id with the server-assigned id.
            setMessages((prev) =>
              prev.map((x) => (x.id === localId ? { ...x, id: m.id } : x)),
            );
          })
          .catch(swallow);
      }
    },
    [],
  );

  const setHealthReport = useCallback((r: HealthReport) => {
    setHealthReportState(r);
    const uid = deviceIdRef.current;
    if (uid) {
      api
        .postReport(uid, {
          date: r.date,
          face_analysis: r.faceAnalysis,
          voice_analysis: r.voiceAnalysis,
          suggestions: r.suggestions,
        })
        .catch(swallow);
    }
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
    const uid = deviceIdRef.current;
    if (uid) {
      api
        .createPlan(uid)
        .then((p) => {
          setTasks(p.tasks.map((t) => ({ id: t.id, text: t.text, completed: t.completed })));
        })
        .catch(swallow);
    }
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

  const addPoints = useCallback(
    (n: number, reason = 'check-in', taskId?: string) => {
      setPoints((p) => p + n);
      const uid = deviceIdRef.current;
      if (uid) {
        api
          .addPoints(uid, n, reason, taskId)
          .then((r) => setPoints(r.points))
          .catch(swallow);
      }
    },
    [],
  );

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
      user, setUser,
      cameraPerm, micPerm, setCameraPerm, setMicPerm,
      messages, addMessage,
      healthReport, setHealthReport,
      hasPlan, tasks, generatePlan, toggleTask,
      points, addPoints,
      permModal, faceModal, voiceModal, recTime,
      openPermModal, openFaceModal, openVoiceModal, setRecTime,
      runCheckup, resolveCheckup, finishCheckup,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      user, cameraPerm, micPerm, messages, healthReport, hasPlan, tasks, points,
      permModal, faceModal, voiceModal, recTime,
      setUser, addMessage, setHealthReport, generatePlan, toggleTask, addPoints,
      runCheckup, resolveCheckup, finishCheckup,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used within AppProvider');
  return v;
}
