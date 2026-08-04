/**
 * GET /api/admin/users — admin-only user directory.
 *
 * Verifies the caller's Supabase JWT server-side and requires
 * app_metadata.is_admin === true before touching anything. The user list
 * itself requires SUPABASE_SERVICE_ROLE_KEY (server-only env var); without
 * it the route returns 503 and leaks nothing.
 */

const SUPA_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPA_ANON = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function authedUser(req: any): Promise<{ id: string; app_metadata?: { is_admin?: boolean } } | null> {
  const auth = req.headers.authorization ?? req.headers.Authorization;
  if (!auth || !String(auth).startsWith("Bearer ") || !SUPA_URL || !SUPA_ANON) return null;
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { apikey: SUPA_ANON, authorization: String(auth) },
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!SUPA_URL || !SUPA_ANON) return res.status(503).json({ error: "Supabase is not configured" });

  const user = await authedUser(req);
  if (!user) return res.status(401).json({ error: "Authentication required" });
  if (user.app_metadata?.is_admin !== true) {
    return res.status(403).json({ error: "Admin access required" });
  }
  if (!SERVICE) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" });

  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users?per_page=1000`, {
      headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}` },
    });
    if (!r.ok) return res.status(r.status).json(await r.json());
    const data = (await r.json()) as {
      users: { email?: string; created_at: string; last_sign_in_at?: string }[];
    };

    const users = (data.users ?? [])
      .filter((u) => u.email)
      .map((u) => ({
        email: u.email as string,
        createdAt: u.created_at,
        lastLoginAt: u.last_sign_in_at ?? undefined,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const dayMs = 86_400_000;
    const todayStr = new Date().toISOString().slice(0, 10);
    const signups14: { day: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(Date.now() - i * dayMs).toISOString().slice(0, 10);
      signups14.push({
        day,
        count: users.filter((u) => u.createdAt.slice(0, 10) === day).length,
      });
    }
    const activeToday = users.filter(
      (u) => u.lastLoginAt && u.lastLoginAt.slice(0, 10) === todayStr,
    ).length;

    return res.status(200).json({ total: users.length, activeToday, signups14, users });
  } catch (e: any) {
    return res.status(502).json({ error: e?.message ?? "Upstream error" });
  }
}
