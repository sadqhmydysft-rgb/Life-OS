import { useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import type { GoalCategory, Habit, Milestone, Task } from "../lib/types";
import { CATEGORY_COLORS, GOAL_CATEGORIES } from "../lib/types";
import { useApp } from "../lib/store";
import { useI18n } from "../lib/i18n";
import { fmtNum, todayISO } from "../lib/dates";
import { cn, uid } from "../lib/utils";
import { Button, Field, Input, Modal, Segmented, Switch, Textarea } from "./ui";

const PRIOS = [
  { value: "high", color: "#f43f5e" },
  { value: "medium", color: "#f59e0b" },
  { value: "low", color: "#38bdf8" },
] as const;

export function TaskModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Task | null;
}) {
  const { t, lang } = useI18n();
  const { addTask, updateTask, goals } = useApp();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [goalId, setGoalId] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [today, setToday] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setDueDate(initial?.dueDate ?? "");
    setPriority(initial?.priority ?? "medium");
    setGoalId(initial?.goalId ?? "");
    setTags((initial?.tags ?? []).join(", "));
    setNotes(initial?.notes ?? "");
    setToday(initial?.today ?? false);
  }, [open, initial]);

  const save = () => {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      dueDate: dueDate || undefined,
      priority,
      goalId: goalId || undefined,
      tags: tags
        .split(/[,،]/)
        .map((s) => s.trim())
        .filter(Boolean),
      notes: notes.trim() || undefined,
      today,
    };
    if (initial) updateTask(initial.id, payload);
    else addTask({ ...payload, status: "todo" });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? t("tasks.edit") : t("tasks.new")}>
      <div className="space-y-4">
        <Field label={t("common.title")}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("tasks.due")}>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} dir="ltr" />
          </Field>
          <Field label={t("tasks.priority")}>
            <Segmented
              value={priority}
              onChange={setPriority}
              className="w-full"
              options={PRIOS.map((p) => ({
                value: p.value,
                label: (
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                    {t(`prio.${p.value}`)}
                  </span>
                ),
              }))}
            />
          </Field>
        </div>

        <Field label={t("tasks.goal")}>
          <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="input cursor-pointer">
            <option value="">{t("tasks.noGoal")}</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("tasks.tags")}>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t("tasks.tagsPh")} />
        </Field>

        <Field label={t("tasks.notes")}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("tasks.notesPh")} />
        </Field>

        <div className="flex items-center justify-between rounded-xl border border-zinc-200/80 bg-zinc-500/[0.04] px-3.5 py-3 dark:border-white/[0.08]">
          <span className="text-xs font-medium">{t("tasks.addToToday")}</span>
          <Switch checked={today} onChange={setToday} label={t("tasks.addToToday")} />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={!title.trim()}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function GoalModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: GoalModalInitial | null;
}) {
  const { t, lang } = useI18n();
  const { addGoal, updateGoal } = useApp();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<GoalCategory>("personal");
  const [targetDate, setTargetDate] = useState(todayISO());
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [mInput, setMInput] = useState("");
  const [manual, setManual] = useState(0);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setCategory(initial?.category ?? "personal");
    setTargetDate(initial?.targetDate ?? todayISO());
    setMilestones(initial?.milestones ?? []);
    setMInput("");
    setManual(initial?.manualProgress ?? 0);
  }, [open, initial]);

  const addMilestone = () => {
    if (!mInput.trim()) return;
    setMilestones((ms) => [...ms, { id: uid(), title: mInput.trim(), done: false }]);
    setMInput("");
  };

  const save = () => {
    if (!title.trim()) return;
    const payload = { title: title.trim(), category, targetDate, milestones, manualProgress: manual };
    if (initial) updateGoal(initial.id, payload);
    else addGoal(payload);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? t("goals.edit") : t("goals.new")}>
      <div className="space-y-4">
        <Field label={t("common.title")}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>

        <Field label={t("goals.category")}>
          <div className="flex flex-wrap gap-1.5">
            {GOAL_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "chip cursor-pointer",
                  category === c &&
                    "border-accent-400 bg-accent-500/10 text-accent-700 dark:border-accent-500/60 dark:text-accent-300",
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c] }} />
                {t(`cat.${c}`)}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t("goals.targetDate")}>
          <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} dir="ltr" />
        </Field>

        <Field label={t("goals.milestones")}>
          <div className="space-y-1.5">
            {milestones.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-xl border border-zinc-200/70 bg-white/60 px-3 py-2 dark:border-white/[0.07] dark:bg-white/[0.03]"
              >
                <button
                  type="button"
                  onClick={() =>
                    setMilestones((ms) => ms.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)))
                  }
                  className={cn(
                    "flex h-4.5 w-4.5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all duration-200",
                    m.done
                      ? "border-accent-600 bg-accent-600 text-white"
                      : "border-zinc-300 dark:border-zinc-600",
                  )}
                >
                  {m.done && <Check size={11} strokeWidth={3} />}
                </button>
                <span className={cn("flex-1 text-xs", m.done && "text-zinc-400 line-through")}>{m.title}</span>
                <button
                  type="button"
                  onClick={() => setMilestones((ms) => ms.filter((x) => x.id !== m.id))}
                  className="cursor-pointer text-zinc-400 transition-colors hover:text-rose-500"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={mInput}
                onChange={(e) => setMInput(e.target.value)}
                placeholder={t("goals.addMilestone")}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMilestone())}
                className="h-9 text-xs"
              />
              <Button type="button" variant="secondary" size="sm" onClick={addMilestone} className="h-9 shrink-0">
                <Plus size={14} />
              </Button>
            </div>
          </div>
        </Field>

        <Field label={`${t("goals.manual")} — ${fmtNum(manual, lang)}٪`.replace("٪", lang === "fa" ? "٪" : "%")} hint={t("goals.manualHint")}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={manual}
            onChange={(e) => setManual(Number(e.target.value))}
            className="w-full cursor-pointer accent-accent-600"
            dir="ltr"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={!title.trim()}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export type GoalModalInitial = {
  id: string;
  title: string;
  category: GoalCategory;
  targetDate: string;
  milestones: Milestone[];
  manualProgress: number;
};

/* ------------------------------------------------------------------ */

const HABIT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#0ea5e9", "#8b5cf6"];

export function HabitModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Habit | null;
}) {
  const { t, lang } = useI18n();
  const { addHabit, updateHabit } = useApp();
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<Habit["frequency"]>("daily");
  const [target, setTarget] = useState(3);
  const [color, setColor] = useState(HABIT_COLORS[0]);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setFrequency(initial?.frequency ?? "daily");
    setTarget(initial?.targetPerWeek ?? 3);
    setColor(initial?.color ?? HABIT_COLORS[0]);
  }, [open, initial]);

  const save = () => {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      frequency,
      targetPerWeek: frequency === "daily" ? 7 : target,
      color,
    };
    if (initial) updateHabit(initial.id, payload);
    else addHabit(payload);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? t("habits.edit") : t("habits.new")}>
      <div className="space-y-4">
        <Field label={t("common.title")}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && save()} />
        </Field>

        <Field label={t("habits.frequency")}>
          <Segmented
            value={frequency}
            onChange={setFrequency}
            options={[
              { value: "daily", label: t("habits.daily") },
              { value: "weekly", label: t("habits.weekly") },
            ]}
          />
        </Field>

        {frequency === "weekly" && (
          <Field label={`${t("habits.target")} · ${fmtNum(target, lang)} ${t("habits.targetUnit")}`}>
            <Segmented
              value={String(target)}
              onChange={(v) => setTarget(Number(v))}
              options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: String(n) }))}
            />
          </Field>
        )}

        <Field label={t("common.color")}>
          <div className="flex gap-2">
            {HABIT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "h-8 w-8 cursor-pointer rounded-full transition-all duration-200",
                  color === c && "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900",
                )}
                style={{ backgroundColor: c, ["--tw-ring-color" as string]: c }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={!title.trim()}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
