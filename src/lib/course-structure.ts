import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlanetKey, type PlanetKey } from "@/lib/planets";

export interface CourseLesson {
  id: string;
  module_id: string | null;
  kind: "intro" | "video" | "test";
  title: string;
  position: number;
  video_provider: "url" | "cloudflare";
  video_url: string | null;
  cloudflare_video_uid: string | null;
  duration_minutes: number | null;
  variant_id: string | null;
  /** Тест: жарияланған ба, сұрақ саны, оқушының прогресі */
  test?: {
    published: boolean;
    questions: number;
    activeAttemptId: string | null;
    lastAttemptId: string | null;
    lastScore: number | null;
    maxScore: number | null;
  };
}

export interface CourseModule {
  id: string;
  title: string;
  planet: PlanetKey;
  position: number;
  lessons: CourseLesson[];
}

export interface CourseStructureData {
  intro: CourseLesson | null;
  modules: CourseModule[];
}

export function lessonHasVideo(l: Pick<CourseLesson, "video_provider" | "cloudflare_video_uid" | "video_url">) {
  return l.video_provider === "cloudflare" ? !!l.cloudflare_video_uid : !!l.video_url;
}

/**
 * Курс құрылымы (RLS: жарияланған блоктар/сабақтар, көрінетін курс).
 * Migration іске қосылмаса — бос құрылым (бұрынғы курс беті бұзылмайды).
 */
export async function loadCourseStructure(client: SupabaseClient, courseId: string, userId: string | null): Promise<CourseStructureData> {
  const [modulesRes, lessonsRes] = await Promise.all([
    client.from("course_modules").select("id, title, planet, position").eq("course_id", courseId).order("position").order("created_at"),
    client
      .from("module_lessons")
      .select("id, module_id, kind, title, position, video_provider, video_url, cloudflare_video_uid, duration_minutes, variant_id")
      .eq("course_id", courseId)
      .order("position")
      .order("created_at"),
  ]);
  if (modulesRes.error || lessonsRes.error) return { intro: null, modules: [] };

  const lessons = (lessonsRes.data ?? []) as CourseLesson[];
  const variantIds = lessons.map((l) => l.variant_id).filter(Boolean) as string[];

  if (variantIds.length) {
    const [variantsRes, attemptsRes] = await Promise.all([
      // RLS: оқушыға тек жарияланған тесттер көрінеді
      client.from("test_variants").select("id, status").in("id", variantIds),
      userId
        ? client.from("test_attempts").select("id, variant_id, status, total_score, max_score, created_at").eq("student_id", userId).in("variant_id", variantIds).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as { id: string; variant_id: string; status: string; total_score: number | null; max_score: number | null }[] }),
    ]);
    const published = new Set((variantsRes.data ?? []).filter((v) => v.status === "published").map((v) => v.id as string));
    const progress = new Map<string, NonNullable<CourseLesson["test"]>>();
    for (const a of attemptsRes.data ?? []) {
      const p = progress.get(a.variant_id) ?? { published: true, questions: 0, activeAttemptId: null, lastAttemptId: null, lastScore: null, maxScore: null };
      if (a.status === "in_progress") p.activeAttemptId ??= a.id;
      else if (!p.lastAttemptId) {
        p.lastAttemptId = a.id;
        p.lastScore = a.total_score;
        p.maxScore = a.max_score;
      }
      progress.set(a.variant_id, p);
    }
    for (const l of lessons) {
      if (!l.variant_id) continue;
      l.test = { ...(progress.get(l.variant_id) ?? { activeAttemptId: null, lastAttemptId: null, lastScore: null, maxScore: null, questions: 0 }), published: published.has(l.variant_id) };
    }
  }

  const modules: CourseModule[] = (modulesRes.data ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    planet: isPlanetKey(m.planet) ? m.planet : "mercury",
    position: m.position,
    // Жарияланбаған тест оқушыға көрсетілмейді
    lessons: lessons.filter((l) => l.module_id === m.id && (l.kind !== "test" || l.test?.published)),
  }));

  return { intro: lessons.find((l) => l.kind === "intro") ?? null, modules };
}
