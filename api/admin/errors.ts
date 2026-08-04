/**
 * GET  /api/admin/errors  — admin-only: last 50 error_logs rows.
 * POST /api/admin/errors  — any authenticated user: append an error entry.
 *
 * Two enforcement layers:
 *  1. This handler verifies the caller's Supabase token server-side and REJECTS
 *     non-admins for reads before touching the database.
 *  2. All DB access uses the CALLER's token, so the error_logs RLS policies
 *     (insert: authenticated; select: admin-only) are a second, independent gate.
 */

const SUPA_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPA_ANON = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

interface AuthUser {
  id: string;
  email?: string;
  app_metadata?: { is_admin?: boolean };
}

async function authedUser(req: any): Promise<AuthUser | null> {
  const auth = req.headers.authorization ?? req.headers.Authorization;
  if (!auth || !String(auth).startsWith("Bearer ") || !SUPA_URL || !SUPA_ANON) return null;
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { apikey: SUPA_ANON, authorization: String(auth) },
    });
    if (!r.ok) return null;
    return (await r.json()) as AuthUser;
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!SUPA_URL || !SUPA_ANON) return res.status(503).json({ error: "Supabase is not configured" });

  const auth = String(req.headers.authorization ?? "");
  const user = await authedUser(req);
  if (!user) return res.status(401).json({ error: "Authentication required" });

  if (req.method === "GET") {
    if (user.app_metadata?.is_admin !== true) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const r = await fetch(
      `${SUPA_URL}/rest/v1/error_logs?select=id,created_at,email,message,source,path,status&order=created_at.desc&limit=50`,
      { headers: { apikey: SUPA_ANON, authorization: auth } }, // caller token → RLS re-enforced at the DB
    );
    const body = await r.json();
    if (!r.ok) return res.status(r.status).json(body);
    return res.status(200).json(body);
  }

  if (req.method === "POST") {
    let body: any = req.body ?? {};
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: "Invalid JSON" });
      }
    }
    const message = String(body.message ?? "").slice(0, 500);
    if (!message) return res.status(400).json({ error: "message is required" });
    const row = {
      user_id: user.id,
      email: user.email ?? null,
      message,
      source: body.source === "api" ? "api" : "client",
      path: body.path ? String(body.path).slice(0, 200) : null,
      status: Number.isFinite(body.status) ? body.status : null,
    };
    const r = await fetch(`${SUPA_URL}/rest/v1/error_logs`, {
      method: "POST",
      headers: {
        apikey: SUPA_ANON,
        authorization: auth,
        "content-type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (!r.ok) return res.status(r.status).json(await r.json());
    return res.status(201).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
