/**
 * Vercel serverless route: POST /api/coach
 * Uses Google Gemini (free tier) via GEMINI_API_KEY env var.
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface CoachBody {
  system?: string;
  messages?: ChatMessage[];
}

const MODEL = "gemini-3.1-flash-lite";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: "GEMINI_API_KEY is not configured" });

  let body: CoachBody;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const { system, messages } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0 || !system) {
    return res.status(400).json({ error: "system and messages are required" });
  }

  const safeMessages = messages.slice(-12).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content).slice(0, 4000) }],
  }));

  try {
    const gem = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: String(system).slice(0, 6000) }] },
          contents: safeMessages,
        }),
      },
    );
    const data: any = await gem.json();
    if (!gem.ok) {
      return res.status(gem.status).json({ error: data?.error?.message ?? "Gemini request failed" });
    }
    const reply = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p.text ?? "")
      .join("\n")
      .trim();
    return res.status(200).json({ reply });
  } catch (e: any) {
    return res.status(502).json({ error: e?.message ?? "Upstream error" });
  }
}