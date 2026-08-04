import { useState } from "react";
import { Check, Flame, MoreHorizontal, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import type { Habit } from "../lib/types";
import { useApp } from "../lib/store";
import { useI18n } from "../lib/i18n";
import { addDaysISO, fmtDate, fmtNum, fmtPercent, todayISO, weekStartISO } from "../lib/dates";
import { cn, habitDoneOn, habitRate14, habitStreak } from "../lib/utils";
import { Badge, Button, Card, EmptyState, Menu } from "../components/ui";
import { HabitModal } from "../components/forms";
import { Heatmap } from "../components/Heatmap";

function HabitCard({ habit, onEdit, onDelete }: { habit: Habit; onEdit: () => void; onDelete: () => void }) {
  const { t, lang } = useI18n();
  const { logs, toggleHabitDay } = useApp();
  const today = todayISO();
  const done = habitDoneOn(logs, habit.id, today);
  const streak = habitStreak(logs, habit, lang);
  const rate = habitRate14(logs, habit);
  const ws = weekStartISO(today, lang);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${habit.color}1f`, color: habit.color }}
          >
            <Repeat size={15} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold">{habit.title}</h3>
            <p className="text-[10.5px] text-zinc-400">
              {habit.frequency === "daily"
                ? t("habits.daily")
                : `${t("habits.weekly")} · ${fmtNum(habit.targetPerWeek, lang)} ${t("habits.targetUnit")}`}
            </p>
          </div>
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

      {/* streak + rate */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame size={22} style={{ color: habit.color }} />
          <span className="tnum text-2xl font-extrabold tracking-tight">{fmtNum(streak, lang)}</span>
          <span className="text-xs text-zinc-400">
            {habit.frequency === "daily" ? t("habits.dayUnit") : t("habits.weekUnit")} · {t("habits.streak")}
          </span>
        </div>
        <Badge tone={rate >= 0.7 ? "emerald" : rate >= 0.4 ? "amber" : "rose"}>
          {t("habits.rate14")}: {fmtPercent(rate * 100, lang)}
        </Badge>
      </div>

      {/* this week dots */}
      <div className="mt-4">
        <p className="mb-1.5 text-[10.5px] font-medium text-zinc-400">{t("habits.thisWeek")}</p>
        <div className="flex gap-1.5">
          {Array.from({ length: 7 }, (_, i) => {
            const iso = addDaysISO(ws, i);
            const d = habitDoneOn(logs, habit.id, iso);
            const future = iso > today;
            return (
              <button
                key={iso}
                disabled={future}
                onClick={() => toggleHabitDay(habit.id, iso)}
                title={fmtDate(iso, lang, { weekday: "short", day: "numeric", month: "short" })}
                className={cn(
                  "flex h-7 flex-1 cursor-pointer items-center justify-center rounded-lg border text-[10px] transition-all duration-200 disabled:cursor-default disabled:opacity-30",
                  d ? "border-transparent text-white" : "border-zinc-200 hover:border-zinc-300 dark:border-white/10 dark:hover:border-white/20",
                )}
                style={d ? { backgroundColor: habit.color } : undefined}
              >
                {fmtDate(iso, lang, { weekday: "narrow" })}
              </button>
            );
          })}
        </div>
      </div>

      {/* heatmap */}
      <div className="mt-4">
        <p className="mb-2 text-[10.5px] font-medium text-zinc-400">{t("habits.last24")}</p>
        <Heatmap days={logs[habit.id] ?? []} lang={lang} color={habit.color} />
      </div>

      {/* check-in */}
      <Button
        variant={done ? "secondary" : "primary"}
        className="mt-4 w-full justify-center"
        style={done ? { borderColor: habit.color, color: habit.color } : undefined}
        onClick={() => toggleHabitDay(habit.id, today)}
      >
        {done ? (
          <>
            <Check size={15} strokeWidth={3} />
            {t("habits.checked")}
          </>
        ) : (
          t("habits.check")
        )}
      </Button>
    </Card>
  );
}

export function HabitsPage() {
  const { habits, deleteHabit } = useApp();
  const { t } = useI18n();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t("habits.title")}</h1>
        <Button onClick={() => { setEditing(null); setModal(true); }}>
          <Plus size={16} />
          {t("habits.new")}
        </Button>
      </div>

      {habits.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Flame size={22} />}
            title={t("habits.empty")}
            sub={t("habits.emptySub")}
            action={
              <Button onClick={() => { setEditing(null); setModal(true); }}>
                <Plus size={15} />
                {t("habits.new")}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {habits.map((h) => (
            <HabitCard key={h.id} habit={h} onEdit={() => { setEditing(h); setModal(true); }} onDelete={() => deleteHabit(h.id)} />
          ))}
        </div>
      )}

      <HabitModal open={modal} onClose={() => setModal(false)} initial={editing} />
    </div>
  );
}
