import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ChatMessage,
  Goal,
  Habit,
  HabitLogs,
  Lang,
  Reflection,
  Task,
  User,
  UserData,
} from "./types";
import { uid } from "./utils";
import { todayISO } from "./dates";
import { supa, supabaseEnabled, type SupaSession } from "./supabase";
import { googleClientId, signInWithGoogle } from "./google";
import { setErrorUser, registerRemoteSink, type ErrorEntry } from "./errorlog";

/* ------------------------------------------------------------------ */
/* local persistence helpers (also the offline cache in Supabase mode)  */
/* ------------------------------------------------------------------ */

const LS_USERS = "lifeos:users";
const LS_SESSION = "lifeos:session";
const dataKey = (userId: string) => `lifeos:data:${userId}`;

function loadUsers(): User[] {
  try {
    return JSON.parse(localStorage.getItem(LS_USERS) ?? "[]") as User[];
  } catch {
    return [];
  }
}

function saveUsers(users: User[]) {
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}

function loadLocalData(userId: string): UserData {
  try {
    const raw = localStorage.getItem(dataKey(userId));
    if (raw) return JSON.parse(raw) as UserData;
  } catch {
    /* fall through */
  }
  return emptyData();
}

function saveLocalData(userId: string, data: UserData) {
  localStorage.setItem(dataKey(userId), JSON.stringify(data));
}

function emptyData(): UserData {
  return { goals: [], tasks: [], habits: [], logs: {}, chat: [], reflections: [] };
}

async function hashPassword(pw: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${pw}::lifeos`));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function userFromSupa(session: SupaSession): User {
  const meta = session.user.user_metadata ?? {};
  const email = session.user.email ?? "";
  const name =
    (meta.full_name as string) || (meta.name as string) || email.split("@")[0] || "User";
  return {
    id: session.user.id,
    name,
    email,
    provider: session.user.app_metadata?.provider === "google" ? "google" : "email",
    createdAt: todayISO(),
    is_admin: session.user.app_metadata?.is_admin === true,
    is_premium: session.user.app_metadata?.is_premium === true,
    lastLoginAt: session.user.last_sign_in_at,
  };
}

function markLogin(userId: string) {
  const users = loadUsers();
  const idx = users.findIndex((x) => x.id === userId);
  if (idx === -1) return;
  users[idx] = { ...users[idx], lastLoginAt: new Date().toISOString() };
  saveUsers(users);
}

/* ------------------------------------------------------------------ */
/* context                                                             */
/* ------------------------------------------------------------------ */

export type BackendMode = "supabase" | "local";

interface AppCtx {
  user: User | null;
  authReady: boolean;
  backendMode: BackendMode;
  /** returns an i18n key on failure/notice, null on clean success */
  login: (email: string, password: string) => Promise<string | null>;
  signup: (name: string, email: string, password: string) => Promise<string | null>;
  /** null = success (or OAuth redirect started); otherwise an i18n error key */
  loginGoogle: () => Promise<string | null>;
  logout: () => void;
  resetPassword: (email: string, newPassword: string) => Promise<string | null>;
  /** local mode only: claims admin for the current device account */
  makeLocalAdmin: () => void;

  goals: Goal[];
  tasks: Task[];
  habits: Habit[];
  logs: HabitLogs;
  chat: ChatMessage[];
  reflections: Reflection[];

  addReflection: (r: Omit<Reflection, "id" | "createdAt">) => Reflection;
  addGoal: (g: Omit<Goal, "id" | "createdAt">) => Goal;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;

  addTask: (t: Omit<Task, "id" | "createdAt">) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;

  addHabit: (h: Omit<Habit, "id" | "createdAt">) => Habit;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  toggleHabitDay: (habitId: string, iso: string) => void;

  appendChat: (role: ChatMessage["role"], content: string) => string;
  patchChatMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearChat: () => void;

  coachOpen: boolean;
  setCoachOpen: (v: boolean) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const backendMode: BackendMode = supabaseEnabled() ? "supabase" : "local";
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLogs>({});
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [coachOpen, setCoachOpen] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const remoteTimer = useRef<number | null>(null);

  /* error logging remote sink: push entries to error_logs via the admin API */
  useEffect(() => {
    if (backendMode === "supabase" && user) {
      registerRemoteSink((entry: ErrorEntry) => {
        void (async () => {
          const session = await supa.getValidSession();
          if (!session) return;
          try {
            await fetch("/api/admin/errors", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                message: entry.message,
                source: entry.source,
                path: entry.path,
                status: entry.status,
              }),
            });
          } catch {
            /* offline — local ring buffer has it */
          }
        })();
      });
    } else {
      registerRemoteSink(null);
    }
    return () => registerRemoteSink(null);
  }, [user, backendMode]);

  /* ------------------------------ session restore ------------------------------ */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (backendMode === "supabase") {
          // OAuth redirect return? tokens live in the URL hash
          let session = supa.consumeRedirectSession();
          if (session) session = await supa.hydrateUser(session);
          else session = await supa.getValidSession();

          if (session && !cancelled) {
            const u = userFromSupa(session);
            const remote = await supa.loadData(session);
            const data = remote ?? loadLocalData(u.id);
            if (!cancelled) adoptInternal(u, data, false);
          }
        } else {
          const raw = localStorage.getItem(LS_SESSION);
          if (raw) {
            const { userId } = JSON.parse(raw) as { userId: string };
            const u = loadUsers().find((x) => x.id === userId);
            if (u && !cancelled) adoptInternal(u, loadLocalData(u.id), false);
          }
        }
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------ persistence ------------------------------ */
  useEffect(() => {
    if (!user || loadedFor.current !== user.id) return;
    const data = { goals, tasks, habits, logs, chat, reflections };
    saveLocalData(user.id, data); // warm offline cache
    if (backendMode === "supabase") {
      if (remoteTimer.current) window.clearTimeout(remoteTimer.current);
      remoteTimer.current = window.setTimeout(async () => {
        const session = await supa.getValidSession();
        if (session) {
          try {
            await supa.saveData(session, data);
          } catch {
            /* offline — local cache retains everything, retried on next change */
          }
        }
      }, 900);
    }
  }, [user, backendMode, goals, tasks, habits, logs, chat, reflections]);

  const adoptInternal = useCallback((u: User, data: UserData, remember: boolean) => {
    setErrorUser({ id: u.id, email: u.email });
    loadedFor.current = u.id;
    setUser(u);
    setGoals(data.goals);
    setTasks(data.tasks);
    setHabits(data.habits);
    setLogs(data.logs);
    setChat(data.chat);
    setReflections(data.reflections ?? []);
    saveLocalData(u.id, data);
    if (remember) localStorage.setItem(LS_SESSION, JSON.stringify({ userId: u.id }));
  }, []);

  const currentLang = (): Lang => (localStorage.getItem("lifeos:lang") === "en" ? "en" : "fa");

  /* ------------------------------ auth ------------------------------ */

  const signup = useCallback(
    async (name: string, email: string, password: string): Promise<string | null> => {
      const norm = email.trim().toLowerCase();
      if (backendMode === "supabase") {
        try {
          const { session, needsConfirm } = await supa.signUp(norm, password, name.trim());
          if (session) adoptInternal(userFromSupa(session), emptyData(), false);
          else if (needsConfirm) return "auth.okCheckEmail";
          return null;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (/already|registered|exists/i.test(msg)) return "auth.errEmailExists";
          return "auth.errGeneric";
        }
      }
      const users = loadUsers();
      if (users.some((u) => u.email === norm)) return "auth.errEmailExists";
      const u: User = {
        id: uid(),
        name: name.trim(),
        email: norm,
        passHash: await hashPassword(password),
        provider: "email",
        createdAt: todayISO(),
      };
      saveUsers([...users, u]);
      markLogin(u.id);
      adoptInternal(u, emptyData(), true);
      return null;
    },
    [adoptInternal, backendMode],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const norm = email.trim().toLowerCase();
      if (backendMode === "supabase") {
        try {
          const session = await supa.signIn(norm, password);
          adoptInternal(userFromSupa(session), emptyData(), false);
          const remote = await supa.loadData(session);
          if (remote) adoptInternal(userFromSupa(session), remote, false);
          return null;
        } catch {
          return "auth.errInvalid";
        }
      }
      const u = loadUsers().find((x) => x.email === norm);
      if (!u || !u.passHash || u.passHash !== (await hashPassword(password)))
        return "auth.errInvalid";
      markLogin(u.id);
      adoptInternal(u, loadLocalData(u.id), true);
      return null;
    },
    [adoptInternal, backendMode],
  );

  const loginGoogle = useCallback(async (): Promise<string | null> => {
    /* 1) Supabase configured → real Google OAuth redirect */
    if (backendMode === "supabase") {
      supa.signInWithGoogle(window.location.origin + "/");
      return null; // full redirect
    }

    /* 2) Google OAuth Client ID configured → real GIS popup, verified profile */
    if (googleClientId()) {
      try {
        const profile = await signInWithGoogle();
        const email = (profile.email ?? "").toLowerCase();
        const users = loadUsers();
        const existing = users.find((x) => x.email === email);
        if (existing) {
          // returning Google account → keep their data, refresh identity
          const updated: User = {
            ...existing,
            name: profile.name || existing.name,
            avatarUrl: profile.picture ?? existing.avatarUrl,
            provider: "google",
            lastLoginAt: new Date().toISOString(),
          };
          saveUsers(users.map((x) => (x.id === existing.id ? updated : x)));
          adoptInternal(updated, loadLocalData(updated.id), true);
        } else {
          const u: User = {
            id: uid(),
            name: profile.name || email.split("@")[0],
            email,
            avatarUrl: profile.picture,
            provider: "google",
            createdAt: todayISO(),
          };
          saveUsers([...users, u]);
          adoptInternal(u, emptyData(), true);
        }
        return null;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (/cancel|closed|popup/i.test(msg)) return "auth.errGoogleCancel";
        return "auth.errGoogle";
      }
    }

    /* 3) no credentials configured → clearly labeled local demo identity */
    const users = loadUsers();
    const email = "demo.google@lifeos.app";
    const existing = users.find((x) => x.email === email);
    if (existing) {
      markLogin(existing.id);
      adoptInternal(existing, loadLocalData(existing.id), true);
    } else {
      const u: User = {
        id: uid(),
        name: currentLang() === "fa" ? "کاربر دمو" : "Demo User",
        email,
        provider: "google",
        createdAt: todayISO(),
      };
      saveUsers([...users, u]);
      adoptInternal(u, emptyData(), true);
    }
    return null;
  }, [adoptInternal, backendMode]);

  const resetPassword = useCallback(
    async (email: string, _newPassword: string): Promise<string | null> => {
      const norm = email.trim().toLowerCase();
      if (backendMode === "supabase") {
        try {
          await supa.sendRecovery(norm, window.location.origin + "/auth");
          return "auth.okResetSent";
        } catch {
          return "auth.errGeneric";
        }
      }
      const users = loadUsers();
      const idx = users.findIndex((x) => x.email === norm);
      if (idx === -1) return "auth.errNoAccount";
      users[idx] = { ...users[idx], passHash: await hashPassword(_newPassword) };
      saveUsers(users);
      return null;
    },
    [backendMode],
  );

  const logout = useCallback(() => {
    if (backendMode === "supabase") void supa.signOut();
    localStorage.removeItem(LS_SESSION);
    setErrorUser(null);
    loadedFor.current = null;
    setUser(null);
    setGoals([]);
    setTasks([]);
    setHabits([]);
    setLogs({});
    setChat([]);
    setReflections([]);
    setCoachOpen(false);
  }, [backendMode]);

  /* ------------------------------ data actions ------------------------------ */

  const addReflection = useCallback(
    (r: Omit<Reflection, "id" | "createdAt">): Reflection => {
      const reflection: Reflection = { ...r, id: uid(), createdAt: todayISO() };
      setReflections((prev) => [reflection, ...prev]);
      return reflection;
    },
    [],
  );

  const addGoal = useCallback((g: Omit<Goal, "id" | "createdAt">): Goal => {
    const goal: Goal = { ...g, id: uid(), createdAt: todayISO() };
    setGoals((prev) => [goal, ...prev]);
    return goal;
  }, []);

  const updateGoal = useCallback((id: string, patch: Partial<Goal>) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setTasks((prev) => prev.map((t) => (t.goalId === id ? { ...t, goalId: undefined } : t)));
  }, []);

  const addTask = useCallback((t: Omit<Task, "id" | "createdAt">): Task => {
    const task: Task = { ...t, id: uid(), createdAt: todayISO() };
    setTasks((prev) => [task, ...prev]);
    return task;
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch };
        if (patch.status === "done" && t.status !== "done") next.completedAt = todayISO();
        if (patch.status && patch.status !== "done") next.completedAt = undefined;
        return next;
      }),
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addHabit = useCallback((h: Omit<Habit, "id" | "createdAt">): Habit => {
    const habit: Habit = { ...h, id: uid(), createdAt: todayISO() };
    setHabits((prev) => [habit, ...prev]);
    return habit;
  }, []);

  const updateHabit = useCallback((id: string, patch: Partial<Habit>) => {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  }, []);

  const deleteHabit = useCallback((id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setLogs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const toggleHabitDay = useCallback((habitId: string, iso: string) => {
    setLogs((prev) => {
      const arr = prev[habitId] ?? [];
      const next = arr.includes(iso) ? arr.filter((d) => d !== iso) : [...arr, iso];
      return { ...prev, [habitId]: next };
    });
  }, []);

  const appendChat = useCallback((role: ChatMessage["role"], content: string): string => {
    const id = uid();
    setChat((prev) => [...prev.slice(-60), { id, role, content, ts: Date.now() }]);
    return id;
  }, []);

  const patchChatMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setChat((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const clearChat = useCallback(() => setChat([]), []);

  const makeLocalAdmin = useCallback(() => {
    if (!user || backendMode !== "local") return;
    const users = loadUsers();
    saveUsers(users.map((x) => (x.id === user.id ? { ...x, is_admin: true } : x)));
    setUser({ ...user, is_admin: true });
  }, [user, backendMode]);

  const value: AppCtx = {
    user,
    authReady,
    backendMode,
    login,
    signup,
    loginGoogle,
    logout,
    resetPassword,
    makeLocalAdmin,
    goals,
    tasks,
    habits,
    logs,
    chat,
    reflections,
    addReflection,
    addGoal,
    updateGoal,
    deleteGoal,
    addTask,
    updateTask,
    deleteTask,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleHabitDay,
    appendChat,
    patchChatMessage,
    clearChat,
    coachOpen,
    setCoachOpen,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}

/* re-exported for convenience */
export { uid };
