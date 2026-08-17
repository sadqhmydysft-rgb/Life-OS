/**
 * Real Google sign-in, fully client-side, via Google Identity Services (GIS).
 *
 * Active when VITE_GOOGLE_CLIENT_ID is set (build-time env var). The user
 * clicks "Continue with Google" → Google's own account chooser / consent
 * popup opens (accounts.google.com) → we receive an OAuth access token →
 * fetch the verified profile from Google's userinfo endpoint and create the
 * Rozvan session from that real identity.
 *
 * Setup (Google Cloud Console):
 *   APIs & Services → Credentials → Create OAuth client ID (type: Web)
 *   → Authorized JavaScript origins: your site origin(s), e.g.
 *     https://<your-app>.vercel.app  (no redirect URI needed for token flow)
 *   → paste the client ID into VITE_GOOGLE_CLIENT_ID and redeploy.
 */

export interface GoogleProfile {
  sub: string;
  name?: string;
  given_name?: string;
  email?: string;
  picture?: string;
  email_verified?: boolean;
}

const GIS_SRC = "https://accounts.google.com/gsi/client";
let gisLoad: Promise<void> | null = null;

export function googleClientId(): string | null {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  return id && id.includes("apps.googleusercontent.com") ? id : null;
}

function loadGis(): Promise<void> {
  if (gisLoad) return gisLoad;
  gisLoad = new Promise<void>((resolve, reject) => {
    if ((window as unknown as { google?: unknown }).google) return resolve();
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("gis-load-failed"));
    document.head.appendChild(s);
    window.setTimeout(() => reject(new Error("gis-timeout")), 15000);
  });
  return gisLoad;
}

interface GoogleTokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
}

interface GoogleOauth2 {
  initTokenClient: (cfg: {
    client_id: string;
    scope: string;
    callback: (resp: { access_token?: string; error?: string }) => void;
    error_callback?: (err: { type?: string }) => void;
  }) => GoogleTokenClient;
}

/** opens the real Google popup and resolves with the verified profile */
export async function signInWithGoogle(): Promise<GoogleProfile> {
  const clientId = googleClientId();
  if (!clientId) throw new Error("no-client-id");
  await loadGis();

  const oauth2 = (window as unknown as { google: { accounts: { oauth2: GoogleOauth2 } } }).google
    .accounts.oauth2;

  const token = await new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      callback: (resp) => {
        if (resp.access_token) resolve(resp.access_token);
        else reject(new Error(resp.error ?? "cancelled"));
      },
      error_callback: (err) => reject(new Error(err?.type ?? "popup-closed")),
    });
    client.requestAccessToken({ prompt: "" });
  });

  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("userinfo-failed");
  const profile = (await res.json()) as GoogleProfile;
  if (!profile.email) throw new Error("no-email");
  return profile;
}
