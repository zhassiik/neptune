/**
 * «Менің Жұлдызым» — күнделікті серия (streak). Таза функциялар, уақыт белдеуі — Asia/Almaty (UTC+5, жазғы уақыт жоқ).
 *
 * Ереже:
 *  - Тапсырма күні = оқушыға қолжетімді курста жаңа нұсқа жарияланған күн.
 *    Сол күні 00:00-ге дейін сол күнгі жаңа нұсқалардың кем дегенде біреуін тапсырса — жұлдыз +1.
 *    Тапсырмаса — күн біткенде серия үзіледі (жұлдыз сөнеді).
 *  - Демалыс күні (жаңа нұсқа жоқ) — серия сақталады (өспейді де, үзілмейді де).
 *    Сол күні кез келген нұсқа тапсырса — күн «жанып» тұрады.
 *  - Бүгінгі тапсырма күні әлі біткен жоқ: орындалмаса да серия үзілмейді (күтуде).
 */

const DAY_MS = 24 * 3600_000;
const ALMATY_OFFSET_MS = 5 * 3600_000;

/** ISO уақыт → Алматы күні «YYYY-MM-DD» */
export function almatyDay(iso: string | number | Date) {
  return new Date(new Date(iso).getTime() + ALMATY_OFFSET_MS).toISOString().slice(0, 10);
}

function shiftDay(day: string, delta: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);
}

/** Дүйсенбі = 0 … Жексенбі = 6 */
function weekdayIndex(day: string) {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export type StreakDayState = "done" | "missed" | "pending" | "rest" | "future";

export interface StreakVariant {
  id: string;
  title: string;
  position: number;
  courseSlug: string;
  publishedAt: string;
}

export interface StreakInput {
  now: Date | string | number;
  /** Оқушы тіркелген уақыт: бұған дейінгі күндер серияны үзбейді */
  signupAt: string;
  /** Оқушыға қолжетімді жарияланған нұсқалар */
  variants: StreakVariant[];
  /** Оқушының тапсырған талпыныстары */
  submissions: { variantId: string; submittedAt: string }[];
}

export interface StreakResult {
  count: number;
  week: { day: string; label: string; state: StreakDayState; isToday: boolean }[];
  today: { kind: "task" | "rest"; done: boolean; variants: StreakVariant[] };
}

export const WEEKDAY_LABELS = ["дс", "сс", "ср", "бс", "жм", "сб", "жс"];

/** Бір күннің күйі (серия есебі үшін) */
function dayStatus(
  day: string,
  today: string,
  tasks: Map<string, StreakVariant[]>,
  doneByDay: Map<string, Set<string>>,
): StreakDayState {
  if (day > today) return "future";
  const newOnes = tasks.get(day);
  const done = doneByDay.get(day);
  if (newOnes?.length) {
    if (newOnes.some((v) => done?.has(v.id))) return "done";
    return day === today ? "pending" : "missed";
  }
  return done?.size ? "done" : "rest";
}

export function computeStreak(input: StreakInput): StreakResult {
  const today = almatyDay(input.now);
  const signupDay = almatyDay(input.signupAt);

  const tasks = new Map<string, StreakVariant[]>();
  for (const v of input.variants) {
    const day = almatyDay(v.publishedAt);
    tasks.set(day, [...(tasks.get(day) ?? []), v]);
  }
  // Тек сол күні (00:00-ге дейін) тапсырылғандар сол күнге саналады
  const doneByDay = new Map<string, Set<string>>();
  for (const s of input.submissions) {
    const day = almatyDay(s.submittedAt);
    if (!doneByDay.has(day)) doneByDay.set(day, new Set());
    doneByDay.get(day)!.add(s.variantId);
  }

  // Серия: бүгіннен артқа қарай, тіркелген күнге дейін
  let count = 0;
  for (let day = today, guard = 0; day >= signupDay && guard < 400; day = shiftDay(day, -1), guard++) {
    if (!tasks.get(day)?.length) continue; // демалыс — серия сақталады
    const state = dayStatus(day, today, tasks, doneByDay);
    if (state === "done") count++;
    else if (state === "missed") break;
    // pending (бүгін) — әлі уақыт бар
  }

  const monday = shiftDay(today, -weekdayIndex(today));
  const week = WEEKDAY_LABELS.map((label, i) => {
    const day = shiftDay(monday, i);
    const state: StreakDayState = day < signupDay ? (day > today ? "future" : "rest") : dayStatus(day, today, tasks, doneByDay);
    return { day, label, state, isToday: day === today };
  });

  const todayTasks = tasks.get(today) ?? [];
  const todayState = dayStatus(today, today, tasks, doneByDay);
  return {
    count,
    week,
    today: { kind: todayTasks.length ? "task" : "rest", done: todayState === "done", variants: todayTasks },
  };
}
