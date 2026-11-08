import { randomUUID } from "node:crypto";
import { createDirectTusUpload, configureUploadedVideo, deleteStreamVideo } from "@/lib/cloudflare/stream";
import { parseTusMetadata, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MIN, sanitizeFilename, UPLOAD_LINK_TTL_MS, validateUploadFile } from "@/lib/stream-uploads/rules";
import { ApiError, authorizeTarget, metaFor, supersedePendingUploads, toErrorResponse } from "@/lib/stream-uploads/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function maxDurationSeconds() {
  const v = Number(process.env.CLOUDFLARE_STREAM_MAX_DURATION_SECONDS);
  return Number.isInteger(v) && v >= 60 && v <= 36_000 ? v : 4 * 60 * 60;
}

/**
 * tus «creation» сұранысы (tus-js-client жібереді, денесі жоқ — видео файл бұл жерден ӨТПЕЙДІ).
 * Сервер: сессия → рөл → курсқа құқық → файл тексерісі → жиілік шегі → Cloudflare-да бір реттік жүктеу сілтемесі.
 * Жауап: 201 + Location (Cloudflare-дың бір реттік tus URL-і). Браузер файлды тікелей сол жерге жібереді.
 *
 * Query: variantId — ҰБТ нұсқасы НЕМЕСЕ lessonId — курс сабағы (кіріспе / блоктағы видео); replace=1 — сабақта видео бар болса, ауыстыруды мұғалім растады.
 * Headers: Upload-Length — файл көлемі; Upload-Metadata — filename, filetype.
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const lessonId = url.searchParams.get("lessonId");
    const { staff, lesson, admin, target } = lessonId ? await authorizeTarget("lesson", lessonId) : await authorizeTarget("variant", url.searchParams.get("variantId"));

    const size = Number(request.headers.get("upload-length"));
    const meta = parseTusMetadata(request.headers.get("upload-metadata"));
    const fileName = sanitizeFilename(meta.filename ?? "");
    const problem = validateUploadFile({ name: fileName, size, type: meta.filetype });
    if (problem) {
      const status = problem.code === "too_large" ? 413 : problem.code === "unsupported" ? 415 : 400;
      throw new ApiError(status, problem.message, problem.code);
    }

    const hasVideo = (lesson.video_provider === "cloudflare" && !!lesson.cloudflare_video_uid) || !!lesson.video_url;
    if (hasVideo && url.searchParams.get("replace") !== "1") {
      throw new ApiError(409, "Бұл сабақта видео бар. Ауыстыруды растаңыз", "needs_confirm");
    }

    // Жиілік шегі: пайдаланушыға RATE_LIMIT_WINDOW_MIN минутта RATE_LIMIT_MAX сілтеме
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60_000).toISOString();
    const { count, error: countError } = await admin
      .from("stream_videos")
      .select("id", { count: "exact", head: true })
      .eq("uploaded_by", staff.id)
      .gte("created_at", since);
    if (countError) throw new Error(`rate limit: ${countError.message}`);
    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      throw new ApiError(429, `Тым көп жүктеу әрекеті. ${RATE_LIMIT_WINDOW_MIN} минуттан кейін қайталап көріңіз`, "rate_limited");
    }

    // Бұл сабақтағы бұрынғы аяқталмаған жүктеулер тоқтатылады (батырманы қайта басу / жаңа файл)
    await supersedePendingUploads(admin, target, "Жаңа жүктеу басталды — бұл жүктеу тоқтатылды");

    const id = randomUUID();
    const expiresAt = new Date(Date.now() + UPLOAD_LINK_TTL_MS);
    const { uploadUrl, uid } = await createDirectTusUpload({
      sizeBytes: size,
      name: fileName,
      maxDurationSeconds: maxDurationSeconds(),
      expiresAt,
    });

    const row = {
      id,
      cloudflare_uid: uid,
      course_id: lesson.course_id,
      variant_id: target.type === "variant" ? lesson.id : null,
      ...(target.type === "lesson" ? { lesson_id: lesson.id } : {}),
      uploaded_by: staff.id,
      original_filename: fileName,
      size_bytes: size,
      status: "waiting" as const,
      upload_expires_at: expiresAt.toISOString(),
    };
    const { error: insertError } = await admin.from("stream_videos").insert(row);
    if (insertError) {
      await deleteStreamVideo(uid).catch(() => undefined);
      throw new Error(`stream_videos insert: ${insertError.message}`);
    }

    // Signed URL міндетті + сайт домендері + жазбаны табуға арналған meta (сәтсіз болса — ready кезінде қайталанады)
    await configureUploadedVideo(uid, metaFor(row)).catch((e) => console.error("[stream-upload] configure:", e instanceof Error ? e.message : e));

    return new Response(null, {
      status: 201,
      headers: {
        Location: uploadUrl,
        "Tus-Resumable": "1.0.0",
        "X-Video-Id": id,
        "Access-Control-Expose-Headers": "Location, Tus-Resumable, X-Video-Id",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    return toErrorResponse(err, "stream-upload");
  }
}

/** tus OPTIONS (бір домен болғандықтан CORS қажет емес; тек протокол нұсқасын айтамыз) */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: { "Tus-Resumable": "1.0.0", "Tus-Version": "1.0.0" } });
}
