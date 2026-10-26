import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Profile } from "@/lib/types";

/** Ағымдағы пайдаланушы және профиль (бір request ішінде кэштеледі). */
export const getCurrentUser = cache(async (): Promise<{ id: string; email: string | undefined; profile: Profile | null } | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return { id: user.id, email: user.email, profile: profile ?? null };
});

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
