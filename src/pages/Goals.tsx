import { useState } from "react";
import { CalendarClock, Check, ListChecks, MoreHorizontal, Pencil, Plus, Target, Trash2, X } from "lucide-react";
import type { Goal, GoalCategory } from "../lib/types";
import { CATEGORY_COLORS, GOAL_CATEGORIES } from "../lib/types";
import { useApp } from "../lib/store";
import { useI18n } from "../lib/i18n";
import { daysFromToday, fmtDate, fmtNum, fmtPercent, todayISO } from "../lib/dates";
import { cn, goalProgress, uid } from "../lib/utils";
import { Badge, Button, Card, EmptyState, Input, Menu, Progress } from "../components/ui";
import { GoalModal, type GoalModalInitial } from "../components/forms";

function GoalCard({
  goal,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t, lang } = useI18n();
  const { tasks, updateGoal } = useApp();
  const [mInput, setMInput] = useState("");
  const [showMInput, setShowMInput] = useState(false);

  const linked = tasks.filter((x) => x.goalId === goal.id);
  const progress = goalProgress(goal, linked);
  const color = CATEGORY_COLORS[goal.category];
  const days = daysFromToday(goal.targetDate);

  const toggleMilestone = (id: string) =>
    updateGoal(goal.id, {
      milestones: goal.milestones.map((m) => (m.id === id ? { ...m, done: !m.done } : m)),
    });

  const addMilestone = () => {
    if (!mInput.trim()) return;
    updateGoal(goal.id, {
      milestones: [...goal.milestones, { id: uid(), title: mInput.trim(), done: false }],
    });
    setMInput("");
    setShowMInput(false);
  };

  return (
    <Card hover className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${color}1f`, color }}
          >
            <Target size={15} />
          </span>
          <h3 className="truncate text-sm font-bold">{goal.title}</h3>
        </div>
        <Menu
          trigger={
            <button className="cursor-pointer rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-500/10 hover:text-zinc-700 dark:hover:text-zinc-200">
              <MoreHorizontal size={16} />
            </button>
          }
          items={[
            { label: t("common.edit"), icon: <Pencil size={13} />, onClick: onEdit },
            { label: t("common.delete"), icon: <Trash2 size={13} />, danger: true, onClick: onDelete },
          ]}
        />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Badge tone="zinc">{t(`cat.${goal.category}`)}</Badge>
        <span
          className={cn(
            "flex items-center gap-1 text-[11px]",
            days < 0 ? "font-semibold text-rose-500" : days <= 10 ? "text-amber-600 dark:text-amber-400" : "text-zinc-400",
          )}
        >
          <CalendarClock size={12} />
          {fmtDate(goal.targetDate, lang)} · {days >= 0 ? t("time.daysLeft", { n: fmtNum(days, lang) }) : t("time.pastDue")}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">{t("goals.progress")}</span>
          <span className="tnum font-bold" style={{ color }}>
            {fmtPercent(progress, lang)}
          </span>
        </div>
        <Progress value={progress} color={color} />
        <p className="mt-1.5 text-[10px] text-zinc-400">
          {goal.milestones.length || linked.length ? t("goals.auto") : t("goals.manual")}
        </p>
      </div>

      {/* milestones */}
      <div className="mt-3 space-y-1">
        {goal.milestones.map((m) => (
          <button
            key={m.id}
            onClick={() => toggleMilestone(m.id)}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-start transition-colors duration-150 hover:bg-zinc-500/[0.05]"
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
                m.done ? "border-transparent text-white" : "border-zinc-300 dark:border-zinc-600",
              )}
              style={m.done ? { backgroundColor: color } : undefined}
            >
              {m.done && <Check size={10} strokeWidth={3.5} />}
            </span>
            <span className={cn("text-xs", m.done ? "text-zinc-400 line-through" : "")}>{m.title}</span>
          </button>
        ))}
        {showMInput ? (
          <div className="flex items-center gap-1.5 px-1 pt-1">
            <Input
              value={mInput}
              onChange={(e) => setMInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMilestone()}
              placeholder={t("goals.addMilestone")}
              className="h-8 text-xs"
              autoFocus
            />
            <button onClick={addMilestone} className="cursor-pointer rounded-lg p-1.5 text-accent-600 hover:bg-accent-500/10" aria-label="add">
              <Check size={15} />
            </button>
            <button onClick={() => setShowMInput(false)} className="cursor-pointer rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-500/10" aria-label="cancel">
              <X size={15} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowMInput(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:text-accent-600"
          >
            <Plus size={13} />
            {t("goals.addMilestone")}
          </button>
        )}
      </div>

      <div className="mt-auto pt-3">
        <Badge tone="accent">
          <ListChecks size={11} />
          {t("goals.linkedTasks", { n: fmtNum(linked.length, lang) })}
        </Badge>
      </div>
    </Card>
  );
}

export function GoalsPage() {
  const { goals, deleteGoal } = useApp();
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState<"all" | GoalCategory>("all");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<GoalModalInitial | null>(null);

  const filtered = filter === "all" ? goals : goals.filter((g) => g.category === filter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t("goals.title")}</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {fmtNum(goals.length, lang)} · {fmtDate(todayISO(), lang, { day: "numeric", month: "long" })}
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setModal(true); }}>
          <Plus size={16} />
          {t("goals.new")}
        </Button>
      </div>

      <div className="scroll-none flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter("all")}
          className={cn("chip cursor-pointer", filter === "all" && "border-accent-400 bg-accent-500/10 text-accent-700 dark:text-accent-300")}
        >
          {t("common.all")}
        </button>
        {GOAL_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn("chip cursor-pointer", filter === c && "border-accent-400 bg-accent-500/10 text-accent-700 dark:text-accent-300")}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c] }} />
            {t(`cat.${c}`)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Target size={22} />}
            title={t("goals.empty")}
            sub={t("goals.emptySub")}
            action={
              <Button onClick={() => { setEditing(null); setModal(true); }}>
                <Plus size={15} />
                {t("goals.new")}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onEdit={() => { setEditing(g); setModal(true); }}
              onDelete={() => deleteGoal(g.id)}
            />
          ))}
        </div>
      )}

      <GoalModal open={modal} onClose={() => setModal(false)} initial={editing} />
    </div>
  );
}
