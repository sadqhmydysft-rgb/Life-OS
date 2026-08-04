import type { User } from "./types";
import { supa } from "./supabase";
import { getLocalErrors, type ErrorEntry } from "./errorlog";
import { addDaysISO, todayISO } from "./dates";

export interface AdminUserRow {
  email: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AdminData {
  total: number;
  activeToday: number;
  errorCount: number;
  signups14: { day: string; count: number }[];
  users: AdminUserRow[];
  errors: ErrorEntry[];
  /** when the server route couldn't serve (e.g. missing env), show why */
  backendNote?: string;
}

function loadLocalUsers(): User[] {
  try {
    return JSON.parse(localStorage.getItem("lifeos:users") ?? "[]") as User[];
  } catch {
    return [];
  }
}

function buildBuckets(users: { createdAt: string }[]): { day: string; count: number }[] {
  const today = todayISO();
  const out: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = addDaysISO(today, -i);
    out.push({ day, count: users.filter((u) => u.createdAt.slice(0, 10) === day).length });
  }
  return out;
}

export async function getAdminData(mode: "supabase" | "local"): Promise<AdminData> {
  if (mode === "supabase") {
    const session = await supa.getValidSession();
    const headers: Record<string, string> = session
      ? { authorization: `Bearer ${session.access_token}` }
      : {};

    const [usersRes, errorsRes] = await Promise.all([
      fetch("/api/admin/users", { headers }).catch(() => null),
      fetch("/api/admin/errors", { headers }).catch(() => null),
    ]);

    let users: AdminUserRow[] = [];
    let signups14: { day: string; count: number }[] = buildBuckets([]);
    let activeToday = 0;
    let backendNote: string | undefined;

    if (usersRes?.ok) {
      const d = (await usersRes.json()) as {
        users: AdminUserRow[];
        signups14: { day: string; count: number }[];
        activeToday: number;
        total: number;
      };
      users = d.users;
      signups14 = d.signups14;
      activeToday = d.activeToday;
    } else {
      const body = usersRes ? await usersRes.json().catch(() => ({})) : {};
      backendNote =
        (body as { error?: string }).error ?? "users endpoint unavailable (server env not configured)";
    }

    let errors: ErrorEntry[] = getLocalErrors().slice(0, 50);
    if (errorsRes?.ok) {
      const rows = (await errorsRes.json()) as {
        id: number;
        created_at: string;
        email?: string;
        message: string;
        source: "client" | "api";
        path?: string;
        status?: number;
      }[];
      errors = rows.map((r) => ({
        id: String(r.id),
        ts: Date.parse(r.created_at),
        email: r.email,
        message: r.message,
        source: r.source,
        path: r.path,
        status: r.status,
      }));
    }

    return {
      total: users.length,
      activeToday,
      errorCount: errors.length,
      signups14,
      users,
      errors: errors.slice(0, 50),
      backendNote,
    };
  }

  /* local mode: the device's own registry */
  const users = loadLocalUsers().sort((a, b) =>
    `${b.createdAt}${b.lastLoginAt ?? ""}`.localeCompare(`${a.createdAt}${a.lastLoginAt ?? ""}`),
  );
  const today = todayISO();
  const errors = getLocalErrors();
  return {
    total: users.length,
    activeToday: users.filter((u) => u.lastLoginAt?.startsWith(today)).length,
    errorCount: errors.length,
    signups14: buildBuckets(users),
    users: users.map((u) => ({ email: u.email, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt })),
    errors: errors.slice(0, 50),
  };
}
