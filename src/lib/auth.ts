import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DEVICE_COOKIE, isUuid } from "@/lib/devices/config";
import { isMissingObject } from "@/lib/devices/register";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Profile } from "@/lib/types";

/**
 * Ағымдағы пайдаланушы және профиль (бір request ішінде кэштеледі).
 * Құрылғы бақылауы: сессия белсенді, бұғатталмаған құрылғыға тіркелмеген болса — null
 * (яғни барлық қорғалған бет, API және server action үшін «кірмеген» болып саналады).
 */
export const getCurrentUser = cache(async (): Promise<{ id: string; email: string | undefined; profile: Profile | null } | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const status = await checkDeviceSession(supabase);
  if (status !== "ok" && status !== "not_migrated") return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return { id: user.id, email: user.email, profile: profile ?? null };
});

async function checkDeviceSession(supabase: Awaited<ReturnType<typeof createClient>>) {
  const raw = (await cookies()).get(DEVICE_COOKIE)?.value;
  const deviceId = isUuid(raw) ? raw : null;
  const { data, error } = await supabase.rpc("check_device_session", { p_device_id: deviceId });
  if (error) {
    if (isMissingObject(error)) return "not_migrated";
    console.error("[devices] check_device_session:", error.message);
    return "error";
  }
  // device_id cookie жоқ болса — сессия басқа браузерге көшірілген болуы мүмкін: рұқсат бермейміз
  if (!deviceId) return "mismatch";
  return data as string;
}

/** Ағымдағы Supabase сессиясының ID-і (JWT session_id, қолтаңбасы тексерілген) */
export async function getCurrentSessionId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sid = data?.claims?.session_id;
  return typeof sid === "string" && isUuid(sid) ? sid : null;
}

export async function requireUser(next?: string) {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (user.profile?.role !== "admin") redirect("/?error=forbidden");
  return user;
}

/** Server action ішінде: redirect орнына қате қайтару үшін */
export async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user || user.profile?.role !== "admin") {
    throw new Error("Бұл әрекетке тек әкімшінің рұқсаты бар");
  }
  return user;
}
