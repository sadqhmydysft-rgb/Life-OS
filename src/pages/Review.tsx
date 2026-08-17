import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles, CheckCircle2 } from "lucide-react";
import { useApp } from "../lib/store";
import { useI18n } from "../lib/i18n";
import { addDaysISO, fmtDate, fmtNum, todayISO, weekStartISO } from "../lib/dates";
import { Badge, Button, Card, EmptyState, Field, Progress, Textarea } from "../components/ui";

export function ReviewPage() {
  const { user, tasks, habits, logs, reflections, addReflection } = useApp();
  const { t, lang } = useI18n();

  const isPremium = !!user?.is_premium;

  const weekStart = weekStartISO(todayISO(), lang);
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)),
    [weekStart],
  );

  const tasksDone = tasks.filter(
    (tsk) => tsk.completedAt && weekDates.includes(tsk.completedAt.slice(0, 10)),
  ).length;

  const habitStats = habits.map((h) => {
    const done = (logs[h.id] ?? []).filter((d) => weekDates.includes(d)).length;
    const target = h.frequency === "daily" ? 7 : h.targetPerWeek || 1;
    return { ...h, done, target, pct: Math.min(100, (done / target) * 100) };
  });

  const alreadyDone = reflections.find((r) => r.weekStart === weekStart);
  const history = reflections.filter((r) => r.weekStart !== weekStart).slice(0, 8);

  const [wins, setWins] = useState("");
  const [challenges, setChallenges] = useState("");
  const [changeNext, setChangeNext] = useState("");
  const [saved, setSaved] = useState(false);

  const submit = () => {
    if (!wins.trim() && !challenges.trim() && !changeNext.trim()) return;
    addReflection({ weekStart, wins: wins.trim(), challenges: challenges.trim(), changeNext: changeNext.trim() });
    setSaved(true);
  };

  /* ------------------------------ access gate ------------------------------ */
  if (!isPremium) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-sm p-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500/10 text-accent-500">
            <Lock size={26} />
          </span>
          <h1 className="text-lg font-bold">{t("review.lockedTitle")}</h1>
          <p className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
            {t("review.lockedSub")}
          </p>
          <Link to="/upgrade">
            <Button className="mt-5 w-full justify-center">{t("locked.cta")}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  /* ------------------------------ page ------------------------------ */
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
          <Sparkles size={22} className="text-accent-500" />
          {t("review.title")}
        </h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {fmtDate(weekStart, lang, { day: "numeric", month: "long" })} –{" "}
          {fmtDate(weekDates[6], lang, { day: "numeric", month: "long" })}
        </p>
      </div>

      {/* auto summary */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-bold">{t("review.summary")}</h2>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          {t("review.tasksDone")}: <span className="tnum font-semibold text-zinc-700 dark:text-zinc-200">{fmtNum(tasksDone, lang)}</span>
        </p>
        <div className="space-y-3">
          {habitStats.length === 0 && (
            <p className="text-xs text-zinc-400">{t("review.noHabits")}</p>
          )}
          {habitStats.map((h) => (
            <div key={h.id}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">{h.title}</span>
                <span className="tnum text-zinc-400">
                  {fmtNum(h.done, lang)}/{fmtNum(h.target, lang)}
                </span>
              </div>
              <Progress value={h.pct} color={h.color} />
            </div>
          ))}
        </div>
      </Card>

      {/* reflection form */}
      <Card className="p-5">
        {alreadyDone || saved ? (
          <EmptyState
            icon={<CheckCircle2 size={20} />}
            title={t("review.doneTitle")}
            sub={t("review.doneSub")}
          />
        ) : (
          <div className="space-y-4">
            <Field label={t("review.q1")}>
              <Textarea value={wins} onChange={(e) => setWins(e.target.value)} rows={3} />
            </Field>
            <Field label={t("review.q2")}>
              <Textarea value={challenges} onChange={(e) => setChallenges(e.target.value)} rows={3} />
            </Field>
            <Field label={t("review.q3")}>
              <Textarea value={changeNext} onChange={(e) => setChangeNext(e.target.value)} rows={3} />
            </Field>
            <Button className="w-full justify-center" onClick={submit}>
              {t("review.save")}
            </Button>
          </div>
        )}
      </Card>

      {/* history */}
      {history.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-zinc-200/70 px-5 py-4 dark:border-white/[0.06]">
            <h2 className="text-sm font-bold">{t("review.history")}</h2>
          </div>
          <div className="max-h-96 overflow-y-auto scroll-thin">
            {history.map((r) => (
              <div key={r.id} className="border-t border-zinc-200/50 px-5 py-3.5 dark:border-white/[0.04]">
                <div className="mb-2 flex items-center gap-2">
                  <Badge tone="accent">{fmtDate(r.weekStart, lang, { day: "numeric", month: "short" })}</Badge>
                </div>
                {r.wins && <p className="mb-1 text-xs text-zinc-600 dark:text-zinc-300">✅ {r.wins}</p>}
                {r.challenges && <p className="mb-1 text-xs text-zinc-600 dark:text-zinc-300">⚠️ {r.challenges}</p>}
                {r.changeNext && <p className="text-xs text-zinc-600 dark:text-zinc-300">🔁 {r.changeNext}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
