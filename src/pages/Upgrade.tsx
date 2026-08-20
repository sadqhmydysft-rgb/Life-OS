import { useState } from "react";
import { CheckCircle2, Crown, Loader2 } from "lucide-react";
import { useApp } from "../lib/store";
import { useI18n } from "../lib/i18n";
import { supa } from "../lib/supabase";
import { Badge, Button, Card } from "../components/ui";

type Plan = "monthly" | "yearly" | "lifetime";

const PLANS: { id: Plan; price: string; note: string }[] = [
  { id: "monthly", price: "۴۹,۰۰۰ تومان / ماه", note: "هر وقت خواستی لغو کن" },
  { id: "yearly", price: "۴۹۰,۰۰۰ تومان / سال", note: "معادل ۲ ماه رایگان" },
  { id: "lifetime", price: "۶۹۰,۰۰۰ تومان", note: "پیشنهاد محدود لانچ — یک‌بار برای همیشه" },
];

export function UpgradePage() {
  const { user } = useApp();
  const { t } = useI18n();
  const [loading, setLoading] = useState<Plan | null>(null);
  const [error, setError] = useState("");

  const choose = async (plan: Plan) => {
    setError("");
    setLoading(plan);
    try {
      const session = await supa.getValidSession();
      if (!session) {
        setError("برای خرید اشتراک باید وارد حساب شوی.");
        return;
      }
      const r = await fetch("/api/payment/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan }),
      });
      const data = await r.json();
      if (!r.ok || !data.redirect) {
        setError(data.error ?? "خطا در اتصال به درگاه پرداخت");
        return;
      }
      window.location.assign(data.redirect);
    } catch (e: any) {
      setError(`خطا: ${e?.message ?? String(e)}`);
    } finally {
      setLoading(null);
    }
  };

  if (user?.is_premium) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-sm p-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 size={26} />
          </span>
          <h1 className="text-lg font-bold">{t("upgrade.alreadyTitle")}</h1>
          <p className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
            {t("upgrade.alreadySub")}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="text-center">
        <h1 className="flex items-center justify-center gap-2 text-xl font-bold tracking-tight">
          <Crown size={20} className="text-amber-500" />
          {t("upgrade.title")}
        </h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t("upgrade.sub")}</p>
      </div>

      {error && (
        <Card className="border-rose-500/30 bg-rose-500/5 p-4 text-center text-xs text-rose-500">
          {error}
        </Card>
      )}

      <div className="space-y-3">
        {PLANS.map((p) => (
          <Card key={p.id} className="flex items-center justify-between p-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{t(`upgrade.plan.${p.id}`)}</span>
                {p.id === "lifetime" && <Badge tone="amber">لانچ</Badge>}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{p.price}</div>
              <div className="mt-0.5 text-[11px] text-zinc-400">{p.note}</div>
            </div>
            <Button onClick={() => choose(p.id)} disabled={loading !== null}>
              {loading === p.id ? <Loader2 size={15} className="animate-spin" /> : t("upgrade.pay")}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}