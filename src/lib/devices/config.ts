/** Құрылғы бақылауының ортақ баптаулары (Edge + Node + клиентсіз) */

export const DEVICE_COOKIE = "nep_did";
export const DEFAULT_DEVICE_LIMIT = 4;
export const HEARTBEAT_INTERVAL_MS = 60_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID_RE.test(value);
}

/** device_id cookie: JavaScript оқи алмайды (httpOnly), тек өз сайтымызға жіберіледі */
export function deviceCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400, // ~13 ай (браузерлердің ең жоғары шегі)
  };
}

/** MAX_DEVICES_PER_USER env айнымалысы (1–20) админ-панельдегі баптауды басып озады */
export function envDeviceLimit(raw = process.env.MAX_DEVICES_PER_USER): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 20 ? n : null;
}

/** JWT access token-нен session_id алу (token алдымен Supabase арқылы тексерілген болуы керек) */
export function sessionIdFromAccessToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="));
    const sid = (JSON.parse(json) as { session_id?: unknown }).session_id;
    return typeof sid === "string" && isUuid(sid) ? sid : null;
  } catch {
    return null;
  }
}

export type DeviceStatus = "ok" | "unregistered" | "revoked" | "blocked" | "mismatch" | "anonymous" | "limit_reached";

export const DEVICE_MESSAGES = {
  limit_reached: "Бұл аккаунтта рұқсат етілген құрылғылар саны толды. Аккаунт иесінен ескі құрылғылардың бірін өшіруді сұраңыз",
  device_revoked: "Бұл құрылғы аккаунттан шығарылды. Қайта кіріңіз",
  blocked: "Аккаунт бұғатталған. Әкімшімен байланысыңыз",
  session: "Сессия жарамсыз болды. Қайта кіріңіз",
} as const;

export type DeviceLoginError = keyof typeof DEVICE_MESSAGES;

/** Тексеру нәтижесі → login бетіндегі хабарлама коды */
export function loginErrorForStatus(status: string): DeviceLoginError {
  if (status === "limit_reached") return "limit_reached";
  if (status === "blocked") return "blocked";
  if (status === "revoked" || status === "mismatch") return "device_revoked";
  return "session";
}
