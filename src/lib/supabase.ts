/**
 * Zero-dependency Supabase integration (GoTrue auth + PostgREST data).
 *
 * Active only when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set as
 * environment variables (e.g. in Vercel project settings) — then rebuilt.
 * Without them the app runs in local-first mode and never touches the network.
 *
 * Required table (run once in the Supabase SQL editor):
 *
 *   create table if not exists public.lifeos_data (
 *     id uuid primary key references auth.users(id) on delete cascade,
 *     data jsonb not null default '{"goals":[],"tasks":[],"habits":[],"logs":{},"chat":[]}',
 *     updated_at timestamptz not null default now()
 *   );
 *   alter table public.lifeos_data enable row level security;
 *   create policy "own data" on public.lifeos_data
 *     for all using (auth.uid() = id) with check (auth.uid() = id);
 *
 * Google OAuth: enable the Google provider in Supabase Auth and add your
 * site URL (e.g. https://your-app.vercel.app) to Redirect URLs.
 */

import type { UserData } from "./types";

export interface SupaSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // ms epoch
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
    app_metadata?: { provider?: string; is_admin?: boolean };
    last_sign_in_at?: string;
  };
}

const LS_KEY = "lifeos:supa:session";

interface Creds {
  url: string;
  anon: string;
}

function creds(): Creds | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anon || !url.startsWith("http")) return null;
  return { url: url.replace(/\/$/, ""), anon };
}

export function supabaseEnabled(): boolean {
  return creds() !== null;
}

export class SupaError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function req<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const c = creds();
  if (!c) throw new SupaError("not_configured", "Supabase is not configured");
  const headers: Record<string, string> = {
    apikey: c.anon,
    "content-type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${c.url}${path}`, { ...init, headers });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* non-json */
  }
  if (!res.ok) {
    const msg =
      (body.error_description as string) || (body.msg as string) || (body.error as string) || `HTTP ${res.status}`;
    throw new SupaError((body.error_code as string) || (body.error as string) || "error", msg);
  }
  return body as T;
}

function persist(session: SupaSession | null) {
  if (session) localStorage.setItem(LS_KEY, JSON.stringify(session));
  else localStorage.removeItem(LS_KEY);
}

function toSession(raw: Record<string, unknown>): SupaSession {
  return {
    access_token: raw.access_token as string,
    refresh_token: (raw.refresh_token as string) ?? "",
    expires_at: Date.now() + (Number(raw.expires_in ?? 3600) - 60) * 1000,
    user: raw.user as SupaSession["user"],
  };
}

export const supa = {
  /* ------------------------------ session ------------------------------ */

  storedSession(): SupaSession | null {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? (JSON.parse(raw) as SupaSession) : null;
    } catch {
      return null;
    }
  },

  /** valid session, refreshing the access token when needed */
  async getValidSession(): Promise<SupaSession | null> {
    const s = supa.storedSession();
    if (!s) return null;
    if (Date.now() < s.expires_at) return s;
    if (!s.refresh_token) {
      persist(null);
      return null;
    }
    try {
      const fresh = toSession(
        await req<Record<string, unknown>>("/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          body: JSON.stringify({ refresh_token: s.refresh_token }),
        }),
      );
      persist(fresh);
      return fresh;
    } catch {
      persist(null);
      return null;
    }
  },

  /** parse tokens from the URL hash after an OAuth redirect (implicit flow) */
  consumeRedirectSession(): SupaSession | null {
    if (!window.location.hash.includes("access_token")) return null;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const access = params.get("access_token");
    if (!access) return null;
    const session: SupaSession = {
      access_token: access,
      refresh_token: params.get("refresh_token") ?? "",
      expires_at: Date.now() + (Number(params.get("expires_in") ?? 3600) - 60) * 1000,
      user: { id: "", email: "" },
    };
    // clean the URL immediately so tokens don't linger in history
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return session;
  },

  /** hydrate session.user after an OAuth redirect (id/email unknown at parse time) */
  async hydrateUser(session: SupaSession): Promise<SupaSession> {
    if (session.user.id) return session;
    const user = await req<SupaSession["user"]>("/auth/v1/user", {}, session.access_token);
    const full = { ...session, user };
    persist(full);
    return full;
  },

  /* ------------------------------ auth ------------------------------ */

  /** returns { session } when email confirmation is off, otherwise { needsConfirm: true } */
  async signUp(
    email: string,
    password: string,
    name: string,
  ): Promise<{ session: SupaSession | null; needsConfirm: boolean }> {
    const body = await req<Record<string, unknown>>("/auth/v1/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, data: { name } }),
    });
    if (body.access_token) {
      const session = toSession(body);
      persist(session);
      return { session, needsConfirm: false };
    }
    // GoTrue returns the user object (no session) when confirmation is required
    if (body.user || body.id) return { session: null, needsConfirm: true };
    // "fake" success to avoid user enumeration — treat as confirmation flow
    return { session: null, needsConfirm: true };
  },

  async signIn(email: string, password: string): Promise<SupaSession> {
    const session = toSession(
      await req<Record<string, unknown>>("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    );
    persist(session);
    return session;
  },

  signInWithGoogle(redirectTo: string): void {
    const c = creds();
    if (!c) return;
    const url = `${c.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
    window.location.assign(url);
  },

  async sendRecovery(email: string, redirectTo: string): Promise<void> {
    await req("/auth/v1/recover", {
      method: "POST",
      body: JSON.stringify({ email, redirect_to: redirectTo }),
    });
  },

  async signOut(): Promise<void> {
    const s = supa.storedSession();
    persist(null);
    if (s) {
      try {
        await req("/auth/v1/logout", { method: "POST", body: "{}" }, s.access_token);
      } catch {
        /* token may already be gone */
      }
    }
  },

  /* ------------------------------ data ------------------------------ */

  async loadData(session: SupaSession): Promise<UserData | null> {
    try {
      const rows = await req<{ data: UserData }[]>(
        `/rest/v1/lifeos_data?select=data&id=eq.${session.user.id}`,
        {},
        session.access_token,
      );
      return Array.isArray(rows) && rows[0] ? rows[0].data : null;
    } catch {
      return null; // table may not exist yet — local cache keeps working
    }
  },

  async saveData(session: SupaSession, data: UserData): Promise<void> {
    await req(
      "/rest/v1/lifeos_data",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ id: session.user.id, data, updated_at: new Date().toISOString() }),
      },
      session.access_token,
    );
  },
};
