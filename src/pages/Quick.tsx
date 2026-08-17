import { Link } from "react-router-dom";
import { Check, Lock, Zap } from "lucide-react";
import { useApp } from "../lib/store";
import { useI18n } from "../lib/i18n";
import { fmtFullDate, todayISO } from "../lib/dates";
import { cn, habitDoneOn, taskScore } from "../lib/utils";
import { Button, Card } from "../components/ui";

export function QuickPage() {
  const { user, tasks, habits, logs, toggleHabitDay, updateTask } = useApp();
  const { t, lang } = useI18n();
  const today = todayISO();

  if (!user?.is_premium) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-sm p-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500/10 text-accent-500">
            <Lock size={26} />
          </span>
          <h1 className="text-lg font-bold">{t("quick.lockedTitle")}</h1>
          <p className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
            {t("quick.lockedSub")}
          </p>
          <Link to="/upgrade">
            <Button className="mt-5 w-full justify-center">{t("locked.cta")}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const focus = tasks
    .filter((x) => x.status !== "done" && (x.today || x.dueDate === today))
    .sort((a, b) => taskScore(b) - taskScore(a))
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Zap size={19} className="text-accent-500" />
          {t("quick.title")}
        </h1>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{fmtFullDate(today, lang)}</p>
      </div>

      <Card className="p-4">
        <h2 className="mb-2.5 text-xs font-bold text-zinc-500 dark:text-zinc-400">{t("quick.habits")}</h2>
        <div className="space-y-1">
          {habits.length === 0 && <p className="text-xs text-zinc-400">{t("quick.noHabits")}</p>}
          {habits.map((h) => {
            const done = habitDoneOn(logs, h.id, today);
            return (
              <button
                key={h.id}
                onClick={() => toggleHabitDay(h.id, today)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start transition-colors duration-150 hover:bg-zinc-500/[0.05]"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
                    done ? "text-white" : "",
                  )}
                  style={{ borderColor: h.color, backgroundColor: done ? h.color : "transparent" }}
                >
                  {done && <Check size={13} strokeWidth={3} />}
                </span>
                <span className={cn("truncate text-[13px] font-medium", done && "text-zinc-400 line-through")}>
                  {h.title}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-2.5 text-xs font-bold text-zinc-500 dark:text-zinc-400">{t("quick.focus")}</h2>
        <div className="space-y-1">
          {focus.length === 0 && <p className="text-xs text-zinc-400">{t("quick.noFocus")}</p>}
          {focus.map((x) => (
            <button
              key={x.id}
              onClick={() => updateTask(x.id, { status: "done" })}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start transition-colors duration-150 hover:bg-zinc-500/[0.05]"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-zinc-400/50" />
              <span className="truncate text-[13px] font-medium">{x.title}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
