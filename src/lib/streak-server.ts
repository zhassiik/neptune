import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateCourseAccess } from "@/lib/access-rules";
import { computeStreak, type StreakResult, type StreakVariant } from "@/lib/streak";

/** Соңғы 180 күн жеткілікті: серия бір өткізіп алған тапсырма күнінде үзіледі */
const LOOKBACK_DAYS = 180;

interface VariantRow {
  id: string;
  title: string;
  position: number;
  published_at: string | null;
  kind?: string;
  courses: { id: string; slug: string; status: string; access_mode?: string } | null;
}

/**
 * Оқушының «Менің Жұлдызым» сериясы (серверде есептеледі).
 * client — оқушының Supabase клиенті: RLS тек жарияланған нұсқаларды және оқушының өз талпыныстарын береді.
 */
export async function getStudentStreak(client: SupabaseClient, user: { id: string; createdAt: string }): Promise<StreakResult | null> {
  const since = new Date(Math.max(Date.now() - LOOKBACK_DAYS * 24 * 3600_000, Date.parse(user.createdAt) - 24 * 3600_000)).toISOString();

  const [variantsRes, attemptsRes, enrollRes] = await Promise.all([
    client
      .from("test_variants")
      .select("*, courses(*)")
      .eq("status", "published")
      .gte("published_at", since)
      .returns<VariantRow[]>(),
    client.from("test_attempts").select("variant_id, submitted_at").eq("student_id", user.id).eq("status", "submitted").gte("submitted_at", since),
    client.from("course_enrollments").select("course_id").eq("student_id", user.id),
  ]);
  if (variantsRes.error || attemptsRes.error) {
    console.error("[streak]", variantsRes.error?.message ?? attemptsRes.error?.message);
    return null;
  }

  const enrolled = new Set((enrollRes.data ?? []).map((e) => e.course_id as string));
  // Тек оқушыға қолжетімді курстардың нұсқалары тапсырма болып саналады
  const variants: StreakVariant[] = (variantsRes.data ?? [])
    // Тек ҰБТ нұсқалары (блоктағы еркін тесттер жұлдызға әсер етпейді)
    .filter((v) => v.published_at && v.courses && (v.kind ?? "ubt") === "ubt")
    .filter((v) =>
      evaluateCourseAccess({
        loggedIn: true,
        isAdmin: false,
        course: { status: v.courses!.status, access_mode: v.courses!.access_mode ?? "open" },
        enrolled: enrolled.has(v.courses!.id),
      }).allowed,
    )
    .map((v) => ({ id: v.id, title: v.title, position: v.position, courseSlug: v.courses!.slug, publishedAt: v.published_at! }));

  return computeStreak({
    now: Date.now(),
    signupAt: user.createdAt,
    variants,
    submissions: (attemptsRes.data ?? []).filter((a) => a.submitted_at).map((a) => ({ variantId: a.variant_id as string, submittedAt: a.submitted_at as string })),
  });
}
