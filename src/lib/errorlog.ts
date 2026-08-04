/**
 * App-wide error capture: unhandled client errors + failed API/server calls.
 *
 * Every entry is written to a local ring buffer (works offline / local mode)
 * and, when a remote sink is registered (Supabase mode with a session), also
 * pushed to the error_logs table — where RLS makes inserts public but reads
 * admin-only.
 */

import { uid } from "./utils";

export interface ErrorEntry {
  id: string;
  ts: number;
  userId?: string;
  email?: string;
  message: string;
  source: "client" | "api";
  path?: string;
  status?: number;
}

const LS_ERRORS = "lifeos:errors";
const MAX_LOCAL = 200;
const recent = new Map<string, number>();

let currentUser: { id: string; email: string } | null = null;
export function setErrorUser(u: { id: string; email: string } | null) {
  currentUser = u;
}

type RemoteSink = (entry: ErrorEntry) => void;
let remoteSink: RemoteSink | null = null;
export function registerRemoteSink(fn: RemoteSink | null) {
  remoteSink = fn;
}

export function getLocalErrors(): ErrorEntry[] {
  try {
    const raw = localStorage.getItem(LS_ERRORS);
    const arr = raw ? (JSON.parse(raw) as ErrorEntry[]) : [];
    return arr.sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

export function clearLocalErrors() {
  localStorage.removeItem(LS_ERRORS);
}

export function logError(entry: Omit<ErrorEntry, "id" | "ts" | "userId" | "email">): ErrorEntry {
  const full: ErrorEntry = {
    id: uid(),
    ts: Date.now(),
    userId: currentUser?.id,
    email: currentUser?.email,
    ...entry,
  };

  // throttle identical messages (2s window)
  const sig = `${full.message}|${full.path}|${full.status}`;
  if ((recent.get(sig) ?? 0) > Date.now() - 2000) return full;
  recent.set(sig, Date.now());
  if (recent.size > 50) recent.delete(recent.keys().next().value as string);

  try {
    const arr = getLocalErrors();
    arr.unshift(full);
    localStorage.setItem(LS_ERRORS, JSON.stringify(arr.slice(0, MAX_LOCAL)));
  } catch {
    /* storage full — drop silently */
  }

  try {
    remoteSink?.(full);
  } catch {
    /* never let logging break the app */
  }
  return full;
}

function shouldLogApi(url: string, status: number): boolean {
  if (status < 400) return false;
  if (url.includes("/api/coach")) return false; // routine fallback when no key configured
  return url.includes("/api/") || url.includes("/rest/v1/");
}

let installed = false;
export function installErrorLogging() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    logError({ message: String(e.message || "Unhandled error").slice(0, 300), source: "client" });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "Promise rejection");
    logError({ message: reason.slice(0, 300), source: "client" });
  });

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.startsWith("http") ? new URL(url).pathname : url;
    try {
      const res = await origFetch(input, init);
      if (shouldLogApi(url, res.status)) {
        logError({
          message: `${(init?.method ?? "GET").toUpperCase()} ${path} → ${res.status}`,
          source: "api",
          path,
          status: res.status,
        });
      }
      return res;
    } catch (err) {
      if (url.includes("/api/") && !url.includes("/api/coach")) {
        logError({
          message: `${(init?.method ?? "GET").toUpperCase()} ${path} → network error`,
          source: "api",
          path,
        });
      }
      throw err;
    }
  };
}
