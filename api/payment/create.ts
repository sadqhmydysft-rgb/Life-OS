/**
 * POST /api/payment/create
 *
 * Starts an Aghaye Pardakht ("آقای پرداخت") payment for the authenticated
 * caller. Amount is always computed server-side from a fixed price table —
 * never trusted from the client — to prevent price tampering.
 */

const SUPA_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPA_ANON = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const PIN = process.env.AGHAYE_PARDAKHT_PIN;
const SITE_URL = "https://life-os-one-teal.vercel.app";

const PLAN_PRICES: Record<string, number> = {
  monthly: 49000,
  yearly: 490000,
  lifetime: 690000,
};

async function authedUser(req: any): Promise<{ id: string; email?: string } | null> {
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
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!SUPA_URL || !SUPA_ANON) return res.status(503).json({ error: "Supabase is not configured" });
  if (!PIN) return res.status(503).json({ error: "AGHAYE_PARDAKHT_PIN is not configured" });

  const user = await authedUser(req);
  if (!user) return res.status(401).json({ error: "Authentication required" });

  let body: { plan?: string };
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const plan = body.plan;
  if (!plan || !(plan in PLAN_PRICES)) {
    return res.status(400).json({ error: "plan must be one of: monthly, yearly, lifetime" });
  }
  const amount = PLAN_PRICES[plan];
  const invoiceId = `${user.id}|${plan}`;

  try {
    const r = await fetch("https://panel.aqayepardakht.ir/api/v2/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pin: PIN,
        amount,
        callback: `${SITE_URL}/api/payment/callback`,
        invoice_id: invoiceId,
        email: user.email,
        description: `Life OS — اشتراک ${plan}`,
      }),
    });
    const data: any = await r.json();
    if (data.status !== "success") {
      return res.status(422).json({ error: "خطا در ایجاد تراکنش", code: data.code });
    }
    const startpayPath = PIN === "sandbox" ? "startpay/sandbox" : "startpay";
    return res.status(200).json({
      redirect: `https://panel.aqayepardakht.ir/${startpayPath}/${data.transid}`,
    });
  } catch (e: any) {
    return res.status(502).json({ error: e?.message ?? "Upstream error" });
  }
}
