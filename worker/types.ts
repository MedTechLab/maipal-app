// Shared types between the Worker (D1 rows + responses) and the React client.
// The client imports from `@shared/types` (see vite alias).

export type Gender = 'male' | 'female';

export interface User {
  id: string;
  name: string;
  gender: Gender;
  age: number;
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
  created_at: number;
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

export interface CreateUserBody {
  id?: string; // device-generated UUID; server will allocate if absent
  name: string;
  gender: Gender;
  age: number;
  height?: number;
  weight?: number;
  concerns?: string[];
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
}

export interface AddPointsBody {
  delta: number;
  reason: string;
  task_id?: string;
}
