"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient, ServerConfigError } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCourseAccess } from "@/lib/access";
import { formatDateTime } from "@/lib/utils";

export interface StartState {
  error?: string;
}

/**
 * Тестті бастау немесе қайта тапсыру.
 * Белсенді талпыныс болса — соған қайтарады, әйтпесе жаңасын құрады.
 */
export async function startAttempt(_prev: StartState, formData: FormData): Promise<StartState> {
  const variantId = z.string().uuid().safeParse(formData.get("variantId"));
  if (!variantId.success) return { error: "Нұсқа табылмады" };

  const returnTo = String(formData.get("returnTo") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(/^\/courses\/[a-z0-9-]+$/.test(returnTo) ? returnTo : "/courses")}`);

  // RLS арқылы тексеру: оқушы тек жарияланған нұсқаны көреді
  const supabase = await createClient();
  // courses(*) — access_mode бағаны әлі жоқ болса да (migration іске қосылмаса) сұраныс бұзылмайды
  const { data: variant, error: variantError } = await supabase
    .from("test_variants")
    .select("*, courses(*)")
    .eq("id", variantId.data)
    .maybeSingle<{
      id: string;
      status: string;
      time_limit_minutes: number | null;
      contest_starts_at?: string | null;
      courses: { id: string; status: string; access_mode?: string } | null;
    }>();
  if (variantError) console.error("[startAttempt] variant query failed", variantError.message);
  if (!variant || variant.status !== "published" || !variant.courses) return { error: "Бұл нұсқа қолжетімсіз" };
  const access = await getCourseAccess(supabase, user, { ...variant.courses, access_mode: variant.courses.access_mode ?? "open" });
  if (!access.allowed) return { error: access.reason === "not_enrolled" ? "Бұл курсқа рұқсатыңыз жоқ" : "Курс әлі ашылмаған" };

  // «Апта үздігі»: нұсқа куратор ашқан уақыттан бұрын басталмайды (ерте көріп алмау үшін)
  if (variant.contest_starts_at && Date.now() < new Date(variant.contest_starts_at).getTime() && user.profile?.role !== "admin") {
    return { error: `Бұл нұсқа ${formatDateTime(variant.contest_starts_at)}-де ашылады (Апта үздігі)` };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[startAttempt]", e);
    return { error: e instanceof ServerConfigError && user.profile?.role === "admin" ? e.message : "Сервер баптауында қате бар. Әкімшіге хабарлаңыз." };
  }

  const { count, error: countError } = await admin.from("questions").select("id", { count: "exact", head: true }).eq("variant_id", variant.id);
  if (countError) {
    console.error("[startAttempt] questions count failed", countError);
    return { error: "Тестті бастау мүмкін болмады. Қайталап көріңіз" };
  }
  if ((count ?? 0) < 40) return { error: "Нұсқа әлі толық дайын емес" };

  const { data: active } = await admin
    .from("test_attempts")
    .select("id")
    .eq("student_id", user.id)
    .eq("variant_id", variant.id)
    .eq("status", "in_progress")
    .maybeSingle();

  let attemptId = active?.id as string | undefined;

  if (!attemptId) {
    const now = new Date();
    const deadline = variant.time_limit_minutes ? new Date(now.getTime() + variant.time_limit_minutes * 60_000).toISOString() : null;
    const { data: created, error } = await admin
      .from("test_attempts")
      .insert({ variant_id: variant.id, student_id: user.id, started_at: now.toISOString(), deadline_at: deadline })
      .select("id")
      .single();
    if (error) {
      // Параллель басу кезіндегі unique index қақтығысы
      const { data: retry } = await admin
        .from("test_attempts")
        .select("id")
        .eq("student_id", user.id)
        .eq("variant_id", variant.id)
        .eq("status", "in_progress")
        .maybeSingle();
      if (!retry) return { error: "Тестті бастау мүмкін болмады. Қайталап көріңіз" };
      attemptId = retry.id;
    } else {
      attemptId = created.id;
    }
  }

  revalidatePath("/cabinet");
  revalidatePath("/courses", "layout");
  redirect(`/test/${attemptId}`);
}
