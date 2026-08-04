import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, ShieldAlert, ShieldCheck, Trash2, Users } from "lucide-react";
import { useApp } from "../lib/store";
import { useI18n } from "../lib/i18n";
import { getAdminData, type AdminData } from "../lib/admin";
import { clearLocalErrors } from "../lib/errorlog";
import { fmtDate, fmtNum, fmtTime } from "../lib/dates";
import { cn } from "../lib/utils";
import { Badge, Button, Card, EmptyState, IconButton } from "../components/ui";

export function AdminPage() {
  const { user, backendMode, makeLocalAdmin } = useApp();
  const { t, lang } = useI18n();
  const [data, setData] = useState<AdminData | null>(null);
  const [spinning, setSpinning] = useState(false);

  const isAdmin = !!user?.is_admin;

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setSpinning(true);
      try {
        setData(await getAdminData(backendMode));
      } finally {
        if (!quiet) setSpinning(false);
      }
    },
    [backendMode],
  );

  useEffect(() => {
    if (!isAdmin) return;
    void load();
    const iv = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(iv);
  }, [isAdmin, load]);

  /* ------------------------------ access gate ------------------------------ */
  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-sm p-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
            <ShieldAlert size={26} />
          </span>
          <h1 className="text-lg font-bold">{t("admin.noAccess")}</h1>
          <p className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">{t("admin.noAccessSub")}</p>
          {backendMode === "local" && user && (
            <div className="mt-5 rounded-xl border border-zinc-200/70 bg-zinc-500/[0.04] p-3.5 dark:border-white/[0.07]">
              <Button size="sm" className="w-full justify-center" onClick={makeLocalAdmin}>
                <ShieldCheck size={14} />
                {t("admin.makeMeAdmin")}
              </Button>
              <p className="mt-2 text-[10px] leading-4 text-zinc-400">{t("admin.makeMeAdminHint")}</p>
            </div>
          )}
        </Card>
      </div>
    );
  }

  /* ------------------------------ dashboard ------------------------------ */
  const maxBucket = Math.max(1, ...(data?.signups14.map((b) => b.count) ?? [1]));

  const stats = data
    ? [
        { icon: Users, label: t("admin.totalSignups"), value: data.total, tone: "text-accent-500", bg: "bg-accent-500/10" },
        { icon: Activity, label: t("admin.activeToday"), value: data.activeToday, tone: "text-emerald-500", bg: "bg-emerald-500/10" },
        { icon: AlertTriangle, label: t("admin.errorsCount"), value: data.errorCount, tone: "text-rose-500", bg: "bg-rose-500/10" },
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <ShieldCheck size={22} className="text-accent-500" />
            {t("admin.title")}
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t("admin.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={backendMode === "supabase" ? "emerald" : "zinc"}>
            {backendMode === "supabase" ? t("admin.backendSupabase") : t("admin.backendLocal")}
          </Badge>
          <Badge tone="accent">{t("admin.refresh")} · ۵s</Badge>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-3 p-3.5">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", s.bg, s.tone)}>
              <s.icon size={17} />
            </span>
            <div className="min-w-0">
              <p className="tnum truncate text-sm font-bold">{fmtNum(s.value, lang)}</p>
              <p className="truncate text-[10.5px] text-zinc-500 dark:text-zinc-400">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* signups chart */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-bold">{t("admin.signups14")}</h2>
        <div className="flex h-24 items-end gap-1">
          {(data?.signups14 ?? []).map((b, i) => (
            <div key={b.day} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-full rounded-t-md transition-all duration-300",
                  b.count === 0 ? "bg-zinc-500/15 dark:bg-white/[0.07]" : "bg-accent-500/70",
                  i === 13 && b.count > 0 && "bg-accent-600",
                )}
                style={{ height: `${Math.max(b.count === 0 ? 5 : 14, (b.count / maxBucket) * 100)}%` }}
                title={`${fmtDate(b.day, lang, { day: "numeric", month: "short" })}: ${fmtNum(b.count, lang)}`}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          {(data?.signups14 ?? []).map((b, i) => (
            <div key={b.day} className="flex-1 text-center text-[8.5px] text-zinc-400">
              {i % 3 === 1 || i === 13 ? fmtDate(b.day, lang, { day: "numeric" }) : ""}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        {/* users table */}
        <Card className="overflow-hidden">
          <div className="border-b border-zinc-200/70 px-5 py-4 dark:border-white/[0.06]">
            <h2 className="text-sm font-bold">{t("admin.usersList")}</h2>
            {data?.backendNote && (
              <p className="mt-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[10.5px] text-amber-600 dark:text-amber-400">
                {data.backendNote}
              </p>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto scroll-thin">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-5 py-2.5 text-[10px] font-semibold text-zinc-400 uppercase">
              <span>{t("admin.email")}</span>
              <span>{t("admin.signedUp")}</span>
              <span>{t("admin.lastLogin")}</span>
            </div>
            {(data?.users ?? []).length === 0 && (
              <p className="px-5 py-6 text-center text-xs text-zinc-400">{fmtNum(0, lang)}</p>
            )}
            {(data?.users ?? []).slice(0, 50).map((u) => (
              <div
                key={u.email}
                className="grid grid-cols-[1fr_auto_auto] gap-3 border-t border-zinc-200/50 px-5 py-2.5 dark:border-white/[0.04]"
              >
                <span className="truncate text-xs font-medium" dir="ltr">
                  {u.email}
                </span>
                <span className="tnum whitespace-nowrap text-[11px] text-zinc-500">
                  {fmtDate(u.createdAt.slice(0, 10), lang, { day: "numeric", month: "short" })}
                </span>
                <span className="tnum whitespace-nowrap text-[11px] text-zinc-500">
                  {u.lastLoginAt
                    ? fmtDate(u.lastLoginAt.slice(0, 10), lang, { day: "numeric", month: "short" })
                    : t("admin.never")}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* issues table */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200/70 px-5 py-4 dark:border-white/[0.06]">
            <h2 className="text-sm font-bold">{t("admin.recentIssues")}</h2>
            <IconButton
              label={t("admin.clear")}
              className="h-8 w-8 text-zinc-400 hover:text-rose-500"
              onClick={() => {
                clearLocalErrors();
                void load(true);
              }}
            >
              <Trash2 size={14} />
            </IconButton>
          </div>
          <div className="max-h-80 overflow-y-auto scroll-thin">
            {(data?.errors ?? []).length === 0 ? (
              <EmptyState icon={<ShieldCheck size={20} />} title={t("admin.noErrors")} />
            ) : (
              (data?.errors ?? []).map((e) => (
                <div key={e.id} className="border-t border-zinc-200/50 px-5 py-2.5 dark:border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Badge tone={e.source === "api" ? "rose" : "zinc"}>{e.source}</Badge>
                    {e.status && <Badge tone="amber">{fmtNum(e.status, lang)}</Badge>}
                    <span className="tnum text-[10px] text-zinc-400">
                      {fmtDate(new Date(e.ts).toISOString().slice(0, 10), lang, { day: "numeric", month: "short" })} · {fmtTime(e.ts, lang)}
                    </span>
                    {e.email && (
                      <span className="ms-auto truncate text-[10px] text-zinc-400" dir="ltr">
                        {e.email}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-zinc-700 dark:text-zinc-300" title={e.message} dir="ltr">
                    {e.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
