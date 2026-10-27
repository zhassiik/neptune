"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin, getCurrentSessionId, getCurrentUser } from "@/lib/auth";
import { deviceServiceClient, revokeSessions } from "./register";
import { currentDeviceId } from "./server";

export interface DeviceActionResult {
  ok?: boolean;
  error?: string;
  message?: string;
}

const uuid = z.string().uuid();

function fail(e: unknown): DeviceActionResult {
  console.error("[devices]", e instanceof Error ? e.message : e);
  return { error: "Әрекетті орындау мүмкін болмады. Қайталап көріңіз" };
}

/** Оқушы: өз құрылғыларының бірін шығару (осы құрылғыдан басқа) */
export async function revokeMyDevice(deviceRowId: string): Promise<DeviceActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Сессия жарамсыз. Қайта кіріңіз" };
  if (!uuid.safeParse(deviceRowId).success) return { error: "Құрылғы табылмады" };

  const sb = deviceServiceClient();
  if (!sb) return { error: "Сервер баптауында қате бар" };
  const { data: row } = await sb.from("user_devices").select("id, device_id, is_active").eq("id", deviceRowId).eq("user_id", user.id).maybeSingle();
  if (!row || !row.is_active) return { error: "Құрылғы табылмады немесе бұрын шығарылған" };
  if (row.device_id === (await currentDeviceId())) return { error: "Осы құрылғыдан шығу үшін «Шығу» батырмасын басыңыз" };

  try {
    await revokeSessions(user.id, { deviceRowId, reason: "user" });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/cabinet/devices");
  return { ok: true, message: "Құрылғы аккаунттан шығарылды" };
}

/** Оқушы: осы құрылғыдан басқа барлық құрылғылардан шығу */
export async function revokeOtherDevices(): Promise<DeviceActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Сессия жарамсыз. Қайта кіріңіз" };
  const sessionId = await getCurrentSessionId();
  if (!sessionId) return { error: "Ағымдағы сессияны анықтау мүмкін болмады" };
  try {
    const r = await revokeSessions(user.id, { keepSessionId: sessionId, reason: "others" });
    revalidatePath("/cabinet/devices");
    return { ok: true, message: r?.revoked_devices ? `${r.revoked_devices} құрылғы шығарылды` : "Басқа белсенді құрылғы жоқ" };
  } catch (e) {
    return fail(e);
  }
}

/* --------------------------------- Admin --------------------------------- */

export async function adminRevokeDevice(userId: string, deviceRowId: string): Promise<DeviceActionResult> {
  await assertAdmin();
  if (!uuid.safeParse(userId).success || !uuid.safeParse(deviceRowId).success) return { error: "Деректер дұрыс емес" };
  try {
    await revokeSessions(userId, { deviceRowId, reason: "admin" });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/admin/students/${userId}`);
  return { ok: true, message: "Құрылғы өшірілді" };
}

export async function adminRevokeAllSessions(userId: string): Promise<DeviceActionResult> {
  const admin = await assertAdmin();
  if (!uuid.safeParse(userId).success) return { error: "Деректер дұрыс емес" };
  const keep = userId === admin.id ? await getCurrentSessionId() : null;
  try {
    const r = await revokeSessions(userId, { keepSessionId: keep, reason: "admin_all" });
    revalidatePath(`/admin/students/${userId}`);
    return { ok: true, message: `Барлық сессия тоқтатылды (${r?.sessions ?? 0})` };
  } catch (e) {
    return fail(e);
  }
}

export async function adminSetBlocked(userId: string, blocked: boolean): Promise<DeviceActionResult> {
  const admin = await assertAdmin();
  if (!uuid.safeParse(userId).success) return { error: "Деректер дұрыс емес" };
  if (userId === admin.id) return { error: "Өз аккаунтыңызды бұғаттай алмайсыз" };
  const sb = deviceServiceClient();
  if (!sb) return { error: "Сервер баптауында қате бар" };
  const { error } = await sb.from("profiles").update({ blocked_at: blocked ? new Date().toISOString() : null }).eq("id", userId);
  if (error) return fail(error);
  if (blocked) {
    try {
      await revokeSessions(userId, { reason: "blocked" });
    } catch (e) {
      return fail(e);
    }
  }
  revalidatePath(`/admin/students/${userId}`);
  revalidatePath("/admin/students");
  return { ok: true, message: blocked ? "Аккаунт бұғатталды, барлық сессиясы тоқтатылды" : "Аккаунт бұғаттан шығарылды" };
}
