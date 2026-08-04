/**
 * Real Claude API access, with a graceful ladder:
 *
 *   1. POST /api/coach        — Vercel server route using ANTHROPIC_API_KEY
 *                               from project env vars (key never reaches the client).
 *   2. Direct Anthropic call  — when the user pastes their own key in the
 *                               coach settings (BYOK); the key is stored only
 *                               in this browser's localStorage and sent only
 *                               to api.anthropic.com.
 *   3. (handled by caller)    — the local smart engine as offline fallback.
 */

export interface AiConfig {
  apiKey: string;
  model: string;
}

export type CoachSource = "server" | "byok";

const LS_KEY = "lifeos:ai";
export const DEFAULT_MODEL = "claude-sonnet-4-5";

export function getAiConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AiConfig>;
      return { apiKey: parsed.apiKey ?? "", model: parsed.model || DEFAULT_MODEL };
    }
  } catch {
    /* ignore */
  }
  return { apiKey: "", model: DEFAULT_MODEL };
}

export function setAiConfig(cfg: AiConfig) {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
}

export interface CoachPayload {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

interface AnthropicTextBlock {
  type: string;
  text?: string;
}

function extractText(data: { content?: AnthropicTextBlock[] }): string {
  return (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function callClaude(
  payload: CoachPayload,
  cfg: AiConfig,
): Promise<{ text: string; source: CoachSource }> {
  /* 1) server route (production key) */
  try {
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, model: cfg.model || DEFAULT_MODEL }),
    });
    if (res.ok) {
      const data = (await res.json()) as { reply?: string };
      if (data.reply) return { text: data.reply, source: "server" };
    }
  } catch {
    /* route not available (local dev without vercel dev) — fall through */
  }

  /* 2) direct browser call with the user's own key */
  if (cfg.apiKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: cfg.model || DEFAULT_MODEL,
        max_tokens: 1000,
        system: payload.system,
        messages: payload.messages,
      }),
    });
    const data = (await res.json()) as { content?: AnthropicTextBlock[]; error?: { message?: string } };
    if (!res.ok) throw new Error(data.error?.message ?? `Anthropic HTTP ${res.status}`);
    const text = extractText(data);
    if (text) return { text, source: "byok" };
    throw new Error("Empty response from Claude");
  }

  throw new Error("no-key");
}
