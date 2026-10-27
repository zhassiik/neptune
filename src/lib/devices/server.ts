import "server-only";
import { cookies, headers } from "next/headers";
import { DEVICE_COOKIE, DEVICE_MESSAGES, deviceCookieOptions, isUuid, loginErrorForStatus, sessionIdFromAccessToken } from "./config";
import { deviceServiceClient, registerDevice, revokeSessions } from "./register";

export type AttachResult = { ok: true; isNew: boolean } | { ok: false; message: string };

/**
 * Жаңа сессияны (login / тіркелу / email растау) осы браузердің device_id-іне байлау.
 * access token Supabase-тен жаңа ғана алынған болуы керек.
 */
export async function attachDeviceToSession(userId: string, accessToken: string | undefined): Promise<AttachResult> {
  const sessionId = sessionIdFromAccessToken(accessToken);
  if (!sessionId) return { ok: false, message: "Сессияны тіркеу мүмкін болмады. Қайта кіріп көріңіз" };

  const store = await cookies();
  let deviceId = store.get(DEVICE_COOKIE)?.value;
  if (!isUuid(deviceId)) {
    deviceId = crypto.randomUUID();
    store.set(DEVICE_COOKIE, deviceId, deviceCookieOptions());
  }

  const reg = await registerDevice({ userId, sessionId, deviceId, headers: await headers() });
  if (reg.status === "ok") return { ok: true, isNew: !!reg.isNew };
  if (reg.status === "error") {
    // Migration әлі іске қосылмаған болса — бұрынғыдай кіргіземіз
    if (reg.notMigrated) return { ok: true, isNew: false };
    return { ok: false, message: "Сервер баптауында қате бар. Кейінірек қайталаңыз" };
  }
  return { ok: false, message: DEVICE_MESSAGES[loginErrorForStatus(reg.status)] };
}

/** Шығу кезінде: осы құрылғының орнын босату */
export async function releaseCurrentDevice(userId: string, sessionId: string | null) {
  if (!sessionId) return;
  const sb = deviceServiceClient();
  if (!sb) return;
  const { data } = await sb.from("user_devices").select("id").eq("user_id", userId).eq("session_id", sessionId).maybeSingle();
  if (data?.id) await revokeSessions(userId, { deviceRowId: data.id, reason: "signout" }).catch(() => null);
}

/** Құрылғы лимиті: env (MAX_DEVICES_PER_USER) → админ-панель баптауы → 4 */
export async function getDeviceLimit(): Promise<{ limit: number; fromEnv: boolean }> {
  const { envDeviceLimit, DEFAULT_DEVICE_LIMIT } = await import("./config");
  const env = envDeviceLimit();
  if (env) return { limit: env, fromEnv: true };
  const sb = deviceServiceClient();
  const { data } = sb ? await sb.from("platform_settings").select("max_devices_per_user").eq("id", 1).maybeSingle() : { data: null };
  return { limit: (data?.max_devices_per_user as number | undefined) ?? DEFAULT_DEVICE_LIMIT, fromEnv: false };
}

export async function currentDeviceId() {
  const v = (await cookies()).get(DEVICE_COOKIE)?.value;
  return isUuid(v) ? v : null;
}
