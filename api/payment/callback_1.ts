/**
 * POST /api/payment/callback
 *
 * Aghaye Pardakht redirects the user's browser here after payment.
 * We independently re-verify the transaction server-side (amount + transid)
 * before granting anything — the incoming "status" field is never trusted
 * on its own. On a verified success, the buyer's account is flagged
 * is_premium via the Supabase Admin API (service-role key), the same flag
 * checked everywhere premium features are gated.
 */

const SUPA_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIN = process.env.AGHAYE_PARDAKHT_PIN;
const SITE_URL = "https://life-os-one-teal.vercel.app";

const PLAN_PRICES: Record<string, number> = {
  monthly: 49000,
  yearly: 490000,
  lifetime: 690000,
};

function readParams(req: any): Record<string, string> {
  const fromBody = typeof req.body === "object" && req.body ? req.body : {};
  const fromQuery = req.query ?? {};
  return { ...fromQuery, ...fromBody };
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") return res.status(204).end();

  const params = readParams(req);
  const transid = params.transid;
  const invoiceId = params.invoice_id;

  const fail = (reason: string) =>
    res.redirect(302, `${SITE_URL}/?payment_failed=1&reason=${encodeURIComponent(reason)}`);

  if (!transid || !invoiceId) return fail("missing_params");
  if (!PIN || !SUPA_URL || !SERVICE) return fail("server_not_configured");

  const [userId, plan] = invoiceId.split("|");
  if (!userId || !plan || !(plan in PLAN_PRICES)) return fail("bad_invoice");
  const amount = PLAN_PRICES[plan];

  try {
    const verifyRes = await fetch("https://panel.aqayepardakht.ir/api/v2/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin: PIN, amount, transid }),
    });
    const verifyData: any = await verifyRes.json();
    if (verifyData.status !== "success" || String(verifyData.code) !== "1") {
      return fail("verify_failed");
    }

    const currentRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, {
      headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}` },
    });
    const current: any = currentRes.ok ? await currentRes.json() : {};
    const nextMeta = { ...(current?.app_metadata ?? {}), is_premium: true };

    const updateRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      headers: {
        apikey: SERVICE,
        authorization: `Bearer ${SERVICE}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ app_metadata: nextMeta }),
    });
    if (!updateRes.ok) return fail("grant_failed");

    return res.redirect(302, `${SITE_URL}/?upgraded=1`);
  } catch {
    return fail("exception");
  }
}
