import { addDaysISO, fmtDate, todayISO, weekStartISO, type Lang } from "../lib/dates";
import { cn, hexWithAlpha } from "../lib/utils";

export function Heatmap({
  days,
  lang,
  color = "#6366f1",
  weeks = 24,
}: {
  days: string[];
  lang: Lang;
  color?: string;
  weeks?: number;
}) {
  const today = todayISO();
  const start = addDaysISO(weekStartISO(today, lang), -(weeks - 1) * 7);
  const count = new Map<string, number>();
  for (const d of days) count.set(d, (count.get(d) ?? 0) + 1);

  const columns: string[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: string[] = [];
    for (let d = 0; d < 7; d++) col.push(addDaysISO(start, w * 7 + d));
    columns.push(col);
  }

  return (
    <div className="scroll-none overflow-x-auto">
      <div className="flex w-max gap-[3px]">
        {columns.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-[3px]">
            {col.map((iso) => {
              if (iso > today)
                return <div key={iso} className="h-[11px] w-[11px] rounded-[3px] opacity-0" />;
              const n = count.get(iso) ?? 0;
              return (
                <div
                  key={iso}
                  title={fmtDate(iso, lang, { day: "numeric", month: "long", year: "numeric" })}
                  className={cn(
                    "h-[11px] w-[11px] rounded-[3px] transition-transform duration-150 hover:scale-125",
                    n === 0 && "bg-zinc-500/12 dark:bg-white/[0.06]",
                    iso === today && n === 0 && "ring-1 ring-accent-400/60",
                  )}
                  style={
                    n > 0
                      ? {
                          backgroundColor: hexWithAlpha(
                            color,
                            n === 1 ? 0.4 : n === 2 ? 0.65 : 0.9,
                          ),
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
