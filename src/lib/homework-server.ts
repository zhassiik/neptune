import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HomeworkCheck } from "@/lib/types";

/** Оқушының өз черновик/конспект белгілері (RLS: тек өзінікі). Кесте жоқ болса — бос */
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
