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

interface VariantRow {
  id: string;
  status: string;
  video_provider: string;
  cloudflare_video_uid: string | null;
  courses: { id: string; status: string; access_mode?: string } | null;
}

/**
 * Cloudflare Stream signed playback URL беру.
 * Video UID клиенттен ЕМЕС, Supabase-тегі сабақтан алынады.
 * Тексеріледі: аккаунтқа кіру → сабақ бар және жарияланған → курсқа рұқсат.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(variantId)) return fail(404, "Видео табылмады", "not_found");

  const user = await getCurrentUser();
  if (!user) return fail(401, "Алдымен жүйеге кіріңіз", "unauthenticated");
  const isAdmin = user.profile?.role === "admin";

  // Пайдаланушы клиенті: RLS оқушыға тек жарияланған нұсқаларды көрсетеді
  const supabase = await createClient();
  const { data: variant, error: variantError } = await supabase
    .from("test_variants")
    .select("*, courses(*)")
    .eq("id", variantId)
    .maybeSingle<VariantRow>();
  if (variantError) console.error("[video-token] variant query failed", variantError.message);

  if (!variant || !variant.courses || variant.video_provider !== "cloudflare" || !variant.cloudflare_video_uid) {
    return fail(404, "Видео табылмады", "not_found");
  }
  if (!isAdmin && variant.status !== "published") return fail(404, "Видео табылмады", "not_found");

  const access = await getCourseAccess(supabase, user, { ...variant.courses, access_mode: variant.courses.access_mode ?? "open" });
  if (!access.allowed) {
    const reason = access.reason as keyof typeof ACCESS_DENIED_MESSAGE;
    return fail(403, ACCESS_DENIED_MESSAGE[reason] ?? "Бұл видеоны көруге рұқсатыңыз жоқ", "forbidden");
  }

  try {
    const playback = await createPlayback(variant.cloudflare_video_uid);
    return NextResponse.json(playback, { headers: noStore });
  } catch (err) {
    // Толық себеп тек сервер логында — клиентке құпия ақпарат берілмейді
    console.error("[video-token]", err instanceof Error ? err.message : err);
    if (err instanceof StreamConfigError) return fail(503, "Видео уақытша қолжетімсіз", "not_configured");
    return fail(502, "Видеоны жүктеу мүмкін болмады. Қайталап көріңіз", "upstream");
  }
}
