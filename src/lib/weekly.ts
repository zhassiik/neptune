/**
 * «Апта үздігі»: ортақ ережелер (сервер + клиент, таза функциялар).
 * Ұпай SQL-дегі homework_points() функциясымен бірдей болуы керек.
 */
import type { HomeworkStatus } from "@/lib/types";

export const HOMEWORK_FULL_POINTS = { draft: 5, notes: 10 } as const;

export const HOMEWORK_LABELS: Record<HomeworkStatus, string> = {
  on_time: "Уақытында салынды",
  late: "Кешікті",
  missing: "Салмады",
};

/** Черновик: уақытында 5, кешіксе 2.5; конспект: 10 / 5; салмаса 0 */
export function homeworkPoints(status: HomeworkStatus | null | undefined, kind: keyof typeof HOMEWORK_FULL_POINTS) {
  const full = HOMEWORK_FULL_POINTS[kind];
  if (status === "on_time") return full;
  if (status === "late") return full / 2;
  return 0;
}

/** 2.5 → «2,5»; 10 → «10» */
export function formatPoints(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

export type ContestPhase = "none" | "upcoming" | "live" | "ended";

export function contestPhase(startsAt: string | null | undefined, endsAt: string | null | undefined, now = Date.now()): ContestPhase {
  if (!startsAt || !endsAt) return "none";
  const s = new Date(startsAt).getTime();
  const e = new Date(endsAt).getTime();
  if (now < s) return "upcoming";
  if (now <= e) return "live";
  return "ended";
}

/** Алматы уақытындағы күн + сағат аралығы → ISO (UTC+5). «2026-11-03», «05:00», «06:30» */
export function almatyWindow(date: string, from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to)) return null;
  const starts = new Date(`${date}T${from}:00+05:00`);
  let ends = new Date(`${date}T${to}:00+05:00`);
  // Түн ортасынан асатын аралық (мысалы, 23:00–00:30)
  if (ends <= starts) ends = new Date(ends.getTime() + 24 * 3600_000);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) return null;
  return { startsAt: starts.toISOString(), endsAt: ends.toISOString() };
}

/** ISO → Алматы уақытындағы «HH:mm» */
export function almatyTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Almaty", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** ISO → Алматы уақытындағы «YYYY-MM-DD» */
export function almatyDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** «3 қараша, 05:00–06:30» */
export function formatWindow(startsAt: string, endsAt: string) {
  const day = new Intl.DateTimeFormat("kk-KZ", { timeZone: "Asia/Almaty", day: "numeric", month: "long" }).format(new Date(startsAt));
  return `${day}, ${almatyTime(startsAt)}–${almatyTime(endsAt)}`;
}
