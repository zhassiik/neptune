import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCourseAccess } from "@/lib/access";
import { ACCESS_DENIED_MESSAGE } from "@/lib/access-rules";
import { createPlayback, StreamConfigError } from "@/lib/cloudflare/stream";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" };

function fail(status: number, error: string, code: string) {
  return NextResponse.json({ error, code }, { status, headers: noStore });
}

interface LessonRow {
  id: string;
  kind: "intro" | "video" | "test";
  video_provider: string;
  cloudflare_video_uid: string | null;
  courses: { id: string; status: string; access_mode?: string } | null;
}

/**
 * Курс сабағының Cloudflare видеосына signed URL.
 * UID клиенттен емес, Supabase-тегі сабақтан алынады (RLS: жарияланған сабақ, көрінетін курс).
 * Кіріспе видео (intro) — курс бетіндегі таныстыру, оны кез келген келуші көре алады;
 * блоктағы видео — тек курсқа рұқсаты бар оқушыға.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) return fail(404, "Видео табылмады", "not_found");

  const supabase = await createClient();
  const { data: lesson, error } = await supabase.from("module_lessons").select("id, kind, video_provider, cloudflare_video_uid, courses(*)").eq("id", lessonId).maybeSingle<LessonRow>();
  if (error) console.error("[lesson-video-token]", error.message);
  if (!lesson || !lesson.courses || lesson.video_provider !== "cloudflare" || !lesson.cloudflare_video_uid) return fail(404, "Видео табылмады", "not_found");

  if (lesson.kind !== "intro") {
    const user = await getCurrentUser();
    if (!user) return fail(401, "Алдымен жүйеге кіріңіз", "unauthenticated");
    const access = await getCourseAccess(supabase, user, { ...lesson.courses, access_mode: lesson.courses.access_mode ?? "open" });
    if (!access.allowed) {
      const reason = access.reason as keyof typeof ACCESS_DENIED_MESSAGE;
      return fail(403, ACCESS_DENIED_MESSAGE[reason] ?? "Бұл видеоны көруге рұқсатыңыз жоқ", "forbidden");
    }
  }

  try {
    return NextResponse.json(await createPlayback(lesson.cloudflare_video_uid), { headers: noStore });
  } catch (err) {
    console.error("[lesson-video-token]", err instanceof Error ? err.message : err);
    if (err instanceof StreamConfigError) return fail(503, "Видео уақытша қолжетімсіз", "not_configured");
    return fail(502, "Видеоны жүктеу мүмкін болмады. Қайталап көріңіз", "upstream");
  }
}
