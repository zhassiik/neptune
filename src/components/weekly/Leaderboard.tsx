import Link from "next/link";
import { Crown, Medal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPoints } from "@/lib/weekly";
import type { ContestWeek, LeaderboardRow } from "@/lib/types";

const PLACE_STYLES = [
  "bg-gradient-to-br from-amber-300 to-amber-500 text-white",
  "bg-gradient-to-br from-slate-300 to-slate-400 text-white",
  "bg-gradient-to-br from-orange-300 to-orange-500 text-white",
];

/**
 * «Апта үздігі» топ-5 + оқушының өз орны.
 * weekHref берілсе — апталар арасында ауысу (курс беті).
 */
export function Leaderboard({
  weeks,
  activeWeekId,
  rows,
  weekHref,
  footer,
}: {
  weeks: ContestWeek[];
  activeWeekId: string;
  rows: LeaderboardRow[];
  weekHref?: (weekId: string) => string;
  footer?: React.ReactNode;
}) {
  const top = rows.filter((r) => r.rank <= 5);
  const me = rows.find((r) => r.is_me);
  const meOutside = me && me.rank > 5;
  const week = weeks.find((w) => w.id === activeWeekId);

  return (
    <section className="card overflow-hidden">
      <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-brand-700 px-5 py-5 text-white sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-white">
            <Trophy className="size-6 text-amber-300" /> Апта үздігі
          </h2>
          {weekHref && weeks.length > 1 ? (
            <nav className="flex gap-1.5 overflow-x-auto" aria-label="Апталар">
              {weeks.map((w) => (
                <Link
                  key={w.id}
                  href={weekHref(w.id)}
                  scroll={false}
                  className={cn("shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition", w.id === activeWeekId ? "bg-white text-navy-900" : "bg-white/10 text-white hover:bg-white/20")}
                >
                  {w.title}
                </Link>
              ))}
            </nav>
          ) : (
            week && <span className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold">{week.title}</span>
          )}
        </div>
        <p className="mt-1 text-sm text-white/70">Куратор ашқан уақытта тапсырылған нұсқа балы + черновик (+5) + конспект (+10)</p>
      </div>

      {top.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500 sm:px-7">Әзірге нәтиже жоқ. Нұсқа ашылған уақытта тапсырып, рейтингке бірінші болып кіріңіз!</p>
      ) : (
        <ol className="divide-y divide-slate-100">
          {top.map((r) => (
            <Row key={`${r.rank}-${r.full_name}`} r={r} />
          ))}
          {meOutside && (
            <>
              <li className="px-5 py-1 text-center text-xs text-slate-400 sm:px-7" aria-hidden>
                ⋯
              </li>
              <Row r={me} />
            </>
          )}
        </ol>
      )}
      {footer && <div className="border-t border-slate-100 px-5 py-3 sm:px-7">{footer}</div>}
    </section>
  );
}

function Row({ r }: { r: LeaderboardRow }) {
  return (
    <li className={cn("flex items-center gap-3 px-5 py-3 sm:px-7", r.is_me && "bg-brand-50/70")}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full font-display text-sm font-extrabold", PLACE_STYLES[r.rank - 1] ?? "bg-slate-100 text-slate-600")}>
        {r.rank === 1 ? <Crown className="size-4.5" /> : r.rank <= 3 ? <Medal className="size-4.5" /> : r.rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-navy-900">
          {r.full_name}
          {r.is_me && <span className="ml-2 rounded-full bg-brand-500 px-2 py-0.5 text-xs font-semibold text-white">Сіз</span>}
        </div>
        <div className="text-xs text-slate-500">
          Тест: {r.test_points} ({r.contest_tests} нұсқа) · Черновик/конспект: +{formatPoints(r.homework_points)}
        </div>
      </div>
      <div className="text-right">
        <div className="font-display text-xl font-extrabold text-navy-900">{formatPoints(r.total)}</div>
        <div className="text-xs text-slate-400">{r.rank}-орын</div>
      </div>
    </li>
  );
}
