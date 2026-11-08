import { deleteStreamVideo } from "@/lib/cloudflare/stream";
import {
  ACTIVE_STATUSES,
  ApiError,
  authorizeVideo,
  deleteReplacedVideos,
  json,
  revalidateTarget,
  syncVideo,
  targetOfRow,
  toErrorResponse,
  toView,
  type VideoRow,
  type VideoTarget,
} from "@/lib/stream-uploads/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ videoId: string }> };

async function currentUidOf(admin: Awaited<ReturnType<typeof authorizeVideo>>["admin"], target: VideoTarget | null) {
  if (!target) return null;
  const table = target.type === "lesson" ? "module_lessons" : "test_variants";
  const { data } = await admin.from(table).select("cloudflare_video_uid, video_provider").eq("id", target.id).maybeSingle();
  return data?.video_provider === "cloudflare" ? ((data.cloudflare_video_uid as string | null) ?? null) : null;
}

/** Күйді сұрау (polling): Cloudflare-дағы нақты күй серверде тексеріліп, Supabase жаңартылады */
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { video, admin } = await authorizeVideo((await params).videoId);
    const synced = await syncVideo(admin, video);
    await deleteReplacedVideos(admin, targetOfRow(synced));
    return json({ video: toView(synced, await currentUidOf(admin, targetOfRow(synced))) });
  } catch (err) {
    return toErrorResponse(err, "stream-video");
  }
}

/**
 * Браузердегі жүктеу барысы: started → uploading, uploaded → processing.
 * Клиент тек осы екі ауысуды сұрай алады; ready/error тек Cloudflare-дан алынады.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { video, admin } = await authorizeVideo((await params).videoId);
    const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
    const action = body?.action;
    if (action !== "started" && action !== "uploaded") throw new ApiError(400, "Белгісіз әрекет", "bad_request");

    let row: VideoRow = video;
    if (action === "started" && video.status === "waiting") {
      const { data, error } = await admin.from("stream_videos").update({ status: "uploading" }).eq("id", video.id).eq("status", "waiting").select("*").maybeSingle<VideoRow>();
      if (error) throw new Error(error.message);
      row = data ?? video;
    }
    if (action === "uploaded" && (video.status === "waiting" || video.status === "uploading")) {
      const { data, error } = await admin.from("stream_videos").update({ status: "processing" }).eq("id", video.id).in("status", ["waiting", "uploading"]).select("*").maybeSingle<VideoRow>();
      if (error) throw new Error(error.message);
      row = await syncVideo(admin, data ?? video);
      revalidateTarget(targetOfRow(row));
    }
    return json({ video: toView(row, await currentUidOf(admin, targetOfRow(row))) });
  } catch (err) {
    return toErrorResponse(err, "stream-video");
  }
}

/** Аяқталмаған/қате жүктеуді тоқтату және Cloudflare-дан өшіру. Сабақтың ағымдағы видеосын бұл жерден өшіруге болмайды */
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { video, admin } = await authorizeVideo((await params).videoId);
    const currentUid = await currentUidOf(admin, targetOfRow(video));
    if (currentUid === video.cloudflare_uid) {
      throw new ApiError(409, "Бұл — сабақтың ағымдағы видеосы. Оны «Видеоны өшіру» батырмасымен өшіріңіз", "is_current");
    }
    if (video.status === "ready" && !video.replaced_at) {
      throw new ApiError(409, "Бұл видео дайын. Оны сабақ видеосы ретінде өшіріңіз", "is_ready");
    }
    if (!video.deleted_at) {
      await deleteStreamVideo(video.cloudflare_uid);
      const patch: Partial<VideoRow> = { deleted_at: new Date().toISOString(), replaced_at: video.replaced_at ?? new Date().toISOString() };
      if (ACTIVE_STATUSES.includes(video.status)) Object.assign(patch, { status: "error", error_message: "Жүктеу тоқтатылды" });
      await admin.from("stream_videos").update(patch).eq("id", video.id);
    }
    revalidateTarget(targetOfRow(video));
    return json({ ok: true });
  } catch (err) {
    return toErrorResponse(err, "stream-video");
  }
}
