import type { Goal, Habit, HabitLogs, Lang, Task } from "./types";
import { addDaysISO, daysFromToday, fmtNum, fmtPercent, todayISO } from "./dates";
import { goalProgress, habitDoneOn, habitRate14, habitStreak, openTasksSorted, taskScore } from "./utils";

/* ------------------------------------------------------------------ */
/* Live context summary                                                 */
/*                                                                      */
/* This is exactly the compact summary that would be embedded in the    */
/* system prompt when calling the Claude API from a server route:       */
/*                                                                      */
/*   // server route (key stays in .env, never shipped to the client)   */
/*   const reply = await anthropic.messages.create({                    */
/*     model: "claude-sonnet-5",                                        */
/*     system: COACH_SYSTEM_PROMPT + serializeContext(ctx),             */
/*     messages: [{ role: "user", content: message }],                  */
/*   });                                                                */
/*                                                                      */
/* The local engine below generates answers from the same serialized    */
/* context so the coach works end-to-end with zero configuration.       */
/* ------------------------------------------------------------------ */

export type CoachIntent =
  | "plan"
  | "prioritize"
  | "habits"
  | "report"
  | "suggest"
  | "motivate"
  | "general";

interface TaskCtx {
  title: string;
  due?: string;
  priority: Task["priority"];
  goal?: string;
  today: boolean;
  score: number;
  overdueDays: number;
}

interface HabitCtx {
  title: string;
  freq: Habit["frequency"];
  streak: number;
  rate14: number;
  doneToday: boolean;
}

interface GoalCtx {
  title: string;
  category: Goal["category"];
  progress: number;
  daysLeft: number;
  linkedOpen: number;
}

export interface CoachContext {
  name: string;
  openCount: number;
  overdue: TaskCtx[];
  dueToday: TaskCtx[];
  ranked: TaskCtx[]; // all open, coach-scored
  habits: HabitCtx[];
  habitsDoneToday: number;
  goals: GoalCtx[];
  weekDone: number;
  weekCheckIns: number;
  bestStreak: number;
  habitRate: number;
}

function taskCtx(t: Task, goals: Goal[]): TaskCtx {
  return {
    title: t.title,
    due: t.dueDate,
    priority: t.priority,
    goal: goals.find((g) => g.id === t.goalId)?.title,
    today: t.today,
    score: taskScore(t),
    overdueDays: t.dueDate ? Math.max(0, -daysFromToday(t.dueDate)) : 0,
  };
}

export function buildCoachContext(
  name: string,
  goals: Goal[],
  tasks: Task[],
  habits: Habit[],
  logs: HabitLogs,
  lang: Lang,
): CoachContext {
  const today = todayISO();
  const open = openTasksSorted(tasks).map((t) => taskCtx(t, goals));

  const habitsCtx: HabitCtx[] = habits.map((h) => ({
    title: h.title,
    freq: h.frequency,
    streak: habitStreak(logs, h, lang),
    rate14: habitRate14(logs, h),
    doneToday: habitDoneOn(logs, h.id, today),
  }));

  const goalsCtx: GoalCtx[] = goals.map((g) => ({
    title: g.title,
    category: g.category,
    progress: goalProgress(g, tasks.filter((t) => t.goalId === g.id)),
    daysLeft: daysFromToday(g.targetDate),
    linkedOpen: tasks.filter((t) => t.goalId === g.id && t.status !== "done").length,
  }));

  const weekStart = addDaysISO(today, -6);
  const weekDone = tasks.filter((t) => t.completedAt && t.completedAt >= weekStart).length;

  let weekCheckIns = 0;
  for (const h of habits) {
    for (const d of logs[h.id] ?? []) if (d >= weekStart && d <= today) weekCheckIns++;
  }

  const streaks = habits.map((h) => habitStreak(logs, h, lang));
  const rates = habits.map((h) => habitRate14(logs, h));

  return {
    name,
    openCount: open.length,
    overdue: open.filter((t) => t.overdueDays > 0),
    dueToday: open.filter((t) => t.due === today),
    ranked: open,
    habits: habitsCtx,
    habitsDoneToday: habitsCtx.filter((h) => h.doneToday).length,
    goals: goalsCtx,
    weekDone,
    weekCheckIns,
    bestStreak: streaks.length ? Math.max(...streaks) : 0,
    habitRate: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0,
  };
}

/** serialize to the compact block that a Claude system prompt would receive */
export function serializeContext(ctx: CoachContext): string {
  return [
    `USER: ${ctx.name}`,
    `OPEN TASKS (${ctx.openCount}): ${ctx.ranked.slice(0, 8).map((t) => `${t.title}${t.due ? `<${t.due}>` : ""}`).join("; ")}`,
    `OVERDUE: ${ctx.overdue.length} | DUE TODAY: ${ctx.dueToday.length}`,
    `HABITS: ${ctx.habits.map((h) => `${h.title}[streak ${h.streak}, rate ${Math.round(h.rate14 * 100)}%, today ${h.doneToday ? "done" : "pending"}]`).join("; ") || "none"}`,
    `GOALS: ${ctx.goals.map((g) => `${g.title}[${g.progress}%, ${g.daysLeft}d left]`).join("; ") || "none"}`,
    `THIS WEEK: ${ctx.weekDone} tasks done, ${ctx.weekCheckIns} habit check-ins`,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Claude API conversation builder                                      */
/* ------------------------------------------------------------------ */

const PERSONA = [
  "You are the Rozvan Coach — a sharp, warm personal productivity coach embedded in a goals/tasks/habits app.",
  "You always answer concretely and actionably, referencing the user's real data by name; never generic filler.",
  "Formatting: plain text markdown-lite only — **bold** for emphasis, '- ' bullets and '1. ' numbered steps. No headings, no emojis, no code blocks.",
  "Keep replies focused: usually under 220 words, shorter for simple questions. End with one clear next action when relevant.",
  "Capabilities: daily planning, task prioritization, habit analysis, goal suggestions, weekly reports, motivation and decision support.",
].join("\n");

/** system prompt + rolling history for the real Claude API */
export function buildApiConversation(
  ctx: CoachContext,
  history: { role: "user" | "assistant"; content: string }[],
  lang: Lang,
): { system: string; messages: { role: "user" | "assistant"; content: string }[] } {
  const system = [
    PERSONA,
    `Respond in ${lang === "fa" ? "Persian (Farsi), natural and fluent" : "English"}.`,
    `Today: ${todayISO()}${lang === "fa" ? " (user sees a Jalali calendar)" : ""}.`,
    "",
    "LIVE USER CONTEXT:",
    serializeContext(ctx),
  ].join("\n");
  return { system, messages: history.slice(-10) };
}

/* ------------------------------------------------------------------ */
/* intent detection                                                     */
/* ------------------------------------------------------------------ */

export function detectIntent(message: string): CoachIntent | null {
  const m = message.toLowerCase();
  const has = (...keys: string[]) => keys.some((k) => m.includes(k));

  if (has("plan", "برنامه", "روزم", "روز را", "امروز چه", "schedule")) return "plan";
  if (has("priorit", "اولویت", "مهم‌ترین", "مهمترین", "کدم", "کدوم")) return "prioritize";
  if (has("habit", "عادت", "زنجیر", "streak")) return "habits";
  if (has("report", "گزارش", "هفته", "week", "جمع‌بندی", "عملکرد")) return "report";
  if (has("suggest", "پیشنهاد", "هدف جدید", "goal")) return "suggest";
  if (has("motivat", "انگیز", "حوصله", "دلسرد", "حرف بزن", "تشویق", "تنبل")) return "motivate";
  return null;
}

/* ------------------------------------------------------------------ */
/* reply generators (bilingual, markdown-lite)                          */
/* ------------------------------------------------------------------ */

const N = (n: number, lang: Lang) => fmtNum(n, lang);
const P = (n: number, lang: Lang) => fmtPercent(n, lang);

function reason(t: TaskCtx, lang: Lang): string {
  const reasons: string[] = [];
  if (t.overdueDays > 0)
    reasons.push(lang === "fa" ? `${N(t.overdueDays, lang)} روز تأخیر دارد` : `${t.overdueDays}d overdue`);
  if (t.due === todayISO()) reasons.push(lang === "fa" ? "مهلتش امروز است" : "due today");
  if (t.priority === "high") reasons.push(lang === "fa" ? "اولویت بالا" : "high priority");
  if (t.goal) reasons.push(lang === "fa" ? `به هدف «${t.goal}» وصل است` : `linked to "${t.goal}"`);
  if (t.today) reasons.push(lang === "fa" ? "در تمرکز امروز است" : "in today's focus");
  return reasons.slice(0, 2).join(lang === "fa" ? "، " : ", ");
}

function planReply(ctx: CoachContext, lang: Lang): string {
  const L = lang === "fa";
  if (ctx.ranked.length === 0) {
    return L
      ? `**لیستت خالی است، ${ctx.name}.** این بهترین فرصت است برای برنامه‌ریزی آگاهانه:\n\n- سه هدف مهم هفته را بنویس و برای هر کدام یک وظیفه قابل‌انجام امروز تعریف کن\n- از صفحه وظایف، ۲-۳ مورد را به «تمرکز امروز» اضافه کن\n- بعد بگو «برنامه امروز» تا روزت را زمان‌بندی کنم`
      : `**Your plate is clear, ${ctx.name}.** Perfect moment to plan ahead:\n\n- Write down the week's three most important outcomes\n- Add 2–3 tasks and flag them for today's focus\n- Then say "plan my day" and I'll time-block it for you`;
  }

  const top3 = ctx.ranked.slice(0, 3);
  const rest = ctx.ranked.slice(3, 6);
  const habitsLeft = ctx.habits.filter((h) => !h.doneToday);

  const lines: string[] = [];
  lines.push(L ? `**برنامه امروز تو، ${ctx.name}**` : `**Your plan for today, ${ctx.name}**`);
  lines.push(
    L
      ? `${N(ctx.openCount, lang)} وظیفه باز داری؛ این سه‌تا مهم‌ترین‌اند:`
      : `You have ${ctx.openCount} open tasks; these three matter most:`,
  );
  lines.push("");
  lines.push(L ? "**بلوک تمرکز عمیق — اول صبح:**" : "**Deep-work block — first thing:**");
  top3.forEach((t, i) => lines.push(`${N(i + 1, lang)}. **${t.title}** — ${reason(t, lang)}`));
  if (rest.length) {
    lines.push("");
    lines.push(L ? "**بلوک کارهای سبک — بعدازظهر:**" : "**Shallow-work block — afternoon:**");
    rest.forEach((t) => lines.push(`- ${t.title}`));
  }
  if (habitsLeft.length) {
    lines.push("");
    lines.push(
      L
        ? `**عادت‌های باقی‌مانده امروز:** ${habitsLeft.map((h) => h.title).join("، ")} — ${ctx.habitsDoneToday > 0 ? `${N(ctx.habitsDoneToday, lang)} تا همین حالا انجام شده.` : "هنوز هیچ‌کدام ثبت نشده."}`
        : `**Habits still open today:** ${habitsLeft.map((h) => h.title).join(", ")} — ${ctx.habitsDoneToday > 0 ? `${ctx.habitsDoneToday} already done.` : "none checked in yet."}`,
    );
  }
  lines.push("");
  lines.push(
    L
      ? `**قانون امروز:** تا قبل از تمام شدن «${top3[0].title}» هیچ کار جدیدی شروع نکن. اگر وسط روز گیر کردی، بگو اولویت‌بندی کنم.`
      : `**Rule for today:** nothing new starts until "${top3[0].title}" is done. If the day derails, ask me to reprioritize.`,
  );
  return lines.join("\n");
}

function prioritizeReply(ctx: CoachContext, lang: Lang): string {
  const L = lang === "fa";
  if (ctx.ranked.length === 0)
    return L
      ? "وظیفه بازی نداری که بخواهم مرتبش کنم! چند کار اضافه کن، بعد درخواست بده."
      : "No open tasks to rank! Add a few tasks, then ask again.";
  const lines: string[] = [];
  lines.push(
    L
      ? `**ترتیب پیشنهادی من** (بر اساس مهلت، اولویت و اتصال به اهداف):`
      : `**My recommended order** (based on deadlines, priority and goal links):`,
  );
  lines.push("");
  ctx.ranked.slice(0, 5).forEach((t, i) => {
    lines.push(`${N(i + 1, lang)}. **${t.title}** — ${reason(t, lang)}`);
  });
  if (ctx.overdue.length) {
    lines.push("");
    lines.push(
      L
        ? `${N(ctx.overdue.length, lang)} کار عقب‌افتاده داری. پیشنهادم: یا همین امروز جذب برنامه‌شان کن، یا صادقانه تاریخشان را عوض کن — رها کردنشان هزینه ذهنی دارد.`
        : `You have ${ctx.overdue.length} overdue task${ctx.overdue.length > 1 ? "s" : ""}. Either schedule them today or honestly re-date them — leaving them hanging has a mental cost.`,
    );
  }
  return lines.join("\n");
}

function habitsReply(ctx: CoachContext, lang: Lang): string {
  const L = lang === "fa";
  if (ctx.habits.length === 0)
    return L
      ? "هنوز عادتی نساختی. با یک عادت خیلی کوچک شروع کن — مثلاً «۵ دقیقه مطالعه». بعد از چند روز بزرگش می‌کنیم."
      : "No habits yet. Start with one tiny habit — like '5 minutes of reading'. We'll scale it once it sticks.";
  const lines: string[] = [];
  lines.push(L ? "**تحلیل عادت‌های تو:**" : "**Your habit analysis:**");
  lines.push("");
  const sorted = [...ctx.habits].sort((a, b) => b.rate14 - a.rate14);
  for (const h of sorted) {
    const unit = h.freq === "daily" ? (L ? "روز" : "days") : L ? "هفته" : "wk";
    lines.push(
      L
        ? `- **${h.title}** — زنجیره ${N(h.streak, lang)} ${unit}، نرخ ۱۴ روزه ${P(h.rate14 * 100, lang)}، امروز: ${h.doneToday ? "انجام شد" : "هنوز نه"}`
        : `- **${h.title}** — ${h.streak} ${unit} streak, ${Math.round(h.rate14 * 100)}% 14-day rate, today: ${h.doneToday ? "done" : "pending"}`,
    );
  }
  const weakest = sorted[sorted.length - 1];
  const strongest = sorted[0];
  lines.push("");
  lines.push(
    L
      ? `قوی‌ترین: «${strongest.title}»؛ ضعیف‌ترین: «${weakest.title}». **تکنیک زنجیره‌سازی:** «${weakest.title}» را بلافاصله بعد از «${strongest.title}» انجام بده — عادت قوی، لنگر عادت ضعیف می‌شود.`
      : `Strongest: "${strongest.title}"; weakest: "${weakest.title}". **Habit stacking tip:** do "${weakest.title}" immediately after "${strongest.title}" — the strong habit anchors the weak one.`,
  );
  if (ctx.habitsDoneToday < ctx.habits.length)
    lines.push(
      L
        ? `\nهمین امروز ${N(ctx.habits.length - ctx.habitsDoneToday, lang)} عادت مانده — اول ساده‌ترینش را انجام بده تا گیرش بیفتی.`
        : `\n${ctx.habits.length - ctx.habitsDoneToday} habit${ctx.habits.length - ctx.habitsDoneToday > 1 ? "s" : ""} left today — knock out the easiest first to build momentum.`,
    );
  return lines.join("\n");
}

function reportReply(ctx: CoachContext, lang: Lang): string {
  const L = lang === "fa";
  const lines: string[] = [];
  lines.push(L ? "**گزارش هفتگی تو** (۷ روز گذشته):" : "**Your weekly report** (last 7 days):");
  lines.push("");
  lines.push(
    L
      ? `- وظایف انجام‌شده: **${N(ctx.weekDone, lang)}**`
      : `- Tasks completed: **${ctx.weekDone}**`,
  );
  lines.push(
    L
      ? `- ثبت عادت‌ها: **${N(ctx.weekCheckIns, lang)}** بار (نرخ کلی عادت‌ها: ${P(ctx.habitRate * 100, lang)})`
      : `- Habit check-ins: **${ctx.weekCheckIns}** (overall habit rate: ${Math.round(ctx.habitRate * 100)}%)`,
  );
  if (ctx.bestStreak > 0)
    lines.push(
      L
        ? `- بهترین زنجیره فعال: **${N(ctx.bestStreak, lang)} روز**`
        : `- Best active streak: **${ctx.bestStreak} days**`,
    );
  if (ctx.goals.length) {
    lines.push("");
    lines.push(L ? "**وضعیت اهداف:**" : "**Goal status:**");
    for (const g of ctx.goals.slice(0, 4))
      lines.push(
        L
          ? `- ${g.title}: ${P(g.progress, lang)}${g.daysLeft >= 0 ? ` (${N(g.daysLeft, lang)} روز مانده)` : " (مهلت گذشته!)"}`
          : `- ${g.title}: ${Math.round(g.progress)}%${g.daysLeft >= 0 ? ` (${g.daysLeft}d left)` : " (past due!)"}`,
      );
  }
  lines.push("");
  const focus = ctx.ranked.slice(0, 2).map((t) => t.title);
  const weakestHabit = [...ctx.habits].sort((a, b) => a.rate14 - b.rate14)[0];
  lines.push(L ? "**تمرکز هفته آینده:**" : "**Next week's focus:**");
  focus.forEach((f) => lines.push(`- ${f}`));
  if (weakestHabit && weakestHabit.rate14 < 0.6)
    lines.push(
      L
        ? `- نجات عادت «${weakestHabit.title}» — نرخش به ${P(weakestHabit.rate14 * 100, lang)} رسیده`
        : `- Rescue the "${weakestHabit.title}" habit — its rate slipped to ${Math.round(weakestHabit.rate14 * 100)}%`,
    );
  lines.push("");
  lines.push(
    L
      ? ctx.weekDone >= 5
        ? "هفته بدی نبود — ریتم را حفظ کن، شدت را کم نکن."
        : "هفته سبکی بود. برای هفته آینده فقط سه وظیفه مهم انتخاب کن؛ کم اما قطعی."
      : ctx.weekDone >= 5
        ? "Solid week — keep the rhythm, don't let the intensity drop."
        : "A light week. Pick just three important tasks for next week; few but certain.",
  );
  return lines.join("\n");
}

function suggestReply(ctx: CoachContext, lang: Lang, goals: Goal[]): string {
  const L = lang === "fa";
  const allCats = ["health", "career", "learning", "finance", "relationships", "personal"] as const;
  const present = new Set(goals.map((g) => g.category));
  const missing = allCats.filter((c) => !present.has(c));
  const catName = (c: string) => (L ? FA_CATS[c] : EN_CATS[c]);

  if (goals.length === 0) {
    return L
      ? `**سه هدف شروع خوب برای تو:**\n\n- سلامت: «۳ جلسه تمرین در هفته» — قابل‌سنجش و کوچک\n- یادگیری: «هر روز ۲۰ دقیقه مهارت جدید»\n- حرفه: «اتمام یک پروژه قابل‌نمایش تا ۶۰ روز»\n\nهر کدام که کشش داری را بساز، بعد به آن وظیفه وصل کن تا پیشرفتش خودکار اندازه گرفته شود.`
      : `**Three good starter goals:**\n\n- Health: "3 workout sessions a week" — small and measurable\n- Learning: "20 minutes of a new skill daily"\n- Career: "Ship one portfolio project in 60 days"\n\nCreate the one that pulls you, then link tasks to it so progress tracks itself.`;
  }

  const lines: string[] = [];
  lines.push(L ? "**پیشنهادهای مربی:**" : "**Coach's suggestions:**");
  lines.push("");
  const noTasks = goals.filter(
    (g) => ctx.goals.find((c) => c.title === g.title)?.linkedOpen === 0,
  );
  if (noTasks.length)
    lines.push(
      L
        ? `هدف «${noTasks[0].title}» هیچ وظیفه بازی ندارد — یک قدم کوچک امروزی برایش تعریف کن تا از سکون دربیاید.`
        : `The goal "${noTasks[0].title}" has no open tasks — define one small step for today to get it moving.`,
    );
  if (missing.length) {
    const c = missing[0];
    lines.push(
      L
        ? `در دسته «${catName(c)}» هدفی نداری. پیشنهاد: ${L ? FA_CAT_IDEAS[c] : EN_CAT_IDEAS[c]}`
        : `You have no ${catName(c)} goal. Suggestion: ${EN_CAT_IDEAS[c]}`,
    );
    if (missing[1])
      lines.push(
        L
          ? `یک گزینه دیگر در «${catName(missing[1])}»: ${FA_CAT_IDEAS[missing[1]]}`
          : `Another option in ${catName(missing[1])}: ${EN_CAT_IDEAS[missing[1]]}`,
      );
  } else {
    const lowest = [...ctx.goals].sort((a, b) => a.progress - b.progress)[0];
    lines.push(
      L
        ? `همه دسته‌ها پوشش داده شده! قدم بعد: برای «${lowest.title}» (کم‌پیشرفت‌ترین) دو نقطه عطف مشخص تعریف کن تا دیگر رها نشود.`
        : `All categories covered! Next step: define two concrete milestones for "${lowest.title}" (your slowest goal) so it stops drifting.`,
    );
  }
  lines.push("");
  lines.push(
    L
      ? "کدام را ساخت؟ بساز و وظایفش را به آن وصل کن — پیشرفتش را خودکار دنبال می‌کنم."
      : "Which one will you build? Create it and link its tasks — I'll track the progress automatically.",
  );
  return lines.join("\n");
}

function motivateReply(ctx: CoachContext, lang: Lang): string {
  const L = lang === "fa";
  const nearest = [...ctx.goals].filter((g) => g.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft)[0];
  const lines: string[] = [];
  if (ctx.bestStreak > 0)
    lines.push(
      L
        ? `${N(ctx.bestStreak, lang)} روز زنجیره یعنی آدمی که دیروز بودی، به تو ایمان دارد. امروز فقط یک روز دیگر است.`
        : `A ${ctx.bestStreak}-day streak means the person you were yesterday believes in you. Today is just one more day.`,
    );
  if (ctx.weekDone > 0)
    lines.push(
      L
        ? `این هفته ${N(ctx.weekDone, lang)} کار را تمام کرده‌ای — ماشین روشن است، خاموشش نکن.`
        : `You've finished ${ctx.weekDone} task${ctx.weekDone > 1 ? "s" : ""} this week — the engine is running; don't switch it off.`,
    );
  if (nearest)
    lines.push(
      L
        ? `«${nearest.title}» فقط ${N(nearest.daysLeft, lang)} روز با تو فاصله دارد. هر روز یک قدم، هر چند کوچک.`
        : `"${nearest.title}" is only ${nearest.daysLeft} days away. One step a day, however small.`,
    );
  const topTask = ctx.ranked[0];
  lines.push(
    topTask
      ? L
        ? `**چالش همین الان:** ۲۵ دقیقه تایمر بگذار و فقط روی «${topTask.title}» کار کن. بعدش تصمیم بگیر ادامه می‌دهی یا نه — شرط می‌بندم ادامه می‌دهی.`
        : `**Challenge right now:** set a 25-minute timer and work only on "${topTask.title}". Decide afterwards whether to continue — I bet you will.`
      : L
        ? `**چالش همین الان:** یک وظیفه مهم تعریف کن و ۲۵ دقیقه به آن بچسب. شروع، سخت‌ترین قسمت است؛ بقیه‌اش خودش می‌آید.`
        : `**Challenge right now:** define one important task and stick to it for 25 minutes. Starting is the hardest part; the rest follows.`,
  );
  return lines.join("\n\n");
}

function generalReply(
  message: string,
  ctx: CoachContext,
  lang: Lang,
  habits: Habit[],
  goals: Goal[],
  tasks: Task[],
  logs: HabitLogs,
): string {
  const L = lang === "fa";
  const m = message.toLowerCase();

  // specific goal mention
  const goal = goals.find((g) => g.title.length > 2 && m.includes(g.title.toLowerCase()));
  if (goal) {
    const gCtx = ctx.goals.find((c) => c.title === goal.title);
    if (gCtx)
      return L
        ? `**${goal.title}** — پیشرفت ${P(gCtx.progress, lang)}، ${gCtx.daysLeft >= 0 ? `${N(gCtx.daysLeft, lang)} روز مانده` : "مهلتش گذشته"}، ${N(gCtx.linkedOpen, lang)} وظیفه باز.\n\n${gCtx.linkedOpen === 0 ? "هیچ قدم بازی ندارد؛ همین حالا یک وظیفه کوچک به آن وصل کن." : gCtx.progress < 40 ? `برای شتاب گرفتن، روی «${ctx.ranked.find((t) => t.goal === goal.title)?.title ?? "وظیفه مرتبطش"}» تمرکز کن.` : "مسیر خوبی است — همین ریتم را نگه دار."}`
        : `**${goal.title}** — ${Math.round(gCtx?.progress ?? 0)}% progress, ${gCtx && gCtx.daysLeft >= 0 ? `${gCtx.daysLeft} days left` : "past due"}, ${gCtx?.linkedOpen ?? 0} open tasks.\n\n${gCtx?.linkedOpen === 0 ? "No open steps — link one small task to it right now." : "Keep the current pace."}`;
  }

  // specific habit mention
  const habit = habits.find((h) => h.title.length > 2 && m.includes(h.title.toLowerCase()));
  if (habit) {
    const streak = habitStreak(logs, habit, lang);
    const rate = habitRate14(logs, habit);
    const doneToday = habitDoneOn(logs, habit.id, todayISO());
    return L
      ? `**${habit.title}** — زنجیره ${N(streak, lang)} ${habit.frequency === "daily" ? "روز" : "هفته"}، نرخ ۱۴ روزه ${P(rate * 100, lang)}، امروز ${doneToday ? "انجام شده" : "هنوز انجام نشده"}.\n\n${rate > 0.7 ? "عالی پیش می‌رود؛ اگر دوست داری سختی‌اش را کمی بیشتر کن." : "قانون دو دقیقه: فقط دو دقیقه‌اش را شروع کن — مغز با شروع کوچک مقاومت نمی‌کند."}`
      : `**${habit.title}** — ${streak} ${habit.frequency === "daily" ? "day" : "week"} streak, ${Math.round(rate * 100)}% 14-day rate, today ${doneToday ? "done" : "pending"}.\n\n${rate > 0.7 ? "Great trajectory — consider raising the bar slightly." : "Two-minute rule: just start it for two minutes — the brain doesn't resist tiny starts."}`;
  }

  // "add/create" guidance
  if (m.includes("add") || m.includes("create") || m.includes("چطور") || m.includes("اضافه")) {
    return L
      ? "برای ساختن: از دکمه «جدید» در صفحه‌های اهداف، وظایف و عادت‌ها استفاده کن. بعد با من در میان بگذار — برنامه، اولویت‌بندی و تحلیلش با من."
      : "To create something: use the \"New\" button on the Goals, Tasks and Habits pages. Then loop me in — planning, prioritizing and analysis are on me.";
  }

  // default capability card with a live insight
  const insight = ctx.overdue.length
    ? L
      ? `اتفاقاً ${N(ctx.overdue.length, lang)} کار عقب‌افتاده داری — اگر بگی «اولویت‌بندی»، مرتبشان می‌کنم.`
      : `By the way, you have ${ctx.overdue.length} overdue task${ctx.overdue.length > 1 ? "s" : ""} — say "prioritize" and I'll sort them out.`
    : ctx.habits.length > 0 && ctx.habitsDoneToday < ctx.habits.length
      ? L
        ? `هنوز ${N(ctx.habits.length - ctx.habitsDoneToday, lang)} عادت امروز باقی است — بگو «تحلیل عادت‌ها» تا برنامه‌اش را بچینیم.`
        : `You still have ${ctx.habits.length - ctx.habitsDoneToday} habit${ctx.habits.length - ctx.habitsDoneToday > 1 ? "s" : ""} open today — say "habit analysis" and we'll plan them.`
      : L
        ? "وضعیتت مرتب است. بگو «برنامه امروز» تا روز بعدت را بچینیم."
        : "Things look tidy. Say \"plan my day\" and we'll line up what's next.";

  return L
    ? `می‌توانم کمکت کنم با:\n\n- **برنامه امروز** — چیدمان زمان‌بندی‌شده روزت\n- **اولویت‌بندی** — ترتیب درست وظایف با دلیل\n- **تحلیل عادت‌ها** — زنجیره‌ها و نقاط ضعف\n- **گزارش هفته** — عملکرد ۷ روز گذشته\n- **پیشنهاد هدف** و **انگیزه**\n\n${insight}`
    : `I can help you with:\n\n- **Plan my day** — a time-blocked schedule\n- **Prioritize** — the right task order, with reasons\n- **Habit analysis** — streaks and weak spots\n- **Weekly report** — your last 7 days\n- **Goal suggestions** and **motivation**\n\n${insight}`;
}

/* ------------------------------------------------------------------ */
/* main entry                                                           */
/* ------------------------------------------------------------------ */

const FA_CATS: Record<string, string> = {
  health: "سلامت",
  career: "حرفه",
  learning: "یادگیری",
  finance: "مالی",
  relationships: "روابط",
  personal: "شخصی",
};
const EN_CATS: Record<string, string> = {
  health: "health",
  career: "career",
  learning: "learning",
  finance: "finance",
  relationships: "relationships",
  personal: "personal growth",
};
const FA_CAT_IDEAS: Record<string, string> = {
  health: "«۳ جلسه تمرین در هفته، برای ۸ هفته»",
  career: "«ساخت یک نمونه‌کار قابل‌نمایش تا ۶۰ روز»",
  learning: "«اتمام یک کتاب در ماه»",
  finance: "«پس‌انداز ۱۰٪ درآمد این ماه»",
  relationships: "«هر هفته یک تماس با یک دوست قدیمی»",
  personal: "«هر شب ۵ دقیقه مرور روز و نوشتن سه خط»",
};
const EN_CAT_IDEAS: Record<string, string> = {
  health: '"3 workouts a week for 8 weeks"',
  career: '"Ship a portfolio piece in 60 days"',
  learning: '"Finish one book a month"',
  finance: '"Save 10% of this month\'s income"',
  relationships: '"One call with an old friend weekly"',
  personal: '"5-minute evening journal, three lines"',
};

export function getCoachReply(
  message: string,
  intent: CoachIntent | null,
  state: { goals: Goal[]; tasks: Task[]; habits: Habit[]; logs: HabitLogs },
  name: string,
  lang: Lang,
): string {
  const ctx = buildCoachContext(name, state.goals, state.tasks, state.habits, state.logs, lang);
  const resolved: CoachIntent = intent ?? detectIntent(message) ?? "general";
  switch (resolved) {
    case "plan":
      return planReply(ctx, lang);
    case "prioritize":
      return prioritizeReply(ctx, lang);
    case "habits":
      return habitsReply(ctx, lang);
    case "report":
      return reportReply(ctx, lang);
    case "suggest":
      return suggestReply(ctx, lang, state.goals);
    case "motivate":
      return motivateReply(ctx, lang);
    default:
      return generalReply(
        message,
        ctx,
        lang,
        state.habits,
        state.goals,
        state.tasks,
        state.logs,
      );
  }
}
