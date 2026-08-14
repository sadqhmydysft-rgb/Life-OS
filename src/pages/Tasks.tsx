import { useEffect, useMemo, useState } from "react";
import {
  Check,
  KanbanSquare,
  List,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import type { Task, TaskStatus } from "../lib/types";
import { CATEGORY_COLORS } from "../lib/types";
import { useApp } from "../lib/store";
import { useI18n } from "../lib/i18n";
import { daysFromToday, fmtNum, todayISO } from "../lib/dates";
import { cn, taskScore } from "../lib/utils";
import { Badge, Button, Card, EmptyState, Menu, Segmented } from "../components/ui";
import { TaskModal } from "../components/forms";

const PRIO_COLORS: Record<Task["priority"], string> = {
  high: "#f43f5e",
  medium: "#f59e0b",
  low: "#38bdf8",
};

function DueBadge({ task }: { task: Task }) {
  const { t, lang } = useI18n();
  if (!task.dueDate) return null;
  const d = daysFromToday(task.dueDate);
  if (task.status === "done") return null;
  if (d < 0) return <Badge tone="rose">{t("time.overdueBy", { n: fmtNum(-d, lang) })}</Badge>;
  if (d === 0) return <Badge tone="accent">{t("time.today")}</Badge>;
  if (d === 1) return <Badge tone="zinc">{t("time.tomorrow")}</Badge>;
  return <Badge tone="zinc">{t("time.inDays", { n: fmtNum(d, lang) })}</Badge>;
}

function TaskRow({
  task,
  onEdit,
}: {
  task: Task;
  onEdit: (t: Task) => void;
}) {
  const { t } = useI18n();
  const { goals, updateTask, deleteTask } = useApp();
  const goal = goals.find((g) => g.id === task.goalId);
  const done = task.status === "done";

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-zinc-500/[0.04]",
        done && "opacity-55",
      )}
    >
      <button
        onClick={() => updateTask(task.id, { status: done ? "todo" : "done" })}
        aria-label="toggle done"
        className={cn(
          "flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-all duration-200",
          done
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-zinc-300 hover:border-accent-500 hover:bg-accent-500/10 dark:border-zinc-600",
        )}
      >
        {done && <Check size={12} strokeWidth={3.5} />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[13px] font-medium", done && "line-through")}>{task.title}</p>
        {(task.tags.length > 0 || task.notes) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-zinc-500/10 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:text-zinc-400"
              >
                {tag.startsWith("#") ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <DueBadge task={task} />
        {goal && (
          <Badge className="hidden md:inline-flex" tone="accent">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[goal.category] }} />
            {goal.title}
          </Badge>
        )}
        <span className="h-2 w-2 shrink-0 rounded-full" title={t(`prio.${task.priority}`)} style={{ backgroundColor: PRIO_COLORS[task.priority] }} />
        {task.status !== "done" && (
          <Badge tone={task.status === "inprogress" ? "amber" : "zinc"} className="hidden sm:inline-flex">
            {t(`tasks.${task.status}` as "tasks.todo")}
          </Badge>
        )}
        <button
          onClick={() => updateTask(task.id, { today: !task.today })}
          aria-label="today focus"
          className={cn(
            "cursor-pointer rounded-lg p-1 transition-all duration-200",
            task.today ? "text-accent-500" : "text-zinc-300 opacity-0 group-hover:opacity-100 hover:text-accent-500 dark:text-zinc-600",
          )}
        >
          <Star size={15} fill={task.today ? "currentColor" : "none"} />
        </button>
        <Menu
          trigger={
            <button className="cursor-pointer rounded-lg p-1 text-zinc-300 transition-colors hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-300">
              <MoreHorizontal size={15} />
            </button>
          }
          items={[
            { label: t("common.edit"), icon: <Pencil size={13} />, onClick: () => onEdit(task) },
            { label: t("common.delete"), icon: <Trash2 size={13} />, danger: true, onClick: () => deleteTask(task.id) },
          ]}
        />
      </div>
    </div>
  );
}

/* ------------------------------ board ------------------------------ */

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "tasks.todo" },
  { id: "inprogress", label: "tasks.inprogress" },
  { id: "done", label: "tasks.done" },
];

function BoardCard({
  task,
  onEdit,
  dragId,
  setDragId,
}: {
  task: Task;
  onEdit: (t: Task) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
}) {
  const { t } = useI18n();
  const { goals, updateTask, deleteTask } = useApp();
  const goal = goals.find((g) => g.id === task.goalId);
  const done = task.status === "done";

  return (
    <div
      draggable
      onDragStart={(e) => {
        setDragId(task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => setDragId(null)}
      className={cn(
        "card cursor-grab p-3 transition-all duration-200 active:cursor-grabbing",
        dragId === task.id && "rotate-1 opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => onEdit(task)}
          className={cn(
            "min-w-0 flex-1 cursor-pointer text-start text-[13px] leading-5 font-medium hover:text-accent-600 dark:hover:text-accent-300",
            done && "text-zinc-400 line-through",
          )}
        >
          {task.title}
        </button>
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PRIO_COLORS[task.priority] }} />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <DueBadge task={task} />
        {goal && (
          <Badge tone="accent">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[goal.category] }} />
            {goal.title}
          </Badge>
        )}
        {task.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="rounded-md bg-zinc-500/10 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
            #{tag}
          </span>
        ))}
        <div className="ms-auto">
          <Menu
            trigger={
              <button className="cursor-pointer rounded-md p-1 text-zinc-300 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-300">
                <MoreHorizontal size={13} />
              </button>
            }
            items={[
              ...COLUMNS.filter((c) => c.id !== task.status).map((c) => ({
                label: `${t("tasks.moveTo")}: ${t(c.label)}`,
                icon: <KanbanSquare size={13} />,
                onClick: () => updateTask(task.id, { status: c.id }),
              })),
              { label: t("common.edit"), icon: <Pencil size={13} />, onClick: () => onEdit(task) },
              { label: t("common.delete"), icon: <Trash2 size={13} />, danger: true, onClick: () => deleteTask(task.id) },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export function TasksPage() {
  const { tasks, updateTask } = useApp();
  const { t, lang } = useI18n();
  const [view, setView] = useState<"list" | "board">("list");
  const [filter, setFilter] = useState<"all" | "today" | "overdue">("all");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);

  const filtered = useMemo(() => {
    const today = todayISO();
    return tasks.filter((x) => {
      if (filter === "today") return x.today || x.dueDate === today;
      if (filter === "overdue") return x.status !== "done" && !!x.dueDate && x.dueDate < today;
      return true;
    });
  }, [tasks, filter]);

  const listSorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
        return taskScore(b) - taskScore(a);
      }),
    [filtered],
  );

  const openEdit = (task: Task) => {
    setEditing(task);
    setModal(true);
  };

  const openCounts = tasks.filter((x) => x.status !== "done").length;
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setEditing(null);
      setModal(true);
    }
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t("tasks.title")}</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {fmtNum(openCounts, lang)} / {fmtNum(tasks.length, lang)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: t("tasks.list"), icon: <List size={13} /> },
              { value: "board", label: t("tasks.board"), icon: <KanbanSquare size={13} /> },
            ]}
          />
          <Button onClick={() => { setEditing(null); setModal(true); }}>
            <Plus size={16} />
            <span className="hidden sm:inline">{t("tasks.new")}</span>
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {(["all", "today", "overdue"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "chip cursor-pointer",
              filter === f && "border-accent-400 bg-accent-500/10 text-accent-700 dark:text-accent-300",
            )}
          >
            {t(`tasks.filter${f === "all" ? "All" : f === "today" ? "Today" : "Overdue"}`)}
          </button>
        ))}
      </div>

      {view === "list" ? (
        <Card className="divide-y divide-zinc-200/60 overflow-hidden dark:divide-white/[0.05]">
          {listSorted.length === 0 ? (
            <EmptyState icon={<ListChecks size={22} />} title={t("tasks.empty")} />
          ) : (
            listSorted.map((task) => <TaskRow key={task.id} task={task} onEdit={openEdit} />)
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const colTasks = filtered.filter((x) => x.status === col.id);
            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(col.id);
                }}
                onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) updateTask(dragId, { status: col.id });
                  setDragId(null);
                  setOverCol(null);
                }}
                className={cn(
                  "flex min-h-40 flex-col gap-2.5 rounded-2xl border border-dashed border-zinc-300/70 bg-zinc-500/[0.03] p-3 transition-all duration-200 dark:border-white/[0.08]",
                  overCol === col.id && dragId && "border-accent-400 bg-accent-500/[0.06] ring-2 ring-accent-500/20",
                )}
              >
                <div className="flex items-center justify-between px-1.5 pb-1">
                  <span
                    className={cn(
                      "flex items-center gap-2 text-xs font-bold",
                      col.id === "done" && "text-emerald-600 dark:text-emerald-400",
                      col.id === "inprogress" && "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {t(col.label)}
                  </span>
                  <Badge tone="zinc">{fmtNum(colTasks.length, lang)}</Badge>
                </div>
                {colTasks.length === 0 && !dragId && (
                  <p className="px-1.5 py-6 text-center text-[11px] text-zinc-400">{t("tasks.emptyBoard")}</p>
                )}
                {colTasks.map((task) => (
                  <BoardCard key={task.id} task={task} onEdit={openEdit} dragId={dragId} setDragId={setDragId} />
                ))}
                {dragId && (
                  <div className="rounded-xl border-2 border-dashed border-accent-400/50 py-5 text-center text-[10px] font-medium text-accent-500">
                    {t(col.label)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <TaskModal open={modal} onClose={() => setModal(false)} initial={editing} />
    </div>
  );
}
