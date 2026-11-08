import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Куратордың курстары (әкімшіге — барлық курс). RLS: куратор тек өз бекітулерін көреді */
export async function getCuratorCourses(client: SupabaseClient, user: { id: string; profile: { role: string } | null }) {
  if (user.profile?.role === "admin") {
    const { data } = await client.from("courses").select("id, title").order("position");
    return data ?? [];
  }
  const { data: links } = await client.from("course_curators").select("course_id").eq("curator_id", user.id);
  const ids = (links ?? []).map((l) => l.course_id as string);
  if (!ids.length) return [];
  const { data } = await client.from("courses").select("id, title").in("id", ids).order("position");
  return data ?? [];
}
