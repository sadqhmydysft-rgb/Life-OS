import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpNarrowWide,
  BarChart3,
  CalendarClock,
  Flame,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";
import { useApp } from "../lib/store";
import { useI18n } from "../lib/i18n";
import { buildApiConversation, buildCoachContext, getCoachReply, type CoachIntent } from "../lib/coach";
import { callClaude, getAiConfig, setAiConfig, DEFAULT_MODEL } from "../lib/ai";
import type { ChatMessage } from "../lib/types";
import { cn } from "../lib/utils";
import { fmtNum } from "../lib/dates";
import { Button, IconButton, Input } from "./ui";

function useMediaQuery(q: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const fn = () => setMatch(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [q]);
  return match;
}

/* ------------------------------ markdown-lite ------------------------------ */

function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-zinc-900 dark:text-white">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function Rich({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-[13px] leading-6">
      {text.split("\n").map((line, i) => {
        if (line.trim() === "") return <div key={i} className="h-1.5" />;
        if (line.startsWith("- "))
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2.5 h-1.25 w-1.25 shrink-0 rounded-full bg-accent-500" />
              <span className="text-zinc-600 dark:text-zinc-300">{inline(line.slice(2))}</span>
            </div>
          );
        return <div key={i} className="text-zinc-600 dark:text-zinc-300">{inline(line)}</div>;
      })}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-accent-500"
          style={{ animation: `typing-dot 1.1s ${i * 0.18}s infinite` }}
        />
      ))}
    </div>
  );
}

/* ------------------------------ panel ------------------------------ */

export function CoachPanel() {
  const {
    coachOpen,
    setCoachOpen,
    chat,
    appendChat,
    patchChatMessage,
    clearChat,
    goals,
    tasks,
    habits,
    logs,
    user,
  } = useApp();
  const { t, lang, isRTL } = useI18n();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(() => getAiConfig().apiKey);
  const [model, setModel] = useState(() => getAiConfig().model);
  const [lastSource, setLastSource] = useState<ChatMessage["source"]>(
    () => [...chat].reverse().find((m) => m.role === "assistant")?.source ?? undefined,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const chatRef = useRef(chat);
  chatRef.current = chat;

  useEffect(() => {
    return () => timers.current.forEach((id) => window.clearTimeout(id));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, busy, coachOpen]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && setCoachOpen(false);
    if (coachOpen) window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [coachOpen, setCoachOpen]);

  if (!user) return null;

  const saveSettings = () => {
    setAiConfig({ apiKey: apiKey.trim(), model: model.trim() || DEFAULT_MODEL });
    setSettingsOpen(false);
  };

  const send = (text: string, intent: CoachIntent | null = null) => {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    appendChat("user", content);
    setBusy(true);
    const id = appendChat("assistant", "");

    const reveal = (full: string, source: ChatMessage["source"], prefix = "") => {
      const reply = prefix + full;
      const think = window.setTimeout(() => {
        let i = 0;
        const iv = window.setInterval(() => {
          i += 3 + Math.floor(Math.random() * 6);
          patchChatMessage(id, { content: reply.slice(0, i) });
          if (i >= reply.length) {
            window.clearInterval(iv);
            patchChatMessage(id, { content: reply, source });
            setBusy(false);
          }
        }, 11);
        timers.current.push(iv);
      }, source === "local" && !prefix ? 500 : 150);
      timers.current.push(think);
    };

    void (async () => {
      const ctx = buildCoachContext(user.name, goals, tasks, habits, logs, lang);
      const history = [
        ...chatRef.current
          .filter((m) => m.content && m.content.length > 0)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content },
      ];
      const conv = buildApiConversation(ctx, history, lang);
      try {
        const { text: reply, source } = await callClaude(conv, getAiConfig());
        setLastSource(source);
        reveal(reply, source);
      } catch {
        const hadLive = !!getAiConfig().apiKey || lastSource === "server";
        const local = getCoachReply(content, intent, { goals, tasks, habits, logs }, user.name, lang);
        setLastSource("local");
        reveal(local, "local", hadLive ? `${t("coach.apiFailed")}\n\n` : "");
      }
    })();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const chips: { intent: CoachIntent; label: string; icon: ReactNode }[] = [
    { intent: "plan", label: t("coach.chip.plan"), icon: <CalendarClock size={13} /> },
    { intent: "prioritize", label: t("coach.chip.prioritize"), icon: <ArrowUpNarrowWide size={13} /> },
    { intent: "habits", label: t("coach.chip.habits"), icon: <Flame size={13} /> },
    { intent: "report", label: t("coach.chip.report"), icon: <BarChart3 size={13} /> },
    { intent: "suggest", label: t("coach.chip.suggest"), icon: <Target size={13} /> },
    { intent: "motivate", label: t("coach.chip.motivate"), icon: <Zap size={13} /> },
  ];

  const ctx = buildCoachContext(user.name, goals, tasks, habits, logs, lang);
  const habitsLeft = habits.length - ctx.habitsDoneToday;
  const N = (n: number) => fmtNum(n, lang);
  const greeting =
    lang === "fa"
      ? `سلام ${user.name}! من مربی هوشمندت‌ام — وضعیت زنده‌ات را می‌بینم:`
      : `Hey ${user.name}! I'm your AI coach — I can see your live state:`;
  const insight =
    lang === "fa"
      ? `${N(ctx.openCount)} وظیفه باز${ctx.overdue.length ? ` (${N(ctx.overdue.length)} عقب‌افتاده)` : ""} · ${N(habitsLeft)} عادت امروز مانده · ${N(ctx.goals.length)} هدف فعال`
      : `${ctx.openCount} open tasks${ctx.overdue.length ? ` (${ctx.overdue.length} overdue)` : ""} · ${habitsLeft} habits left today · ${ctx.goals.length} active goals`;

  const live = lastSource === "server" || lastSource === "byok" || !!apiKey.trim();
  const sourceLabel = (s?: ChatMessage["source"]) =>
    s === "server" ? t("coach.srcServer") : s === "byok" ? t("coach.srcByok") : t("coach.srcLocalFallback");

  const slide = isDesktop
    ? { initial: { x: isRTL ? -40 : 40, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: isRTL ? -40 : 40, opacity: 0 } }
    : { initial: { y: 64, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: 64, opacity: 0 } };

  return (
    <AnimatePresence>
      {coachOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-zinc-950/35 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCoachOpen(false)}
          />
          <motion.aside
            className="glass-strong fixed inset-0 z-50 flex flex-col md:inset-y-0 md:end-0 md:start-auto md:w-[min(430px,100vw)] md:border-s md:shadow-lift dark:border-white/[0.08]"
            {...slide}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label={t("coach.title")}
          >
            {/* header */}
            <div className="flex items-center gap-3 border-b border-zinc-200/70 px-4 py-3.5 dark:border-white/[0.07]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-700 text-white shadow-sm shadow-accent-600/30">
                <Sparkles size={17} />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold">{t("nav.coach")}</p>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                      live
                        ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                        : "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400",
                    )}
                  >
                    <span className={cn("h-1.25 w-1.25 rounded-full", live ? "bg-emerald-500" : "bg-zinc-400")} />
                    {live ? t("coach.modeLive") : t("coach.modeLocal")}
                  </span>
                </div>
                <p className="text-[10.5px] text-zinc-400 dark:text-zinc-500">{t("coach.contextNote")}</p>
              </div>
              <IconButton
                label={t("coach.settings")}
                onClick={() => setSettingsOpen((v) => !v)}
                className={cn("h-8 w-8", settingsOpen && "bg-accent-500/10 text-accent-600")}
              >
                <Settings size={14} />
              </IconButton>
              {chat.length > 0 && (
                <IconButton label={t("coach.clear")} onClick={clearChat} className="h-8 w-8">
                  <RotateCcw size={14} />
                </IconButton>
              )}
              <IconButton label={t("common.close")} onClick={() => setCoachOpen(false)} className="h-8 w-8">
                <X size={16} />
              </IconButton>
            </div>

            {/* settings drawer */}
            <AnimatePresence>
              {settingsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-b border-zinc-200/70 dark:border-white/[0.07]"
                >
                  <div className="space-y-2.5 px-4 py-3.5">
                    <div>
                      <label className="mb-1 block text-[10.5px] font-semibold text-zinc-500 dark:text-zinc-400">
                        {t("coach.apiKey")}
                      </label>
                      <Input
                        type="password"
                        dir="ltr"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-ant-…"
                        className="h-9 text-xs"
                      />
                      <p className="mt-1 text-[10px] leading-4 text-zinc-400">{t("coach.apiKeyHint")}</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10.5px] font-semibold text-zinc-500 dark:text-zinc-400">
                        {t("coach.model")}
                      </label>
                      <Input
                        dir="ltr"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder={DEFAULT_MODEL}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] leading-4 text-zinc-400">{t("coach.serverNote")}</p>
                      <Button size="sm" onClick={saveSettings} className="shrink-0">
                        {t("common.save")}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* messages */}
            <div ref={scrollRef} className="scroll-thin flex-1 overflow-y-auto px-4 py-4">
              {chat.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-2 text-center">
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-700 text-white shadow-lift shadow-accent-600/30"
                  >
                    <Sparkles size={24} />
                  </motion.span>
                  <p className="text-sm font-semibold">{greeting}</p>
                  <p className="mt-1.5 max-w-70 text-[11.5px] leading-5 text-zinc-500 dark:text-zinc-400">
                    {insight}
                  </p>
                  <div className="mt-5 grid w-full grid-cols-2 gap-2">
                    {chips.map((c) => (
                      <button key={c.intent} onClick={() => send(c.label, c.intent)} className="chip justify-center py-2.5">
                        <span className="text-accent-500">{c.icon}</span>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {chat.map((m) => (
                    <div key={m.id}>
                      {m.role === "user" ? (
                        <div className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-ee-md bg-accent-600 px-3.5 py-2.5 text-[13px] leading-6 text-white shadow-sm shadow-accent-600/25">
                          {m.content}
                        </div>
                      ) : (
                        <div className="flex gap-2.5">
                          <span className="mt-0.5 flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg bg-accent-500/15 text-accent-600 dark:text-accent-300">
                            <Sparkles size={13} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="rounded-2xl rounded-ss-md border border-zinc-200/70 bg-white/60 px-3.5 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.04]">
                              {m.content === "" && busy ? <TypingDots /> : <Rich text={m.content} />}
                            </div>
                            {m.content !== "" && m.source && (
                              <p className="mt-1 ps-1 text-[9.5px] font-medium text-zinc-400 dark:text-zinc-500">
                                {sourceLabel(m.source)}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* chips + input */}
            <div className="border-t border-zinc-200/70 px-4 pt-2.5 pb-4 dark:border-white/[0.07]">
              {chat.length > 0 && (
                <div className="scroll-none mb-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
                  {chips.map((c) => (
                    <button key={c.intent} onClick={() => send(c.label, c.intent)} disabled={busy} className={cn("chip", busy && "opacity-50")}>
                      <span className="text-accent-500">{c.icon}</span>
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={submit} className="flex items-center gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("coach.placeholder")}
                  className="flex-1"
                  disabled={busy}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || busy}
                  aria-label="send"
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-accent-600 text-white shadow-sm shadow-accent-600/30 transition-all duration-200 hover:bg-accent-500 disabled:opacity-40 rtl:-scale-x-100"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
