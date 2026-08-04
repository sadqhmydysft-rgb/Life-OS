import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Habit, HabitLogs, Task } from "./types";
import { addDaysISO, todayISO, weekStartISO, type Lang } from "./dates";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

/* ---------------- habits ---------------- */

export function habitDoneOn(logs: HabitLogs, habitId: string, iso: string): boolean {
  return (logs[habitId] ?? []).includes(iso);
}

export function habitCountInWeek(logs: HabitLogs, habitId: string, weekStart: string): number {
  const set = new Set(logs[habitId] ?? []);
  let c = 0;
  for (let i = 0; i < 7; i++) if (set.has(addDaysISO(weekStart, i))) c++;
  return c;
}

/** consecutive-day streak ending today or yesterday */
export function habitStreak(logs: HabitLogs, habit: Habit, lang: Lang): number {
  const set = new Set(logs[habit.id] ?? []);
  const today = todayISO();
  if (habit.frequency === "weekly") {
    // streak of qualifying weeks
    let streak = 0;
    let ws = weekStartISO(today, lang);
    // current week counts only if already qualified; otherwise start from previous week
    if (habitCountInWeek(logs, habit.id, ws) >= habit.targetPerWeek) {
      streak++;
    }
    ws = addDaysISO(ws, -7);
    while (habitCountInWeek(logs, habit.id, ws) >= habit.targetPerWeek && streak < 520) {
      streak++;
      ws = addDaysISO(ws, -7);
    }
    return streak;
  }
  let streak = 0;
  let cursor = set.has(today) ? today : addDaysISO(today, -1);
  while (set.has(cursor) && streak < 10000) {
    streak++;
    cursor = addDaysISO(cursor, -1);
  }
  return streak;
}

export function habitRate14(logs: HabitLogs, habit: Habit): number {
  const set = new Set(logs[habit.id] ?? []);
  const today = todayISO();
  let done = 0;
  for (let i = 0; i < 14; i++) if (set.has(addDaysISO(today, -i))) done++;
  return habit.frequency === "daily" ? done / 14 : Math.min(1, done / (habit.targetPerWeek * 2));
}

/* ---------------- tasks ---------------- */

const PRIORITY_W = { high: 3, medium: 2, low: 1 } as const;

/** coach's prioritization score: priority, urgency, goal link, today flag */
export function taskScore(t: Task): number {
  const today = todayISO();
  let s = PRIORITY_W[t.priority] * 10;
  if (t.dueDate) {
    if (t.dueDate < today) s += 16;
    else if (t.dueDate === today) s += 12;
    else {
      const diff = Math.round(
        (new Date(t.dueDate + "T00:00").getTime() - new Date(today + "T00:00").getTime()) / 86_400_000,
      );
      if (diff <= 2) s += 7;
      else if (diff <= 5) s += 3;
    }
  }
  if (t.goalId) s += 5;
  if (t.today) s += 6;
  return s;
}

export function openTasksSorted(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => taskScore(b) - taskScore(a));
}

/* ---------------- goals ---------------- */

/** progress derived from milestones and linked tasks; manual slider when neither exists */
export function goalProgress(goal: { manualProgress: number; milestones: { done: boolean }[] }, linkedTasks: Task[]): number {
  const sources: number[] = [];
  if (goal.milestones.length > 0) {
    sources.push(
      (goal.milestones.filter((m) => m.done).length / goal.milestones.length) * 100,
    );
  }
  if (linkedTasks.length > 0) {
    sources.push(
      (linkedTasks.filter((t) => t.status === "done").length / linkedTasks.length) * 100,
    );
  }
  if (sources.length === 0) return goal.manualProgress;
  return Math.round(sources.reduce((a, b) => a + b, 0) / sources.length);
}

export function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
