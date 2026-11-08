import Link from "next/link";
import { CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StreakDayState, StreakResult } from "@/lib/streak";

/** Төрт сәулелі жұлдыз (алтын) */
function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 1.5c.6 4.9 2.6 8.9 10.5 10.5-7.9 1.6-9.9 5.6-10.5 10.5C11.4 17.6 9.4 13.6 1.5 12 9.4 10.4 11.4 6.4 12 1.5Z" fill="currentColor" />
    </svg>
  );
}

/** Нептун планетасы (CSS): көгілдір шар, атмосфера жолақтары, көлеңке және сақина */
function NeptunePlanet({ className }: { className?: string }) {
  return (
    <div className={cn("relative aspect-square", className)} aria-hidden>
      <div className="absolute inset-[-12%] rounded-full bg-[radial-gradient(circle,rgb(79_220_251/0.45),transparent_65%)] blur-xl" />
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full overflow-visible">
        <ellipse cx="100" cy="104" rx="118" ry="26" transform="rotate(-18 100 104)" fill="none" stroke="#85eaff" strokeOpacity="0.35" strokeWidth="5" />
      </svg>
      <div
        className="absolute inset-[8%] rounded-full shadow-[inset_-18px_-14px_36px_rgb(5_10_31/0.85),inset_10px_8px_24px_rgb(184_243_255/0.35),0_0_40px_rgb(79_220_251/0.45)]"
        style={{
          background:
            "repeating-linear-gradient(168deg, rgb(255 255 255 / 0.07) 0 6%, transparent 6% 13%), radial-gradient(circle at 34% 30%, #b8f3ff 0%, #4fdcfb 22%, #2f6bf0 55%, #131d52 100%)",
        }}
      >
        {/* Ұлы қара дақ (Нептунның дауылы) */}
        <span className="absolute top-[56%] left-[28%] h-[10%] w-[22%] rounded-full bg-navy-900/45 blur-[2px]" />
      </div>
      {/* Сақинаның алдыңғы бөлігі планетаның үстінен өтеді */}
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full overflow-visible">
        <path d="M -12.2 140.5 A 118 26 -18 0 0 212.2 67.5" fill="none" stroke="#b8f3ff" strokeOpacity="0.75" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

const TILE: Record<StreakDayState, string> = {
  done: "bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-[0_0_18px_rgb(251_191_36/0.55)]",
  pending: "border-2 border-amber-300 bg-amber-300/10 text-amber-300 animate-pulse",
  missed: "border border-red-400/30 bg-red-500/10 text-red-300/50",
  rest: "border border-white/15 bg-white/5 text-white/35",
  future: "border border-white/5 bg-white/[0.02] text-white/15",
};

const TILE_TITLE: Record<StreakDayState, string> = {
  done: "Орындалды",
  pending: "Бүгін: жаңа нұсқаны 00:00-ге дейін орындаңыз",
  missed: "Өткізіп алды — жұлдыз сөнді",
  rest: "Демалыс",
  future: "Алда",
};

/**
 * «Менің Жұлдызым»: жаңа нұсқа шыққан күні (дс, сс, ср, жм, сб) 00:00-ге дейін орындаса — жұлдыз өседі,
 * бейсенбі мен жексенбі (демалыс) сақталады, өткізіп алса — сөнеді. Барлық есеп серверде (computeStreak).
 */
export function StarStreak({ streak }: { streak: StreakResult }) {
  const { count, week, today } = streak;

  return (
    <section className="space-bg relative isolate overflow-hidden rounded-3xl ring-1 ring-white/10" aria-labelledby="star-streak-title">
      <div className="stars stars-drift" aria-hidden />

      <div className="relative p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <h2 id="star-streak-title" className="text-xl font-extrabold text-white sm:text-2xl">
            Менің Жұлдызым
          </h2>
          <details className="group relative">
            <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-full border border-white/20 text-white/80 transition hover:bg-white/10 [&::-webkit-details-marker]:hidden" aria-label="Ереже">
              <Info className="size-4.5" />
            </summary>
            <div className="absolute top-11 right-0 z-20 w-72 rounded-2xl border border-white/10 bg-space-950/95 p-4 text-sm leading-relaxed text-white/80 shadow-glow backdrop-blur">
              <p>
                <b className="text-white">Дс, сс, ср, жм, сб</b> — жаңа нұсқа шығады. Сол күні 00:00-ге дейін орындасаң — жұлдызың <b className="text-amber-300">+1</b> өседі.
              </p>
              <p className="mt-2">
                <b className="text-white">Бейсенбі мен жексенбі</b> — демалыс: жаңа нұсқа жоқ, жұлдыз сақталады.
              </p>
              <p className="mt-2">Жаңа нұсқаны сол күні орындамасаң — жұлдыз сөнеді.</p>
            </div>
          </details>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <StarIcon className={cn("size-12 sm:size-14", count > 0 ? "text-amber-300 drop-shadow-[0_0_14px_rgb(251_191_36/0.7)]" : "text-white/25")} />
              <span className="font-display text-6xl leading-none font-extrabold text-white sm:text-7xl">{count}</span>
            </div>
            <p className="mt-3 text-base font-semibold text-neptune-200 sm:text-lg">күн қатарынан</p>
            <p className="font-semibold text-white">{count > 0 ? "Жұлдызың сөнбесін!" : "Жаңа нұсқаны орындап, жұлдызыңды жақ!"}</p>
          </div>
          <NeptunePlanet className="w-28 shrink-0 sm:w-36" />
        </div>

        {/* Апта: дс … жс */}
        <ol className="mt-7 grid grid-cols-7 gap-1.5 sm:gap-2.5" aria-label="Осы апта">
          {week.map((d) => (
            <li key={d.day} className="flex flex-col items-center gap-1.5">
              <span className={cn("text-xs font-semibold", d.isToday ? "text-neptune-300" : "text-white/55")}>{d.label}</span>
              <span className={cn("grid aspect-square w-full max-w-12 place-items-center rounded-xl transition", TILE[d.state], d.isToday && "ring-2 ring-neptune-400/60 ring-offset-2 ring-offset-space-950")} title={TILE_TITLE[d.state]}>
                <StarIcon className="size-1/2" />
              </span>
            </li>
          ))}
        </ol>

        {/* Бүгінгі мақсат */}
        <div className="glass-dark mt-6 rounded-2xl p-4">
          {today.kind === "rest" ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-white">Бүгін — демалыс күні</span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white/70">Демалыс</span>
              </div>
              <p className="mt-1 text-sm text-white/65">Бейсенбі мен жексенбі жаңа нұсқа шықпайды — жұлдызың сақталды. Қаласаң, кез келген нұсқаны қайталап шығуға болады.</p>
            </>
          ) : today.kind === "waiting" ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-white">Бүгінгі нұсқа әлі шыққан жоқ</span>
                <span className="rounded-full bg-neptune-400/15 px-2.5 py-0.5 text-xs font-semibold text-neptune-200">Күтуде</span>
              </div>
              <p className="mt-1 text-sm text-white/65">Жаңа нұсқа таңғы 5-те шығады. Шыққан соң 00:00-ге дейін орында — жұлдызың өседі.</p>
            </>
          ) : today.done ? (
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-bold text-white">
                <CheckCircle2 className="size-5 text-emerald-400" /> Бүгінгі мақсат орындалды
              </span>
              <span className="rounded-full bg-amber-300/15 px-3 py-1 font-display text-sm font-extrabold text-amber-300">+1</span>
            </div>
          ) : (
            <>
              <p className="font-bold text-white">Бүгін жаңа нұсқа шықты!</p>
              <p className="mt-1 text-sm text-white/65">00:00-ге дейін орында — жұлдызың өседі. Әйтпесе жұлдыз сөнеді.</p>
              <ul className="mt-3 space-y-2">
                {today.variants.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/courses/${v.courseSlug}`}
                      className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-brand-500 to-neptune-500 px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 active:scale-[0.98]"
                    >
                      <span className="truncate">
                        НҰСҚА {v.position}. {v.title}
                      </span>
                      <span className="shrink-0">Орындау →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
