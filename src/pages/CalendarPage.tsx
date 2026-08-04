import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useApp } from "../lib/store";
import { useI18n } from "../lib/i18n";
import {
  addDaysISO,
  fmtDate,
  fmtFullDate,
  fmtNum,
  getMonthGrid,
  shiftMonth,
  todayISO,
  weekStartISO,
} from "../lib/dates";
import { cn, habitDoneOn } from "../lib/utils";
import { Badge, Card, IconButton, Input, Segmented } from "../components/ui";

export function CalendarPage() {
  const { tasks, habits, logs, toggleHabitDay, updateTask, addTask } = useApp();
  const { t, lang } = useI18n();
  const today = todayISO();
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState<"month" | "week">("month");
  const [quick, setQuick] = useState("");

  const grid = useMemo(() => getMonthGrid(anchor, lang), [anchor, lang]);
  const weekStart = weekStartISO(selected, lang);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));

  const tasksOn = (iso: string) => tasks.filter((x) => x.dueDate === iso);
  const checkInsOn = (iso: string) => habits.filter((h) => habitDoneOn(logs, h.id, iso));

  const nav = (dir: 1 | -1) => {
    if (view === "month") setAnchor(shiftMonth(anchor, dir, lang));
    else {
      const next = addDaysISO(selected, dir * 7);
      setSelected(next);
      setAnchor(next);
    }
  };

  const goToday = () => {
    setAnchor(today);
    setSelected(today);
  };

  const quickAdd = () => {
    const title = quick.trim();
    if (!title) return;
    addTask({
      title,
      dueDate: selected,
      priority: "medium",
      tags: [],
      status: "todo",
      today: selected === today,
    });
    setQuick("");
  };

  const selectedTasks = tasksOn(selected);
  const selectedHabits = habits;

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t("cal.title")}</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {view === "month" ? grid.title : `${fmtDate(weekDays[0], lang)} — ${fmtDate(weekDays[6], lang)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "month", label: t("cal.month") },
              { value: "week", label: t("cal.week") },
            ]}
          />
          <div className="flex items-center gap-1">
            <IconButton label="prev" onClick={() => nav(-1)}>
              <ChevronRight size={16} className="rtl:-scale-x-100" />
            </IconButton>
            <button
              onClick={goToday}
              className="chip cursor-pointer border-accent-300 text-accent-700 dark:text-accent-300"
            >
              {t("cal.today")}
            </button>
            <IconButton label="next" onClick={() => nav(1)}>
              <ChevronLeft size={16} className="rtl:-scale-x-100" />
            </IconButton>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        {/* ------------------------------ calendar grid ------------------------------ */}
        <Card className="p-4">
          {view === "month" ? (
            <>
              <div className="mb-2 grid grid-cols-7">
                {grid.weekdayLabels.map((w) => (
                  <p key={w} className="py-1 text-center text-[10.5px] font-medium text-zinc-400">
                    {w}
                  </p>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {grid.cells.map((cell) => {
                  const due = tasksOn(cell.iso);
                  const checks = checkInsOn(cell.iso);
                  const isSel = cell.iso === selected;
                  return (
                    <button
                      key={cell.iso}
                      onClick={() => setSelected(cell.iso)}
                      className={cn(
                        "flex min-h-14 cursor-pointer flex-col items-start justify-between rounded-xl border p-1.5 text-start transition-all duration-200 sm:min-h-22 sm:p-2",
                        !cell.inMonth && "opacity-35",
                        isSel
                          ? "border-accent-500 bg-accent-500/10 ring-2 ring-accent-500/20"
                          : "border-zinc-200/70 bg-white/40 hover:border-zinc-300 hover:bg-white/70 dark:border-white/[0.05] dark:bg-white/[0.02] dark:hover:bg-white/[0.05]",
                      )}
                    >
                      <span
                        className={cn(
                          "tnum flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                          cell.isToday && "bg-accent-600 text-white",
                          !cell.isToday && "text-zinc-600 dark:text-zinc-300",
                        )}
                      >
                        {cell.dayLabel}
                      </span>
                      <span className="flex w-full items-center gap-1 pe-0.5">
                        {due.slice(0, 3).map((task) => (
                          <span
                            key={task.id}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              task.status === "done" ? "bg-accent-500/30" : "bg-accent-500",
                            )}
                          />
                        ))}
                        {checks.length > 0 && (
                          <span className="ms-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        )}
                        {due.length > 3 && (
                          <span className="tnum text-[8.5px] font-semibold text-zinc-400">
                            +{fmtNum(due.length - 3, lang)}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="scroll-none overflow-x-auto">
              <div className="grid min-w-[620px] grid-cols-7 gap-2">
                {weekDays.map((iso) => {
                  const due = tasksOn(iso);
                  const isSel = iso === selected;
                  return (
                    <div
                      key={iso}
                      onClick={() => setSelected(iso)}
                      className={cn(
                        "flex min-h-56 cursor-pointer flex-col gap-1.5 rounded-xl border p-2 transition-all duration-200",
                        isSel
                          ? "border-accent-500 bg-accent-500/10 ring-2 ring-accent-500/20"
                          : "border-zinc-200/70 bg-white/40 hover:bg-white/70 dark:border-white/[0.05] dark:bg-white/[0.02] dark:hover:bg-white/[0.05]",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9.5px] font-medium text-zinc-400">
                          {fmtDate(iso, lang, { weekday: "short" })}
                        </span>
                        <span
                          className={cn(
                            "tnum flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                            iso === today && "bg-accent-600 text-white",
                          )}
                        >
                          {fmtDate(iso, lang, { day: "numeric" })}
                        </span>
                      </div>
                      {due.map((task) => (
                        <span
                          key={task.id}
                          className={cn(
                            "truncate rounded-lg border-s-2 border-accent-500 bg-accent-500/10 px-1.5 py-1 text-[9.5px] text-accent-800 dark:text-accent-200",
                            task.status === "done" && "opacity-45 line-through",
                          )}
                        >
                          {task.title}
                        </span>
                      ))}
                      {checkInsOn(iso).map((h) => (
                        <span
                          key={h.id}
                          className="flex items-center gap-1 truncate rounded-lg bg-emerald-500/10 px-1.5 py-1 text-[9.5px] text-emerald-700 dark:text-emerald-300"
                        >
                          <Check size={10} strokeWidth={3} />
                          {h.title}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* legend */}
          <div className="mt-4 flex items-center gap-4 border-t border-zinc-200/60 pt-3 text-[10px] text-zinc-400 dark:border-white/[0.06]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent-500" /> {t("cal.tasks")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> {t("cal.habits")}
            </span>
          </div>
        </Card>

        {/* ------------------------------ day panel ------------------------------ */}
        <Card className="p-5 lg:sticky lg:top-5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold">{t("cal.dayItems")}</h2>
            {selected === today && <Badge tone="accent">{t("cal.today")}</Badge>}
          </div>
          <p className="mb-4 text-[11px] text-zinc-400">{fmtFullDate(selected, lang)}</p>

          {/* tasks */}
          <p className="mb-1.5 text-[10.5px] font-semibold text-zinc-400 uppercase">{t("cal.tasks")}</p>
          <div className="space-y-1">
            {selectedTasks.length === 0 && (
              <p className="py-1 text-[11px] text-zinc-400">{t("cal.noItems")}</p>
            )}
            {selectedTasks.map((task) => {
              const done = task.status === "done";
              return (
                <div key={task.id} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-zinc-500/[0.05]">
                  <button
                    onClick={() => updateTask(task.id, { status: done ? "todo" : "done" })}
                    aria-label="toggle"
                    className={cn(
                      "flex h-4.5 w-4.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-all duration-200",
                      done ? "border-emerald-500 bg-emerald-500 text-white" : "border-zinc-300 hover:border-accent-500 dark:border-zinc-600",
                    )}
                  >
                    {done && <Check size={11} strokeWidth={3.5} />}
                  </button>
                  <span className={cn("flex-1 truncate text-xs", done && "text-zinc-400 line-through")}>
                    {task.title}
                  </span>
                </div>
              );
            })}
          </div>

          {/* habits */}
          <p className="mt-4 mb-1.5 text-[10.5px] font-semibold text-zinc-400 uppercase">{t("cal.habits")}</p>
          <div className="space-y-1">
            {selectedHabits.length === 0 && (
              <p className="py-1 text-[11px] text-zinc-400">{t("cal.noItems")}</p>
            )}
            {selectedHabits.map((h) => {
              const d = habitDoneOn(logs, h.id, selected);
              return (
                <button
                  key={h.id}
                  onClick={() => toggleHabitDay(h.id, selected)}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-start transition-colors hover:bg-zinc-500/[0.05]"
                >
                  <span
                    className={cn(
                      "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
                      d ? "border-transparent text-white" : "border-zinc-300 dark:border-zinc-600",
                    )}
                    style={d ? { backgroundColor: h.color } : undefined}
                  >
                    {d && <Check size={11} strokeWidth={3.5} />}
                  </span>
                  <span className={cn("flex-1 truncate text-xs", d && "text-zinc-400 line-through")}>{h.title}</span>
                </button>
              );
            })}
          </div>

          {/* quick add */}
          <div className="mt-4 flex items-center gap-2 border-t border-zinc-200/60 pt-3 dark:border-white/[0.06]">
            <Plus size={14} className="ms-1 shrink-0 text-zinc-400" />
            <Input
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && quickAdd()}
              placeholder={t("cal.quickAdd")}
              className="h-9 border-none bg-transparent px-1 shadow-none focus:ring-0 dark:bg-transparent"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
