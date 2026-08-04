/**
 * Vercel serverless route: POST /api/coach
 *
 * Holds the Anthropic API key server-side (env var ANTHROPIC_API_KEY in
 * Vercel project settings) so it is never exposed to the client.
 * The browser falls back to BYOK / local engine when this route answers
 * anything other than 200.
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface CoachBody {
  system?: string;
  messages?: ChatMessage[];
  model?: string;
}

const ALLOWED = /^claude-[a-z0-9-]+$/i;

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: "ANTHROPIC_API_KEY is not configured" });

  let body: CoachBody;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const { system, messages, model } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0 || !system) {
    return res.status(400).json({ error: "system and messages are required" });
  }

  const safeModel =
    model && ALLOWED.test(model) ? model : (process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5");

  // clamp history defensively
  const safeMessages = messages.slice(-12).map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: String(m.content).slice(0, 4000),
  }));

  try {
    const anth = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: safeModel,
        max_tokens: 1000,
        system: String(system).slice(0, 6000),
        messages: safeMessages,
      }),
    });
    const data: any = await anth.json();
    if (!anth.ok) {
      return res
        .status(anth.status)
        .json({ error: data?.error?.message ?? "Anthropic request failed" });
    }
    const reply = (data.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();
    return res.status(200).json({ reply });
  } catch (e: any) {
    return res.status(502).json({ error: e?.message ?? "Upstream error" });
  }
}
