export type Lang = "fa" | "en";
export type ThemeMode = "light" | "dark" | "system";

export type Priority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "inprogress" | "done";
export type HabitFrequency = "daily" | "weekly";

export type GoalCategory =
  | "health"
  | "career"
  | "learning"
  | "finance"
  | "relationships"
  | "personal";

export interface User {
  id: string;
  name: string;
  email: string;
  passHash?: string;
  avatarUrl?: string;
  provider: "email" | "google";
  createdAt: string;
  /** site-owner flag; only editable server-side (Supabase app_metadata) or via local-mode gate */
  is_admin?: boolean;
  lastLoginAt?: string; // ISO datetime
}

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
}

export interface Goal {
  id: string;
  title: string;
  category: GoalCategory;
  targetDate: string; // ISO yyyy-mm-dd
  milestones: Milestone[];
  manualProgress: number; // 0..100, used when no milestones/linked tasks
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  dueDate?: string; // ISO
  priority: Priority;
  tags: string[];
  goalId?: string;
  status: TaskStatus;
  today: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface Habit {
  id: string;
  title: string;
  frequency: HabitFrequency;
  targetPerWeek: number; // for weekly habits
  color: string; // hex used for identity dot
  createdAt: string;
}

export type HabitLogs = Record<string, string[]>; // habitId -> ISO dates

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
  /** where the reply came from: live Claude (server key / user key) or the local engine */
  source?: "server" | "byok" | "local";
}

export interface UserData {
  goals: Goal[];
  tasks: Task[];
  habits: Habit[];
  logs: HabitLogs;
  chat: ChatMessage[];
}

export const GOAL_CATEGORIES: GoalCategory[] = [
  "health",
  "career",
  "learning",
  "finance",
  "relationships",
  "personal",
];

export const CATEGORY_COLORS: Record<GoalCategory, string> = {
  health: "#10b981",
  career: "#6366f1",
  learning: "#f59e0b",
  finance: "#0ea5e9",
  relationships: "#ec4899",
  personal: "#8b5cf6",
};
