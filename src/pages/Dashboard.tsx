import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  Flame,
  Gauge,
  ListChecks,
  Plus,
  Sparkles,
  Star,
  Target,
  X,
} from "lucide-react";
import { useApp } from "../lib/store";
import { useI18n } from "../lib/i18n";
import {
  addDaysISO,
  fmtFullDate,
  fmtNum,
  fmtPercent,
  greetingKey,
  todayISO,
} from "../lib/dates";
import { cn, goalProgress, habitDoneOn, habitRate14, habitStreak, taskScore } from "../lib/utils";
import { CATEGORY_COLORS, type Task } from "../lib/types";
import { Badge, Card, EmptyState, Input, Progress } from "../components/ui";

const PRIO_COLORS: Record<Task["priority"], string> = {
  high: "#f43f5e",
  medium: "#f59e0b",
  low: "#38bdf8",
};

export function Dashboard() {
  const {
    user,
    goals,
    tasks,
    habits,
    logs,
    addTask,
    updateTask,
    toggleHabitDay,
    setCoachOpen,
  } = useApp();
  const { t, lang, isRTL } = useI18n();
  const [quick, setQuick] = useState("");
  const today = todayISO();

  /* ------------------------------ derived ------------------------------ */
  const focus = tasks
    .filter((x) => x.today && x.status !== "done")
    .sort((a, b) => taskScore(b) - taskScore(a))
    .slice(0, 3);
  const focusDone = tasks.filter((x) => x.today && x.status === "done");

  const overdue = tasks
    .filter((x) => x.status !== "done" && x.dueDate && x.dueDate < today)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
  const dueToday = tasks.filter((x) => x.status !== "done" && x.dueDate === today);

  const habitsToday = habits.map((h) => ({
    habit: h,
    done: habitDoneOn(logs, h.id, today),
    streak: habitStreak(logs, h, lang),
  }));
  const habitsDone = habitsToday.filter((h) => h.done).length;

  const weekStart = addDaysISO(today, -6);
  const weekDone = tasks.filter((x) => x.completedAt && x.completedAt >= weekStart).length;
  const bestStreak = habits.length ? Math.max(...habits.map((h) => habitStreak(logs, h, lang))) : 0;
  const habitRate = habits.length
    ? (habits.reduce((a, h) => a + habitRate14(logs, h), 0) / habits.length) * 100
    : 0;

  const topGoals = goals.slice(0, 4).map((g) => ({
    goal: g,
    progress: goalProgress(g, tasks.filter((x) => x.goalId === g.id)),
    openLinked: tasks.filter((x) => x.goalId === g.id && x.status !== "done").length,
  }));
  /* gamification (premium): simple XP + streak badges, derived from existing data */
  const habitCompletions = habits.reduce((sum, h) => sum + (logs[h.id]?.length ?? 0), 0);
  const tasksCompletedTotal = tasks.filter((x) => x.status === "done").length;
  const totalXP = habitCompletions * 10 + tasksCompletedTotal * 5;
  const badgeHabits = habitsToday.filter((h) => h.streak >= 7);

  const quickAdd = () => {
    const title = quick.trim();
    if (!title) return;
    addTask({ title, dueDate: today, priority: "high", tags: [], status: "todo", today: true });
    setQuick("");
  };

  const stats = [
    { icon: CheckCircle2, label: t("dash.stat.tasksDone"), value: fmtNum(weekDone, lang), tone: "text-emerald-500", bg: "bg-emerald-500/10" },
    { icon: Flame, label: t("dash.stat.streak"), value: `${fmtNum(bestStreak, lang)} ${t("dash.day")}`, tone: "text-accent-500", bg: "bg-accent-500/10" },
    { icon: Target, label: t("dash.stat.goals"), value: fmtNum(goals.length, lang), tone: "text-amber-500", bg: "bg-amber-500/10" },
    { icon: Gauge, label: t("dash.stat.habitRate"), value: fmtPercent(habitRate, lang), tone: "text-sky-500", bg: "bg-sky-500/10" },
  ];
  if (user?.is_premium) {
    stats.push({ icon: Star, label: t("dash.stat.xp"), value: fmtNum(totalXP, lang), tone: "text-violet-500", bg: "bg-violet-500/10" });
  }

  const g = greetingKey();

  return (
    <div className="space-y-5">
      {/* ------------------------------ header ------------------------------ */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {t(`dash.greeting.${g}`)}، {user?.name}
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{fmtFullDate(today, lang)}</p>
        </div>
        <Link
          to="/calendar"
          className="chip"
        >
          {t("cal.title")}
          <ChevronLeft size={14} className={cn(!isRTL && "rotate-180")} />
        </Link>
      </div>

      {/* ------------------------------ stats ------------------------------ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-3 p-3.5">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", s.bg, s.tone)}>
              <s.icon size={17} />
            </span>
            <div className="min-w-0">
              <p className="tnum truncate text-sm font-bold">{s.value}</p>
              <p className="truncate text-[10.5px] text-zinc-500 dark:text-zinc-400">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* ------------------------------ coach banner ------------------------------ */}
      <button
        onClick={() => setCoachOpen(true)}
        className="group relative w-full cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-l from-accent-700 to-accent-500 p-5 text-start text-white shadow-lift shadow-accent-600/25 transition-transform duration-200 hover:-translate-y-0.5"
      >
        <div className="absolute -top-10 -end-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -bottom-12 -start-6 h-32 w-32 rounded-full bg-accent-300/30 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <Sparkles size={20} />
            </span>
            <div>
              <p className="text-[15px] font-bold">{t("dash.coachTitle")}</p>
              <p className="mt-0.5 max-w-md text-[11.5px] leading-5 text-white/75">{t("dash.coachSub")}</p>
            </div>
          </div>
          <span className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-accent-700 shadow-sm transition-transform duration-200 group-hover:scale-[1.03]">
            {t("dash.coachCta")}
            <span className="kbd border-accent-200 bg-accent-50 text-accent-600">⌘J</span>
          </span>
        </div>
      </button>

      {/* ------------------------------ main grid ------------------------------ */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* today's focus */}
        <Card className="p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Star size={15} className="text-accent-500" />
                {t("dash.focus")}
              </h2>
              <p className="mt-0.5 text-[11px] text-zinc-400">{t("dash.focusSub")}</p>
            </div>
            <Link to="/tasks" className="chip py-1 text-[11px]">
              {t("common.viewAll")}
            </Link>
          </div>

          <div className="space-y-1">
            {[0, 1, 2].map((slot) => {
              const task = focus[slot];
              if (!task)
                return focus.length === 0 && slot === 0 ? (
                  <EmptyState key={slot} icon={<Star size={20} />} title={t("dash.noFocus")} />
                ) : null;
              const goal = goals.find((x) => x.id === task.goalId);
              return (
                <div
                  key={task.id}
                  className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors duration-200 hover:bg-zinc-500/[0.05]"
                >
                  <span className="tnum w-5 text-center text-xs font-semibold text-zinc-300 dark:text-zinc-600">
                    {fmtNum(slot + 1, lang)}
                  </span>
                  <button
                    onClick={() => updateTask(task.id, { status: "done" })}
                    aria-label="done"
                    className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-zinc-300 transition-all duration-200 hover:border-accent-500 hover:bg-accent-500/10 dark:border-zinc-600"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{task.title}</span>
                  {goal && (
                    <Badge tone="accent" className="hidden sm:inline-flex">
                      {goal.title}
                    </Badge>
                  )}
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PRIO_COLORS[task.priority] }} />
                  <button
                    onClick={() => updateTask(task.id, { today: false })}
                    aria-label="remove from focus"
                    className="cursor-pointer text-zinc-300 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:text-rose-500 dark:text-zinc-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
            {focusDone.map((task) => (
              <div key={task.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 opacity-50">
                <span className="w-5" />
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className="flex-1 truncate text-[13px] line-through">{task.title}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-zinc-200/60 pt-3 dark:border-white/[0.06]">
            <Plus size={15} className="ms-1 shrink-0 text-zinc-400" />
            <Input
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && quickAdd()}
              placeholder={t("dash.focusPlaceholder")}
              className="h-9 border-none bg-transparent px-1 shadow-none focus:ring-0 dark:bg-transparent"
            />
          </div>
        </Card>

        {/* habits strip */}
        <Card className="p-5 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Flame size={15} className="text-accent-500" />
              {t("dash.habitStrip")}
            </h2>
            <Badge tone={habitsDone === habits.length && habits.length > 0 ? "emerald" : "zinc"}>
              {fmtNum(habitsDone, lang)}/{fmtNum(habits.length, lang)}
            </Badge>
          </div>
          {user?.is_premium && badgeHabits.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {badgeHabits.map((h) => (
                <Badge key={h.habit.id} tone={h.streak >= 30 ? "amber" : "accent"}>
                  <Star size={11} />
                  {h.habit.title} · {fmtNum(h.streak, lang)}
                </Badge>
              ))}
            </div>
          )}
          {habitsToday.length === 0 ? (
            <EmptyState icon={<Flame size={20} />} title={t("dash.noHabits")} />
          ) : (
            <div className="space-y-1">
              {habitsToday.map(({ habit, done, streak }) => (
                <div
                  key={habit.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-200 hover:bg-zinc-500/[0.05]"
                >
                  <button
                    onClick={() => toggleHabitDay(habit.id, today)}
                    aria-label={habit.title}
                    className={cn(
                      "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-all duration-200",
                      done ? "text-white" : "hover:scale-105",
                    )}
                    style={{
                      borderColor: habit.color,
                      backgroundColor: done ? habit.color : "transparent",
                    }}
                  >
                    {done && <Check size={14} strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-[13px] font-medium", done && "text-zinc-400 line-through")}>
                      {habit.title}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {habit.frequency === "daily" ? t("habits.daily") : t("habits.weekly")}
                    </p>
                  </div>
                  {streak > 0 && (
                    <Badge tone="accent">
                      <Flame size={11} />
                      <span className="tnum">{fmtNum(streak, lang)}</span>
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
          <Link to="/habits" className="chip mt-3 w-full justify-center py-2 text-[11px]">
            {t("common.viewAll")}
          </Link>
        </Card>

        {/* agenda */}
        <Card className="p-5 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <ListChecks size={15} className="text-accent-500" />
              {t("dash.agenda")}
            </h2>
            {overdue.length > 0 && <Badge tone="rose">{t("dash.overdue")} · {fmtNum(overdue.length, lang)}</Badge>}
          </div>
          {overdue.length === 0 && dueToday.length === 0 ? (
            <EmptyState icon={<CheckCircle2 size={20} />} title={t("dash.noAgenda")} />
          ) : (
            <div className="space-y-1">
              {[...overdue, ...dueToday].slice(0, 6).map((task) => {
                const isOver = !!task.dueDate && task.dueDate < today;
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-200 hover:bg-zinc-500/[0.05]"
                  >
                    <button
                      onClick={() => updateTask(task.id, { status: "done" })}
                      aria-label="done"
                      className="flex h-4.5 w-4.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-zinc-300 transition-all duration-200 hover:border-accent-500 dark:border-zinc-600"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{task.title}</span>
                    <Badge tone={isOver ? "rose" : "accent"}>
                      {isOver
                        ? t("time.overdueBy", { n: fmtNum(-Math.round((new Date(task.dueDate! + "T00:00").getTime() - new Date(today + "T00:00").getTime()) / 86400000), lang) })
                        : t("time.today")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
          <Link to="/tasks" className="chip mt-3 w-full justify-center py-2 text-[11px]">
            {t("tasks.new")}
          </Link>
        </Card>

        {/* goals glance */}
        <Card className="p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Target size={15} className="text-accent-500" />
              {t("dash.goalsGlance")}
            </h2>
            <Link to="/goals" className="chip py-1 text-[11px]">
              {t("common.viewAll")}
            </Link>
          </div>
          {topGoals.length === 0 ? (
            <EmptyState icon={<Target size={20} />} title={t("dash.noGoals")} />
          ) : (
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {topGoals.map(({ goal, progress, openLinked }) => {
                const days = Math.round(
                  (new Date(goal.targetDate + "T00:00").getTime() - new Date(today + "T00:00").getTime()) / 86400000,
                );
                return (
                  <div key={goal.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-2 text-[13px] font-medium">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[goal.category] }}
                        />
                        <span className="truncate">{goal.title}</span>
                      </p>
                      <span className="tnum shrink-0 text-xs font-semibold text-zinc-500">
                        {fmtPercent(progress, lang)}
                      </span>
                    </div>
                    <Progress value={progress} />
                    <p className="mt-1 text-[10px] text-zinc-400">
                      {days >= 0 ? t("time.daysLeft", { n: fmtNum(days, lang) }) : t("time.pastDue")}
                      {" · "}
                      {t("goals.linkedTasks", { n: fmtNum(openLinked, lang) })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
