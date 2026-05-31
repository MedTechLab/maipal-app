// Shared types between the Worker (D1 rows + responses) and the React client.
// The client imports from `@shared/types` (see vite alias).

export type Gender = 'male' | 'female';
export type AuthProvider = 'google' | 'apple' | 'microsoft' | 'phone';

export interface User {
  id: string;
  auth_provider: AuthProvider | null;
  email: string | null;
  // `name`, `gender`, `age` are nullable in storage: the row is created at
  // sign-in (before /userinfo runs) and the profile fields are filled in
  // immediately afterwards. The client treats a row with null `name` as
  // "needs onboarding".
  name: string | null;
  gender: Gender | null;
  age: number | null;
  height?: number;
  weight?: number;
  concerns: string[];
  points: number;
  created_at: number;
  updated_at: number;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
}

export interface HealthReport {
  id: string;
  user_id: string;
  date: string;
  face_analysis: string | null;
  voice_analysis: string | null;
  suggestions: string[];
  // Serialized `DoctorReport` (the rich GENERATE_REPORT payload), if present.
  report_json?: string | null;
  created_at: number;
}

// ─── Rich doctor report (the GENERATE_REPORT `report` object) ──
// Every field is optional: the model fills only what this consultation gathered.

export interface ReportItem {
  key: string;
  value: string;
  tag?: string;
}

export interface SizhenSection {
  status: string;
  items: ReportItem[];
}

export interface DoctorReport {
  patientName?: string;
  age?: string;
  bodyType?: string;
  chiefComplaint?: string;
  doctorNote?: string;
  sizhen?: {
    face?: SizhenSection;
    tongue?: SizhenSection;
    voice?: SizhenSection;
    inquiry?: SizhenSection;
  };
  analysis?: {
    bagang?: string;
    organs?: string;
    nature?: string;
    zhengxing?: string[];
    tizhi?: string;
    tizhiNote?: string;
  };
  reasoning?: { observation: string; principle: string }[];
  advice?: {
    zhifa?: string;
    food?: {
      recommended?: string[];
      recipes?: { name: string; detail: string }[];
      avoid?: string;
    };
    lifestyle?: string[];
    acupoints?: { name: string; location?: string; method?: string; effect?: string }[];
    exercise?: string;
    warning?: string;
  };
}

export interface Task {
  id: string;
  plan_id: string;
  text: string;
  sort_order: number;
  completed: boolean;
  completed_at: number | null;
}

export interface Plan {
  id: string;
  user_id: string;
  created_at: number;
  active: boolean;
  tasks: Task[];
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price_hkd: number;
  category: 'tea' | 'soup' | 'paste';
  source: string;
  image_url: string | null;
}

export interface Clinic {
  id: string;
  name: string;
  location: string;
  specialties: string[];
  rating: number | null;
  distance: string | null;
  image_url: string | null;
}

export interface UpdateUserProfileBody {
  name: string;
  gender: Gender;
  age: number;
  height?: number;
  weight?: number;
  concerns?: string[];
}

export interface AuthLoginBody {
  idToken: string;
  // Apple only sends the user's name in the *initial* authorization response,
  // not in the ID token. The client forwards it on first sign-in so we can
  // persist it.
  name?: string;
}

export interface AuthLoginResponse {
  token: string;
  user: User;
}

export interface PostMessageBody {
  role: 'user' | 'assistant';
  content: string;
}

export interface PostReportBody {
  date: string;
  face_analysis: string;
  voice_analysis: string;
  suggestions: string[];
  report_json?: string;
}

export interface ChatRequestBody {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  model?: string;
}

export interface TtsRequestBody {
  text: string;
}

export interface VoiceMetricsPayload {
  duration_sec: number;
  intensity_db: number;
  f0_mean_hz: number;
  f0_sd_hz: number;
  voiced_ratio: number;
  pause_count: number;
  spectral_tilt: number;
  jitter_approx: number;
}

export interface DiagnosisRequestBody {
  image?: string;
  transcript?: string;
  /** Real audio metrics from frontend Web Audio API analysis */
  voiceMetrics?: VoiceMetricsPayload;
}

export interface DiagnosisResult {
  structured: Record<string, unknown> | null;
  // Plain-text block re-injected into the chat (matches the persona 信号回传 format).
  summary: string;
}

export interface CreatePlanBody {
  tasks?: { text: string }[];
}

export interface AddPointsBody {
  delta: number;
  reason: string;
  task_id?: string;
}
