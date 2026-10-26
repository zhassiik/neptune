"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { IMAGE_BUCKET } from "@/lib/attempts/questions";
import { humanizeError } from "@/lib/utils";
import { parseVideoUrl } from "@/lib/video";
import { extractVideoUid } from "@/lib/cloudflare/token";
import { getVideoInfo, secureVideo, StreamConfigError, type StreamVideoInfo } from "@/lib/cloudflare/stream";
import { COVER_BUCKET, isStaticCover } from "@/lib/courses";
import { checkVariantCompleteness, toRpcPayload, validateQuestion, type QuestionDraft, type QuestionErrors, type StoredQuestion } from "./question-schema";

export interface FormState {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

const uuid = z.string().uuid();

/* =====================================================================
 * Нұсқалар
 * ===================================================================== */

const optionalInt = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= min && v <= max), message);

const variantSchema = z.object({
  course_id: z.string().uuid("Курсты таңдаңыз"),
  position: z
    .string()
    .trim()
    .transform(Number)
    .refine((v) => Number.isInteger(v) && v >= 1 && v <= 1000, "Нөмір 1–1000 аралығында болуы керек"),
  title: z.string().trim().min(3, "Атауы кемінде 3 таңба").max(150, "Атауы тым ұзын"),
  subject: z.string().trim().min(2, "Пән атауын енгізіңіз").max(80, "Пән атауы тым ұзын"),
  description: z.string().trim().max(1000, "Сипаттама тым ұзын").optional(),
  time_limit_minutes: optionalInt(1, 600, "Уақыт 1–600 минут аралығында болуы керек"),
  video_url: z
    .string()
    .trim()
    .max(500, "Сілтеме тым ұзын")
    .refine((v) => !v || parseVideoUrl(v) !== null, "YouTube, Vimeo, Kinescope немесе .mp4 сілтемесін енгізіңіз")
    .transform((v) => v || null),
  video_duration_minutes: optionalInt(1, 600, "Ұзақтығы 1–600 минут аралығында болуы керек"),
  video_provider: z.enum(["url", "cloudflare"]),
  cloudflare_video_uid: z
    .string()
    .trim()
    .max(300)
    .transform((v, ctx) => {
      if (!v) return null;
      const uid = extractVideoUid(v);
      if (!uid) {
        ctx.addIssue({ code: "custom", message: "Video UID 32 таңбадан тұрады (0–9, a–f). Cloudflare Stream-дағы Video ID-ді көшіріңіз" });
        return z.NEVER;
      }
      return uid;
    }),
  show_correct_answers: z.boolean(),
});

type VariantInput = z.infer<typeof variantSchema>;

/**
 * Cloudflare таңдалса: UID бос болса — видеосыз сақталады (provider=url),
 * UID бар болса — Cloudflare-дан күйі мен ұзақтығы алынады (API бапталған болса).
 */
async function prepareVariantRow(data: VariantInput) {
  const { video_provider, cloudflare_video_uid, ...rest } = data;
  const useCloudflare = video_provider === "cloudflare" && !!cloudflare_video_uid;
  const row = {
    ...rest,
    description: rest.description || null,
    video_provider: useCloudflare ? ("cloudflare" as const) : ("url" as const),
    cloudflare_video_uid,
    video_status: null as string | null,
  };
  let warning: string | null = null;
  if (useCloudflare) {
    try {
      const info = await getVideoInfo(cloudflare_video_uid!);
      row.video_status = info.state;
      if (!row.video_duration_minutes && info.durationSeconds) row.video_duration_minutes = Math.max(1, Math.round(info.durationSeconds / 60));
      if (!info.requireSignedURLs) warning = "Назар аударыңыз: бұл видеода signed URL қорғауы әлі қосылмаған — «Қорғауды орнату» батырмасын басыңыз.";
    } catch (e) {
      warning =
        e instanceof StreamConfigError
          ? `Cloudflare-дан ақпарат алынбады: ${e.message}`
          : "Cloudflare-дан ақпарат алынбады (байланыс қатесі). UID сақталды.";
    }
  }
  return { row, warning };
}

function readVariantForm(fd: FormData) {
  return variantSchema.safeParse({
    course_id: fd.get("course_id") ?? "",
    position: fd.get("position") ?? "",
    video_url: fd.get("video_url") ?? "",
    video_provider: fd.get("video_provider") === "url" ? "url" : "cloudflare",
    cloudflare_video_uid: fd.get("cloudflare_video_uid") ?? "",
    video_duration_minutes: fd.get("video_duration_minutes") ?? "",
    title: fd.get("title") ?? "",
    subject: fd.get("subject") ?? "",
    description: fd.get("description") ?? "",
    time_limit_minutes: fd.get("time_limit_minutes") ?? "",
    show_correct_answers: fd.get("show_correct_answers") === "on",
  });
}

export async function createVariant(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await assertAdmin();
  const parsed = readVariantForm(fd);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { row } = await prepareVariantRow(parsed.data);
  const { data, error } = await supabase
    .from("test_variants")
    .insert({ ...row, created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: humanizeError(error) };

  revalidatePath("/admin/variants");
  redirect(`/admin/variants/${data.id}/quick?created=1`);
}

export async function updateVariant(variantId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(variantId).success) return { error: "Нұсқа табылмады" };
  const parsed = readVariantForm(fd);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { row, warning } = await prepareVariantRow(parsed.data);
  const { error } = await supabase.from("test_variants").update(row).eq("id", variantId);
  if (error) return { error: humanizeError(error) };

  revalidatePath(`/admin/variants/${variantId}`);
  revalidatePath("/admin/variants");
  revalidatePath("/courses", "layout");
  return { ok: true, message: warning ? `Баптаулар сақталды. ${warning}` : "Баптаулар сақталды" };
}

export async function setVariantStatus(variantId: string, status: "draft" | "published"): Promise<FormState & { problems?: { position: number; issue: string }[] }> {
  await assertAdmin();
  if (!uuid.safeParse(variantId).success) return { error: "Нұсқа табылмады" };
  const supabase = await createClient();

  if (status === "published") {
    const { data, error } = await supabase
      .from("questions")
      .select("position, type, prompt, image_path, answer_options(text, is_correct), matching_items(label, text, correct_option_id), matching_options(id, text)")
      .eq("variant_id", variantId);
    if (error) return { error: humanizeError(error) };
    const problems = checkVariantCompleteness((data ?? []) as StoredQuestion[]);
    if (problems.length) {
      return { error: `Жариялау мүмкін емес: ${problems.length} сұрақ толық емес`, problems };
    }
  }

  const { error } = await supabase
    .from("test_variants")
    .update({ status, published_at: status === "published" ? new Date().toISOString() : null })
    .eq("id", variantId);
  if (error) return { error: humanizeError(error) };

  revalidatePath("/admin", "layout");
  revalidatePath("/courses", "layout");
  return { ok: true, message: status === "published" ? "Нұсқа жарияланды" : "Нұсқа жобаға (draft) қайтарылды" };
}

export async function deleteVariant(variantId: string): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(variantId).success) return { error: "Нұсқа табылмады" };
  const supabase = await createClient();

  // Суреттерді Storage-тан тазалау
  const folder = `variants/${variantId}`;
  const { data: files } = await supabase.storage.from(IMAGE_BUCKET).list(folder, { limit: 1000 });
  if (files?.length) {
    await supabase.storage.from(IMAGE_BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
  }

  const { error } = await supabase.from("test_variants").delete().eq("id", variantId);
  if (error) return { error: humanizeError(error) };

  revalidatePath("/admin", "layout");
  revalidatePath("/courses", "layout");
  return { ok: true, message: "Нұсқа өшірілді" };
}

/* =====================================================================
 * Сұрақтар
 * ===================================================================== */

export async function saveQuestion(draft: QuestionDraft): Promise<{ ok: true; questionId: string } | { ok: false; errors: QuestionErrors }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { ok: false, errors: { form: (e as Error).message } };
  }

  const result = validateQuestion(draft);
  if (!result.ok) return result;
  const data = result.data;

  const supabase = await createClient();

  const { data: previous } = await supabase
    .from("questions")
    .select("image_path")
    .eq("variant_id", data.variantId)
    .eq("position", data.position)
    .maybeSingle();

  const { data: questionId, error } = await supabase.rpc("save_question", {
    p_variant_id: data.variantId,
    p_position: data.position,
    p_payload: toRpcPayload(data),
  });
  if (error) return { ok: false, errors: { form: humanizeError(error) } };

  // Ауыстырылған ескі суретті өшіру
  if (previous?.image_path && previous.image_path !== data.imagePath) {
    await removeImageIfUnused(previous.image_path);
  }

  revalidatePath(`/admin/variants/${data.variantId}`, "layout");
  return { ok: true, questionId: questionId as string };
}

async function removeImageIfUnused(path: string) {
  const supabase = await createClient();
  const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("image_path", path);
  if (!count) await supabase.storage.from(IMAGE_BUCKET).remove([path]);
}

export async function deleteQuestion(questionId: string): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(questionId).success) return { error: "Сұрақ табылмады" };
  const supabase = await createClient();
  const { data: q } = await supabase.from("questions").select("variant_id, image_path").eq("id", questionId).maybeSingle();
  if (!q) return { error: "Сұрақ табылмады" };

  const { error } = await supabase.from("questions").delete().eq("id", questionId);
  if (error) return { error: humanizeError(error) };
  if (q.image_path) await removeImageIfUnused(q.image_path);

  revalidatePath(`/admin/variants/${q.variant_id}`);
  return { ok: true, message: "Сұрақ өшірілді" };
}

/** Сұрақты бөлім ішіндегі басқа нөмірге жылжыту (орын бос болмаса — ауыстыру) */
export async function moveQuestion(questionId: string, targetPosition: number): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(questionId).success || !Number.isInteger(targetPosition)) return { error: "Деректер дұрыс емес" };
  const supabase = await createClient();
  const { data: q } = await supabase.from("questions").select("variant_id").eq("id", questionId).maybeSingle();
  const { error } = await supabase.rpc("move_question_to_position", { p_question: questionId, p_position: targetPosition });
  if (error) {
    return { error: /questions_type_matches_position/.test(error.message) ? "Сұрақты тек өз бөлімі ішінде жылжытуға болады" : humanizeError(error) };
  }
  if (q) revalidatePath(`/admin/variants/${q.variant_id}`);
  return { ok: true };
}

/**
 * Жылдам енгізу: скринді сұраққа бекіту.
 * Сұрақ бар болса — тек суреті ауысады (жауаптар сақталады).
 * Жоқ болса — бос жауап нұсқаларымен құрылады (дұрыс жауапты кейін белгілейді).
 */
export async function attachQuestionImage(variantId: string, position: number, path: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!uuid.safeParse(variantId).success || !Number.isInteger(position) || position < 1 || position > 40) {
    return { ok: false, error: "Деректер дұрыс емес" };
  }
  if (!path.startsWith(`variants/${variantId}/`) || !/^variants\/[0-9a-f-]{36}\/[\w.-]+$/i.test(path)) {
    return { ok: false, error: "Сурет жолы дұрыс емес" };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("questions")
    .select("id, image_path")
    .eq("variant_id", variantId)
    .eq("position", position)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("questions").update({ image_path: path }).eq("id", existing.id);
    if (error) return { ok: false, error: humanizeError(error) };
    if (existing.image_path && existing.image_path !== path) await removeImageIfUnused(existing.image_path);
  } else {
    const type = position <= 30 ? "single" : position <= 35 ? "matching" : "multiple";
    const blank = (n: number) => Array.from({ length: n }, () => ({ id: null, text: "", is_correct: false }));
    const payload =
      type === "matching"
        ? {
            image_path: path,
            matching_options: [1, 2, 3, 4].map((i) => ({ id: null, key: `k${i}`, text: "" })),
            matching_items: [
              { label: "A", text: "", correct_key: null },
              { label: "B", text: "", correct_key: null },
            ],
          }
        : { image_path: path, options: blank(type === "single" ? 4 : 6) };
    const { error } = await supabase.rpc("save_question", { p_variant_id: variantId, p_position: position, p_payload: payload });
    if (error) return { ok: false, error: humanizeError(error) };
  }

  revalidatePath(`/admin/variants/${variantId}`, "layout");
  return { ok: true };
}

/** Жүктелген, бірақ сақталмаған суретті өшіру */
export async function discardUploadedImage(path: string): Promise<void> {
  await assertAdmin();
  if (!/^variants\/[0-9a-f-]{36}\/[\w.-]+$/i.test(path)) return;
  await removeImageIfUnused(path);
}

/* =====================================================================
 * Баптаулар
 * ===================================================================== */

const settingsSchema = z.object({
  platform_name: z.string().trim().min(2, "Атауы кемінде 2 таңба").max(80),
  contact_email: z.union([z.literal(""), z.string().trim().email("Email форматы дұрыс емес")]),
  contact_phone: z.string().trim().max(40, "Телефон тым ұзын"),
  contact_address: z.string().trim().max(200, "Мекенжай тым ұзын"),
});

export async function updatePlatformSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  await assertAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(["platform_name", "contact_email", "contact_phone", "contact_address"].map((k) => [k, String(fd.get(k) ?? "")])));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({
      platform_name: parsed.data.platform_name,
      contact_email: parsed.data.contact_email || null,
      contact_phone: parsed.data.contact_phone || null,
      contact_address: parsed.data.contact_address || null,
    })
    .eq("id", 1);
  if (error) return { error: humanizeError(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Платформа баптаулары сақталды" };
}

export async function updateOwnProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await assertAdmin();
  const name = z.string().trim().min(2, "Аты-жөнін енгізіңіз").max(120).safeParse(fd.get("full_name") ?? "");
  if (!name.success) return { fieldErrors: { full_name: name.error.issues[0].message } };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: name.data }).eq("id", user.id);
  if (error) return { error: humanizeError(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Профиль жаңартылды" };
}

export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  await assertAdmin();
  const parsed = z
    .object({
      password: z.string().min(8, "Құпиясөз кемінде 8 таңба").max(72),
      password_confirm: z.string(),
    })
    .refine((d) => d.password === d.password_confirm, { message: "Құпиясөздер сәйкес келмейді", path: ["password_confirm"] })
    .safeParse({ password: fd.get("password") ?? "", password_confirm: fd.get("password_confirm") ?? "" });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: humanizeError(error) };
  return { ok: true, message: "Құпиясөз өзгертілді" };
}

/* =====================================================================
 * Оқушылар
 * ===================================================================== */

export async function setUserRole(userId: string, role: "student" | "admin"): Promise<FormState> {
  const me = await assertAdmin();
  if (!uuid.safeParse(userId).success) return { error: "Пайдаланушы табылмады" };
  if (userId === me.id) return { error: "Өз рөліңізді өзгерте алмайсыз" };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: humanizeError(error) };
  revalidatePath("/admin/students");
  return { ok: true, message: role === "admin" ? "Әкімші құқығы берілді" : "Әкімші құқығы алынды" };
}

export async function deleteAttempt(attemptId: string): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(attemptId).success) return { error: "Нәтиже табылмады" };
  const supabase = await createClient();
  const { error } = await supabase.from("test_attempts").delete().eq("id", attemptId);
  if (error) return { error: humanizeError(error) };
  revalidatePath("/admin/results");
  return { ok: true, message: "Нәтиже өшірілді" };
}

/* =====================================================================
 * Курстар
 * ===================================================================== */

const courseSchema = z.object({
  title: z.string().trim().min(3, "Атауы кемінде 3 таңба").max(150, "Атауы тым ұзын"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Тек латын әріптері, сандар және сызықша (мысалы: tangy-200)")
    .max(80, "Тым ұзын"),
  description: z.string().trim().max(2000, "Сипаттама тым ұзын"),
  price: optionalInt(0, 100_000_000, "Баға дұрыс емес"),
  status: z.enum(["draft", "coming_soon", "published"]),
  access_mode: z.enum(["open", "enrolled"]),
  position: z
    .string()
    .trim()
    .transform(Number)
    .refine((v) => Number.isInteger(v) && v >= 1 && v <= 1000, "Реті 1–1000 аралығында"),
  cover_path: z
    .string()
    .regex(/^(\/?covers\/[\w-]+\.(webp|jpg|png))?$/, "Мұқаба жолы дұрыс емес")
    .transform((v) => v || null),
});

function readCourseForm(fd: FormData) {
  return courseSchema.safeParse(
    Object.fromEntries(["title", "slug", "description", "price", "status", "access_mode", "position", "cover_path"].map((k) => [k, String(fd.get(k) ?? "")])),
  );
}

function courseDbError(error: { code?: string; message: string }) {
  if (error.code === "23505") return { fieldErrors: { slug: "Бұл сілтеме (slug) бос емес — басқасын жазыңыз" } };
  return { error: humanizeError(error) };
}

export async function createCourse(_prev: FormState, fd: FormData): Promise<FormState> {
  await assertAdmin();
  const parsed = readCourseForm(fd);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .insert({ ...parsed.data, description: parsed.data.description || null })
    .select("id")
    .single();
  if (error) return courseDbError(error);
  revalidatePath("/", "layout");
  redirect(`/admin/courses/${data.id}?created=1`);
}

export async function updateCourse(courseId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(courseId).success) return { error: "Курс табылмады" };
  const parsed = readCourseForm(fd);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();

  const { data: prev } = await supabase.from("courses").select("cover_path").eq("id", courseId).maybeSingle();
  const { error } = await supabase
    .from("courses")
    .update({ ...parsed.data, description: parsed.data.description || null })
    .eq("id", courseId);
  if (error) return courseDbError(error);
  if (prev?.cover_path && prev.cover_path !== parsed.data.cover_path && !isStaticCover(prev.cover_path)) {
    await supabase.storage.from(COVER_BUCKET).remove([prev.cover_path]);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Курс сақталды" };
}

export async function deleteCourse(courseId: string): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(courseId).success) return { error: "Курс табылмады" };
  const supabase = await createClient();
  const { count } = await supabase.from("test_variants").select("id", { count: "exact", head: true }).eq("course_id", courseId);
  if (count) return { error: `Курста ${count} нұсқа бар. Алдымен оларды өшіріңіз немесе басқа курсқа ауыстырыңыз.` };
  const { data: prev } = await supabase.from("courses").select("cover_path").eq("id", courseId).maybeSingle();
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) return { error: humanizeError(error) };
  if (prev?.cover_path && !isStaticCover(prev.cover_path)) await supabase.storage.from(COVER_BUCKET).remove([prev.cover_path]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Курс өшірілді" };
}

/* =====================================================================
 * Cloudflare Stream (тек әкімші)
 * ===================================================================== */

type CloudflareResult = { ok: true; info: StreamVideoInfo; message?: string } | { ok: false; error: string };

async function variantCloudflareUid(variantId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("test_variants").select("cloudflare_video_uid, video_duration_minutes").eq("id", variantId).maybeSingle();
  return { supabase, uid: data?.cloudflare_video_uid as string | null, duration: data?.video_duration_minutes as number | null };
}

function cloudflareError(e: unknown) {
  if (e instanceof StreamConfigError) return e.message;
  console.error("[cloudflare]", e instanceof Error ? e.message : e);
  return "Cloudflare-мен байланыс сәтсіз болды. Қайталап көріңіз";
}

/** Cloudflare-дағы видео күйін тексеріп, Supabase-те жаңарту */
export async function refreshCloudflareVideo(variantId: string): Promise<CloudflareResult> {
  await assertAdmin();
  if (!uuid.safeParse(variantId).success) return { ok: false, error: "Нұсқа табылмады" };
  const { supabase, uid, duration } = await variantCloudflareUid(variantId);
  if (!uid) return { ok: false, error: "Алдымен Video UID енгізіп, сақтаңыз" };
  try {
    const info = await getVideoInfo(uid);
    await supabase
      .from("test_variants")
      .update({
        video_status: info.state,
        ...(!duration && info.durationSeconds ? { video_duration_minutes: Math.max(1, Math.round(info.durationSeconds / 60)) } : {}),
      })
      .eq("id", variantId);
    revalidatePath(`/admin/variants/${variantId}`);
    return { ok: true, info };
  } catch (e) {
    return { ok: false, error: cloudflareError(e) };
  }
}

/** Видеоға requireSignedURLs=true және allowedOrigins орнату */
export async function secureCloudflareVideo(variantId: string): Promise<CloudflareResult> {
  await assertAdmin();
  if (!uuid.safeParse(variantId).success) return { ok: false, error: "Нұсқа табылмады" };
  const { uid } = await variantCloudflareUid(variantId);
  if (!uid) return { ok: false, error: "Алдымен Video UID енгізіп, сақтаңыз" };
  try {
    const info = await secureVideo(uid);
    return { ok: true, info, message: "Қорғау орнатылды: видео тек signed token арқылы және рұқсат етілген домендерде ойнатылады" };
  } catch (e) {
    return { ok: false, error: cloudflareError(e) };
  }
}

/* =====================================================================
 * Курсқа рұқсат (enrollment)
 * ===================================================================== */

export async function grantCourseAccess(courseId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await assertAdmin();
  if (!uuid.safeParse(courseId).success) return { error: "Курс табылмады" };
  const email = z.string().trim().toLowerCase().email("Email форматы дұрыс емес").safeParse(fd.get("email") ?? "");
  if (!email.success) return { fieldErrors: { email: email.error.issues[0].message } };

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id, full_name").ilike("email", email.data).maybeSingle();
  if (!profile) return { fieldErrors: { email: "Бұл email-мен тіркелген оқушы табылмады. Алдымен сайтта тіркелуі керек" } };

  const { error } = await supabase
    .from("course_enrollments")
    .upsert({ course_id: courseId, student_id: profile.id, granted_by: admin.id }, { onConflict: "course_id,student_id", ignoreDuplicates: true });
  if (error) return { error: humanizeError(error) };
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true, message: `${profile.full_name || email.data} курсқа қосылды` };
}

export async function revokeCourseAccess(courseId: string, studentId: string): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(courseId).success || !uuid.safeParse(studentId).success) return { error: "Деректер дұрыс емес" };
  const supabase = await createClient();
  const { error } = await supabase.from("course_enrollments").delete().eq("course_id", courseId).eq("student_id", studentId);
  if (error) return { error: humanizeError(error) };
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true, message: "Рұқсат алынды" };
}
