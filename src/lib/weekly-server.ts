import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContestWeek, HomeworkCheck, LeaderboardRow } from "@/lib/types";

/** Курстың жарияланған апталары (жаңасы бірінші). Migration жоқ болса — бос тізім */
export async function getCourseWeeks(client: SupabaseClient, courseId: string): Promise<ContestWeek[]> {
  const { data, error } = await client
    .from("contest_weeks")
    .select("id, course_id, title, position, is_published")
    .eq("course_id", courseId)
    .order("position", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as ContestWeek[];
}

/** Апта рейтингі: оқушыға топ-N + өз орны; әкімшіге limit=null → толық тізім */
export async function getLeaderboard(client: SupabaseClient, weekId: string, limit: number | null = 5): Promise<LeaderboardRow[]> {
  const { data, error } = await client.rpc("week_leaderboard", { p_week: weekId, p_limit: limit });
  if (error) {
    console.error("[weekly] leaderboard:", error.message);
    return [];
  }
  return ((data ?? []) as LeaderboardRow[]).map((r) => ({
    ...r,
    homework_points: Number(r.homework_points),
    total: Number(r.total),
  }));
}

/** Оқушының өз черновик/конспект бағалары (RLS: тек өзінікі) */
export async function getMyHomework(client: SupabaseClient, userId: string, variantIds: string[]): Promise<Record<string, HomeworkCheck>> {
  if (!variantIds.length) return {};
  const { data, error } = await client
    .from("homework_checks")
    .select("variant_id, student_id, draft_status, notes_status")
    .eq("student_id", userId)
    .in("variant_id", variantIds);
  if (error) return {};
  return Object.fromEntries((data ?? []).map((h) => [h.variant_id, h as HomeworkCheck]));
}
