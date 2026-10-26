import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

const dateFmt = new Intl.DateTimeFormat("kk-KZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Almaty",
});

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return dateFmt.format(new Date(value));
}

export function formatDuration(fromIso: string, toIso: string | null) {
  if (!toIso) return "—";
  const minutes = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} мин`;
  return `${Math.floor(minutes / 60)} сағ ${minutes % 60} мин`;
}

export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function percent(score: number | null, max: number) {
  if (score == null || max === 0) return 0;
  return Math.round((score / max) * 100);
}

/** Supabase/Postgres қателерін қазақша түсінікті мәтінге айналдырады */
export function humanizeError(error: unknown): string {
  const message =
    typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error);
  if (/Invalid login credentials/i.test(message)) return "Email немесе құпиясөз қате";
  if (/Email not confirmed/i.test(message)) return "Email расталмаған. Поштаңызға келген хатты ашыңыз";
  if (/User already registered/i.test(message)) return "Бұл email бұрын тіркелген";
  if (/Password should be at least/i.test(message)) return "Құпиясөз тым қысқа";
  if (/rate limit/i.test(message)) return "Тым көп сұраныс. Біраз уақыттан кейін қайталаңыз";
  if (/Failed to fetch|NetworkError|fetch failed/i.test(message)) return "Интернет байланысы жоқ немесе сервер қолжетімсіз";
  if (/row-level security|permission denied|42501/i.test(message)) return "Бұл әрекетке рұқсат жоқ";
  if (/column .* does not exist|Could not find the '.*' column|schema cache/i.test(message)) {
    return "Деректер базасы жаңартылмаған: Supabase SQL Editor-да supabase/migrations ішіндегі соңғы migration-ды іске қосыңыз";
  }
  return message || "Белгісіз қате";
}

/**
 * UUID v4. crypto.randomUUID тек HTTPS/localhost-та бар — сайт желі IP-і арқылы
 * (мысалы, http://192.168.x.x) ашылғанда getRandomValues-қа түседі.
 */
export function uuid(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
