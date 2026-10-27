/**
 * Құрылғыны тіркеу/өшіру — service_role арқылы (тек серверде: middleware, server action, route handler).
 * Edge runtime-та да жұмыс істейді. Клиент кодына импорттамаңыз.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { envDeviceLimit } from "./config";
import { clientIpFromHeaders, locationFromHeaders } from "./network";
import { parseUserAgent } from "./ua";

export type RegisterStatus = "ok" | "limit_reached" | "blocked" | "revoked" | "mismatch" | "error";

export interface RegisterResult {
  status: RegisterStatus;
  isNew?: boolean;
  activeCount?: number;
  deviceLimit?: number;
  /** migration әлі іске қосылмаған (функция жоқ) */
  notMigrated?: boolean;
}

let cached: SupabaseClient | null = null;

export function deviceServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key.length < 30) return null;
  cached ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

/** PostgREST: функция/кесте жоқ — migration іске қосылмаған */
export function isMissingObject(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "PGRST202" || error.code === "42883" || error.code === "42P01" || /does not exist|Could not find the function/i.test(error.message ?? "");
}

export async function registerDevice({
  userId,
  sessionId,
  deviceId,
  headers,
}: {
  userId: string;
  sessionId: string;
  deviceId: string;
  headers: Headers;
}): Promise<RegisterResult> {
  const sb = deviceServiceClient();
  if (!sb) return { status: "error" };
  const info = parseUserAgent(headers.get("user-agent"));
  const { data, error } = await sb.rpc("register_device", {
    p_user: userId,
    p_device: deviceId,
    p_session: sessionId,
    p_device_name: info.deviceName,
    p_browser: info.browser,
    p_os: info.os,
    p_ip: clientIpFromHeaders(headers),
    p_location: locationFromHeaders(headers),
    p_limit_override: envDeviceLimit(),
  });
  if (error) {
    console.error("[devices] register_device:", error.message);
    return { status: "error", notMigrated: isMissingObject(error) };
  }
  const r = data as { status: RegisterStatus; is_new?: boolean; active_count?: number; device_limit?: number };
  return { status: r.status, isNew: r.is_new, activeCount: r.active_count, deviceLimit: r.device_limit };
}

/** Құрылғыларды/сессияларды өшіру (бір құрылғы, басқалары немесе барлығы) */
export async function revokeSessions(
  userId: string,
  opts: { deviceRowId?: string | null; keepSessionId?: string | null; reason: "user" | "others" | "signout" | "admin" | "admin_all" | "blocked" },
) {
  const sb = deviceServiceClient();
  if (!sb) throw new Error("Сервер баптауында қате бар");
  const { data, error } = await sb.rpc("revoke_user_sessions", {
    p_user: userId,
    p_device_row: opts.deviceRowId ?? null,
    p_keep_session: opts.keepSessionId ?? null,
    p_reason: opts.reason,
  });
  if (error) {
    if (isMissingObject(error)) return null;
    throw new Error(error.message);
  }
  return data as { revoked_devices: number; sessions: number; auth_sessions_deleted: boolean };
}
