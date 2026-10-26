import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateCourseAccess, type CourseAccess } from "./access-rules";

/**
 * Ағымдағы пайдаланушының курсқа рұқсаты (сервер жағында).
 * client — пайдаланушының Supabase клиенті (RLS: оқушы тек өз рұқсатын көреді).
 */
export async function getCourseAccess(
  client: SupabaseClient,
  user: { id: string; profile: { role: string } | null } | null,
  course: { id: string; status: string; access_mode: string },
): Promise<CourseAccess> {
  const isAdmin = user?.profile?.role === "admin";
  let enrolled = false;
  if (user && !isAdmin && course.access_mode === "enrolled") {
    const { data } = await client
      .from("course_enrollments")
      .select("course_id")
      .eq("course_id", course.id)
      .eq("student_id", user.id)
      .maybeSingle();
    enrolled = !!data;
  }
  return evaluateCourseAccess({ loggedIn: !!user, isAdmin, course, enrolled });
}
