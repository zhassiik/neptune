import "server-only";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ServerConfigError } from "@/lib/supabase/admin";
import { isMissingObject as isMissingFunction } from "@/lib/devices/register";
import {
  configureUploadedVideo,
  deleteStreamVideo,
  getStreamVideoState,
  StreamConfigError,
  StreamNotFoundError,
  StreamUploadError,
} from "@/lib/cloudflare/stream";
import { mapCloudflareState, STATUS_TEXT, type StreamVideoStatus } from "./rules";

/* ------------------------------ Қателер ------------------------------ */

/** API жауабына айналатын қате: мәтіні мұғалімге түсінікті, техникалық код тек `code` өрісінде */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

const NO_STORE = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" };

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { ...NO_STORE, ...headers } });
}

/** Route handler-дің ортақ қате өңдеуі: құпия ақпарат клиентке жіберілмейді, толық себеп — тек сервер логында */
export function toErrorResponse(err: unknown, tag: string) {
  if (err instanceof ApiError) return json({ error: err.message, code: err.code }, err.status);
  if (err instanceof StreamUploadError) return json({ error: err.message, code: "cloudflare_rejected" }, 422);
  if (err instanceof StreamConfigError || err instanceof ServerConfigError) {
    console.error(`[${tag}] config:`, err.message);
    return json({ error: "Видео жүктеу әзірге бапталмаған. Сайт әкімшісіне хабарласыңыз", code: "not_configured" }, 503);
  }
  console.error(`[${tag}]`, err instanceof Error ? err.message : err);
  return json({ error: "Сервер қатесі. Біраздан кейін қайталап көріңіз", code: "server_error" }, 500);
}

/** Migration іске қосылмаған: функция немесе кесте жоқ */
function isMissingObject(error: { code?: string; message?: string } | null) {
  return isMissingFunction(error) || error?.code === "PGRST205" || /Could not find the table/i.test(error?.message ?? "");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/* ------------------------------ Құқық тексеру ------------------------------ */

export interface StaffUser {
  id: string;
  isAdmin: boolean;
}

/**
 * 401 — кірмеген (немесе сессия/құрылғы рұқсатсыз), 403 — әкімші емес (видео жүктеу — тек әкімші; куратор жүктей алмайды).
 * Рөл клиенттен емес, Supabase профилінен алынады.
 */
export async function requireVideoStaff(): Promise<StaffUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Сессия аяқталды. Жүйеге қайта кіріңіз", "unauthenticated");
  const role = user.profile?.role;
  if (role !== "admin") throw new ApiError(403, "Видео жүктеуге рұқсатыңыз жоқ", "forbidden");
  return { id: user.id, isAdmin: role === "admin" };
}

/** Курсты басқару құқығы — дерекқор функциясы арқылы (JWT-тегі пайдаланушы, рұқсат етілген сессия) */
async function assertCanManageCourse(courseId: string | null) {
  if (!courseId) throw new ApiError(403, "Бұл сабаққа рұқсатыңыз жоқ", "forbidden");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_manage_course_videos", { p_course_id: courseId });
  if (error) {
    if (isMissingObject(error)) throw new ApiError(503, "Деректер базасы жаңартылмаған: Supabase-те соңғы migration-ды іске қосыңыз", "not_migrated");
    console.error("[stream] can_manage_course_videos:", error.message);
    throw new ApiError(500, "Рұқсатты тексеру мүмкін болмады. Қайталап көріңіз", "server_error");
  }
  if (data !== true) throw new ApiError(403, "Бұл сабаққа рұқсатыңыз жоқ", "forbidden");
}

export interface LessonRow {
  id: string;
  course_id: string;
  title: string;
  position: number;
  video_provider: "url" | "cloudflare";
  video_url: string | null;
  cloudflare_video_uid: string | null;
  video_status: string | null;
}

const LESSON_COLUMNS = "id, course_id, title, position, video_provider, video_url, cloudflare_video_uid, video_status";

/**
 * Видео қайда бекітіледі: ҰБТ нұсқасының видео-талдауы (variant) немесе курс сабағы (lesson: кіріспе / блоктағы видео).
 * Екі кестеде видео бағандары бірдей аталады.
 */
export type VideoTargetType = "variant" | "lesson";
export interface VideoTarget {
  type: VideoTargetType;
  id: string;
}

const TARGETS = {
  variant: { table: "test_variants", column: "variant_id" },
  lesson: { table: "module_lessons", column: "lesson_id" },
} as const;

export function targetOfRow(row: Pick<VideoRow, "variant_id" | "lesson_id">): VideoTarget | null {
  if (row.lesson_id) return { type: "lesson", id: row.lesson_id };
  if (row.variant_id) return { type: "variant", id: row.variant_id };
  return null;
}

/** Нысананы (нұсқа немесе сабақ) серверде оқу + пайдаланушының осы курсқа құқығын тексеру */
export async function authorizeTarget(type: VideoTargetType, id: unknown) {
  const staff = await requireVideoStaff();
  if (!isUuid(id)) throw new ApiError(404, "Сабақ табылмады", "not_found");
  const admin = createAdminClient();
  const { data: lesson, error } = await admin.from(TARGETS[type].table).select(LESSON_COLUMNS).eq("id", id).maybeSingle<LessonRow>();
  if (error) {
    if (isMissingObject(error)) throw new ApiError(503, "Деректер базасы жаңартылмаған: Supabase-те соңғы migration-ды іске қосыңыз", "not_migrated");
    throw new Error(`lesson query: ${error.message}`);
  }
  if (!lesson) throw new ApiError(404, "Сабақ табылмады", "not_found");
  await assertCanManageCourse(lesson.course_id);
  return { staff, lesson, admin, target: { type, id: lesson.id } as VideoTarget };
}

/** ҰБТ нұсқасы (бұрынғы атауы сақталды) */
export function authorizeLesson(variantId: unknown) {
  return authorizeTarget("variant", variantId);
}

export interface VideoRow {
  id: string;
  cloudflare_uid: string;
  course_id: string | null;
  variant_id: string | null;
  /** Курс сабағы (migration 20261111) */
  lesson_id?: string | null;
  uploaded_by: string | null;
  original_filename: string;
  size_bytes: number | null;
  status: StreamVideoStatus;
  error_message: string | null;
  duration_seconds: number | null;
  upload_expires_at: string | null;
  replaced_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Видео жазбасын серверде оқу + құқық (жазбаның курсы бойынша) */
export async function authorizeVideo(videoId: unknown) {
  const staff = await requireVideoStaff();
  if (!isUuid(videoId)) throw new ApiError(404, "Видео табылмады", "not_found");
  const admin = createAdminClient();
  const { data: video, error } = await admin.from("stream_videos").select("*").eq("id", videoId).maybeSingle<VideoRow>();
  if (error) {
    if (isMissingObject(error)) throw new ApiError(503, "Деректер базасы жаңартылмаған: Supabase-те соңғы migration-ды іске қосыңыз", "not_migrated");
    throw new Error(`video query: ${error.message}`);
  }
  if (!video) throw new ApiError(404, "Видео табылмады", "not_found");
  await assertCanManageCourse(video.course_id);
  return { staff, video, admin };
}

type Admin = ReturnType<typeof createAdminClient>;

/* ------------------------------ Клиентке көрініс ------------------------------ */

export interface VideoView {
  id: string;
  uid: string;
  status: StreamVideoStatus;
  statusText: string;
  message: string | null;
  fileName: string;
  sizeBytes: number | null;
  durationSeconds: number | null;
  createdAt: string;
  uploadExpiresAt: string | null;
  isCurrent: boolean;
  removed: boolean;
}

export function toView(v: VideoRow, currentUid: string | null): VideoView {
  return {
    id: v.id,
    uid: v.cloudflare_uid,
    status: v.status,
    statusText: STATUS_TEXT[v.status],
    message: v.error_message,
    fileName: v.original_filename,
    sizeBytes: v.size_bytes,
    durationSeconds: v.duration_seconds,
    createdAt: v.created_at,
    uploadExpiresAt: v.upload_expires_at,
    isCurrent: !!currentUid && v.cloudflare_uid === currentUid,
    removed: !!v.deleted_at,
  };
}

export function revalidateTarget(target: VideoTarget | null) {
  if (!target) return;
  try {
    if (target.type === "variant") {
      revalidatePath(`/admin/variants/${target.id}`);
    } else {
      revalidatePath("/admin/courses", "layout");
      revalidatePath("/courses", "layout");
    }
  } catch {
    /* revalidatePath request-тен тыс шақырылса — елемейміз */
  }
}

/** ҰБТ нұсқасы (бұрынғы атауы) */
export function revalidateLesson(variantId: string | null) {
  revalidateTarget(variantId ? { type: "variant", id: variantId } : null);
}

/* ------------------------------ Күйді синхрондау ------------------------------ */

export const ACTIVE_STATUSES: StreamVideoStatus[] = ["waiting", "uploading", "processing"];

async function setStatus(admin: Admin, id: string, patch: Partial<Pick<VideoRow, "status" | "error_message" | "duration_seconds" | "replaced_at" | "deleted_at">>) {
  const { data, error } = await admin.from("stream_videos").update(patch).eq("id", id).select("*").single<VideoRow>();
  if (error) throw new Error(`stream_videos update: ${error.message}`);
  return data;
}

/**
 * Cloudflare-дағы нақты күйді сұрап, Supabase-ті жаңарту (polling және webhook бірдей осыны шақырады).
 * Видео дайын болса — сабаққа атомарлы бекітіледі, ескі видео содан кейін ғана өшіріледі.
 */
export async function syncVideo(admin: Admin, row: VideoRow): Promise<VideoRow> {
  if (row.deleted_at || !ACTIVE_STATUSES.includes(row.status)) return row;

  let info: Awaited<ReturnType<typeof getStreamVideoState>>;
  try {
    info = await getStreamVideoState(row.cloudflare_uid);
  } catch (e) {
    if (e instanceof StreamNotFoundError) {
      return setStatus(admin, row.id, { status: "error", error_message: "Видео Cloudflare-да табылмады. Қайта жүктеп көріңіз", deleted_at: new Date().toISOString() });
    }
    // Уақытша байланыс қатесі — келесі тексеруде қайталанады
    console.error("[stream] sync:", e instanceof Error ? e.message : e);
    return row;
  }

  const mapped = mapCloudflareState(info);
  if (mapped.status === "ready") return markReady(admin, row, info.durationSeconds);

  if (mapped.status === "error") {
    const updated = await setStatus(admin, row.id, { status: "error", error_message: mapped.message });
    revalidateTarget(targetOfRow(row));
    return updated;
  }

  if (mapped.status === "pending") {
    // Файл толық жүктелмеген: жүктеу мерзімі өтсе — қате және Cloudflare-дағы бос жазбаны өшіру
    if (row.upload_expires_at && Date.parse(row.upload_expires_at) < Date.now()) {
      await deleteStreamVideo(row.cloudflare_uid).catch((e) => console.error("[stream] expired delete:", e instanceof Error ? e.message : e));
      return setStatus(admin, row.id, { status: "error", error_message: "Жүктеу аяқталмады (сілтеменің мерзімі өтті). Видеоны қайта жүктеңіз", deleted_at: new Date().toISOString() });
    }
    return row;
  }

  // processing (downloading / queued / inprogress)
  if (row.status !== "processing") return setStatus(admin, row.id, { status: "processing", error_message: null });
  return row;
}

async function markReady(admin: Admin, row: VideoRow, durationSeconds: number | null): Promise<VideoRow> {
  // Signed URL міндетті + домен шектеуі (жүктеу кезінде орнатылған; қайта тексеріп бекітеміз)
  await configureUploadedVideo(row.cloudflare_uid, metaFor(row)).catch((e) => console.error("[stream] configure on ready:", e instanceof Error ? e.message : e));

  const { data, error } = await admin.rpc("stream_video_mark_ready", { p_uid: row.cloudflare_uid, p_duration_seconds: durationSeconds });
  if (error) throw new Error(`stream_video_mark_ready: ${error.message}`);
  const result = (data as { old_uid: string | null; applied: boolean }[] | null)?.[0];
  if (result?.old_uid) await deleteReplacedVideos(admin, targetOfRow(row));
  revalidateTarget(targetOfRow(row));

  const { data: fresh } = await admin.from("stream_videos").select("*").eq("id", row.id).single<VideoRow>();
  return fresh ?? row;
}

export function metaFor(row: Pick<VideoRow, "id" | "course_id" | "variant_id" | "lesson_id" | "uploaded_by" | "original_filename">): Record<string, string> {
  return {
    name: row.original_filename,
    neptune_video_id: row.id,
    course_id: row.course_id ?? "",
    lesson_id: row.lesson_id ?? row.variant_id ?? "",
    uploaded_by: row.uploaded_by ?? "",
  };
}

/** Видео қандай да бір сабақта әлі қолданылып тұр ма (онда Cloudflare-дан өшіруге болмайды) */
export async function isUidInUse(admin: Admin, uid: string) {
  const { count, error } = await admin.from("test_variants").select("id", { count: "exact", head: true }).eq("cloudflare_video_uid", uid);
  if (error) throw new Error(`uid usage: ${error.message}`);
  if ((count ?? 0) > 0) return true;
  // Курс сабақтары (migration жоқ болса — елемейміз)
  const lessons = await admin.from("module_lessons").select("id", { count: "exact", head: true }).eq("cloudflare_video_uid", uid);
  return (lessons.count ?? 0) > 0;
}

/**
 * Сабақтағы орнын басқа видео алған (replaced_at бар) жазбаларды Cloudflare-дан өшіру.
 * Тек ешбір сабақта қолданылмайтын видео өшіріледі; сәтсіз болса — келесі синхрондауда қайталанады.
 */
export async function deleteReplacedVideos(admin: Admin, target: VideoTarget | null) {
  if (!target) return;
  const { data } = await admin
    .from("stream_videos")
    .select("id, cloudflare_uid")
    .eq(TARGETS[target.type].column, target.id)
    .not("replaced_at", "is", null)
    .is("deleted_at", null)
    .limit(10);
  for (const r of data ?? []) {
    try {
      if (await isUidInUse(admin, r.cloudflare_uid)) continue;
      await deleteStreamVideo(r.cloudflare_uid);
      await admin.from("stream_videos").update({ deleted_at: new Date().toISOString() }).eq("id", r.id);
    } catch (e) {
      console.error("[stream] delete replaced:", e instanceof Error ? e.message : e);
    }
  }
}

/** Бұрынғы аяқталмаған жүктеулерді тоқтату (жаңасы басталғанда немесе сабақ видеосы өшірілгенде) */
export async function supersedePendingUploads(admin: Admin, target: VideoTarget, reason: string) {
  const { data } = await admin
    .from("stream_videos")
    .select("id, cloudflare_uid")
    .eq(TARGETS[target.type].column, target.id)
    .in("status", ACTIVE_STATUSES)
    .is("deleted_at", null);
  for (const r of data ?? []) {
    await admin.from("stream_videos").update({ status: "error", error_message: reason, replaced_at: new Date().toISOString() }).eq("id", r.id);
    try {
      if (await isUidInUse(admin, r.cloudflare_uid)) continue;
      await deleteStreamVideo(r.cloudflare_uid);
      await admin.from("stream_videos").update({ deleted_at: new Date().toISOString() }).eq("id", r.id);
    } catch (e) {
      console.error("[stream] supersede delete:", e instanceof Error ? e.message : e);
    }
  }
}

/* ------------------------------ Бетке бастапқы күй ------------------------------ */

export interface LessonVideoState {
  currentUid: string | null;
  currentStatus: string | null;
  hasOtherVideo: boolean;
  latest: VideoView | null;
  notMigrated: boolean;
}

/** Бет рендері үшін: сабақтың ағымдағы видеосы және соңғы жүктеу (құқық бетте тексерілген) */
export async function loadLessonVideoState(
  lesson: Pick<LessonRow, "id" | "cloudflare_video_uid" | "video_provider" | "video_url" | "video_status">,
  targetType: VideoTargetType = "variant",
): Promise<LessonVideoState> {
  const currentUid = lesson.video_provider === "cloudflare" ? lesson.cloudflare_video_uid : null;
  const base = { currentUid, currentStatus: currentUid ? lesson.video_status : null, hasOtherVideo: !currentUid && !!lesson.video_url };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stream_videos")
    .select("*")
    .eq(TARGETS[targetType].column, lesson.id)
    .is("replaced_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<VideoRow>();
  if (error) {
    if (isMissingObject(error)) return { ...base, latest: null, notMigrated: true };
    throw new Error(`stream_videos: ${error.message}`);
  }
  let latest = data ?? null;
  // Бет ашылғанда өңделіп жатқан видеоның күйін жаңартып аламыз (webhook әлі келмесе де)
  if (latest && latest.status === "processing") latest = await syncVideo(admin, latest).catch(() => latest);
  if (latest?.status === "ready" && !latest.replaced_at) {
    // Синхрондау кезінде сабаққа жаңа видео бекітілген болуы мүмкін
    return { currentUid: latest.cloudflare_uid, currentStatus: "ready", hasOtherVideo: false, latest: toView(latest, latest.cloudflare_uid), notMigrated: false };
  }
  return { ...base, latest: latest ? toView(latest, currentUid) : null, notMigrated: false };
}

/**
 * Нысананың Cloudflare видеосын өшіру: алдымен ажыратылады (оқушылар бірден көрмейді),
 * содан кейін Cloudflare-дан өшіріледі — егер сол видео басқа жерде қолданылмаса.
 */
export async function removeTargetVideo(admin: Admin, target: VideoTarget, lesson: Pick<LessonRow, "video_provider" | "cloudflare_video_uid">) {
  const uid = lesson.video_provider === "cloudflare" ? lesson.cloudflare_video_uid : null;
  if (!uid) throw new ApiError(404, "Бұл сабақта Cloudflare видеосы жоқ", "not_found");

  await supersedePendingUploads(admin, target, "Сабақ видеосы өшірілді — бұл жүктеу тоқтатылды");

  const patch = target.type === "variant" ? { video_provider: "url", cloudflare_video_uid: null, video_status: null } : { video_provider: "url", cloudflare_video_uid: null, video_status: null, duration_minutes: null };
  const { error } = await admin.from(TARGETS[target.type].table).update(patch).eq("id", target.id).eq("cloudflare_video_uid", uid);
  if (error) throw new Error(`detach video: ${error.message}`);

  const now = new Date().toISOString();
  await admin.from("stream_videos").update({ replaced_at: now }).eq("cloudflare_uid", uid).is("replaced_at", null);

  const inUse = await isUidInUse(admin, uid);
  let removedFromCloudflare = false;
  if (!inUse) {
    try {
      await deleteStreamVideo(uid);
      await admin.from("stream_videos").update({ deleted_at: now }).eq("cloudflare_uid", uid);
      removedFromCloudflare = true;
    } catch (e) {
      console.error("[stream] remove video:", e instanceof Error ? e.message : e);
    }
  }
  revalidateTarget(target);
  return removedFromCloudflare
    ? "Видео өшірілді"
    : inUse
      ? "Видео сабақтан алынды (ол басқа жерде де қолданылғандықтан, Cloudflare-да қалдырылды)"
      : "Видео сабақтан алынды. Cloudflare-дан өшіру сәтсіз болды — кейін қайта көріңіз";
}
