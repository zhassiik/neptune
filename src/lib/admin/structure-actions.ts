"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteStreamVideo } from "@/lib/cloudflare/stream";
import { isUidInUse } from "@/lib/stream-uploads/server";
import { PLANET_KEYS } from "@/lib/planets";
import { humanizeError } from "@/lib/utils";
import type { FormState } from "./actions";

/**
 * Курс құрылымы (тек әкімші): кіріспе видео, ғаламшар-блоктар, сабақтар (видео / еркін тест).
 * RLS: course_modules / module_lessons жазу — тек is_admin().
 */

const uuid = z.string().uuid();

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

const position = z
  .string()
  .trim()
  .transform((v) => (v ? Number(v) : null))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 1000), "Реті 1–1000");

const moduleSchema = z.object({
  title: z.string().trim().min(1, "Блоктың атын жазыңыз").max(120, "Тым ұзын"),
  planet: z.enum(PLANET_KEYS, { message: "Ғаламшарды таңдаңыз" }),
  position,
  is_published: z.boolean(),
});

const lessonSchema = z.object({
  title: z.string().trim().min(1, "Сабақтың атын жазыңыз").max(150, "Тым ұзын"),
  position,
  is_published: z.boolean(),
});

function revalidateCourse(courseId: string) {
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses", "layout");
}

async function nextPosition(table: "course_modules" | "module_lessons", column: "course_id" | "module_id", id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from(table).select("position").eq(column, id).order("position", { ascending: false }).limit(1).maybeSingle();
  return Math.min(1000, ((data?.position as number | undefined) ?? 0) + 1);
}

/* ------------------------------ Блоктар ------------------------------ */

export async function createModule(courseId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(courseId).success) return { error: "Курс табылмады" };
  const parsed = moduleSchema.safeParse({ title: fd.get("title") ?? "", planet: fd.get("planet") ?? "", position: fd.get("position") ?? "", is_published: true });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const pos = parsed.data.position ?? (await nextPosition("course_modules", "course_id", courseId));
  const { error } = await supabase.from("course_modules").insert({ ...parsed.data, position: pos, course_id: courseId });
  if (error) return { error: humanizeError(error) };
  revalidateCourse(courseId);
  return { ok: true, message: "Блок қосылды" };
}

export async function updateModule(moduleId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(moduleId).success) return { error: "Блок табылмады" };
  const parsed = moduleSchema.safeParse({
    title: fd.get("title") ?? "",
    planet: fd.get("planet") ?? "",
    position: fd.get("position") ?? "",
    is_published: fd.get("is_published") === "on",
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_modules")
    .update({ ...parsed.data, position: parsed.data.position ?? 1 })
    .eq("id", moduleId)
    .select("course_id")
    .single();
  if (error) return { error: humanizeError(error) };
  revalidateCourse(data.course_id);
  return { ok: true, message: "Блок сақталды" };
}

export async function deleteModule(moduleId: string): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(moduleId).success) return { error: "Блок табылмады" };
  const supabase = await createClient();
  const { data: mod } = await supabase.from("course_modules").select("course_id").eq("id", moduleId).maybeSingle();
  if (!mod) return { error: "Блок табылмады" };
  const { data: lessons } = await supabase.from("module_lessons").select("id, kind, variant_id, video_provider, cloudflare_video_uid").eq("module_id", moduleId);
  // Блоктың тесттері (practice нұсқалар) де өшеді — сұрақтары мен нәтижелерімен
  const variantIds = (lessons ?? []).map((l) => l.variant_id).filter(Boolean) as string[];
  if (variantIds.length) {
    const { error } = await supabase.from("test_variants").delete().in("id", variantIds);
    if (error) return { error: humanizeError(error) };
  }
  const { error } = await supabase.from("course_modules").delete().eq("id", moduleId);
  if (error) return { error: humanizeError(error) };
  await cleanupVideos((lessons ?? []).map((l) => (l.video_provider === "cloudflare" ? l.cloudflare_video_uid : null)));
  revalidateCourse(mod.course_id);
  return { ok: true, message: "Блок өшірілді" };
}

/* ------------------------------ Сабақтар ------------------------------ */

export async function createLesson(moduleId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await assertAdmin();
  if (!uuid.safeParse(moduleId).success) return { error: "Блок табылмады" };
  const kind = fd.get("kind") === "test" ? "test" : "video";
  const parsed = lessonSchema.safeParse({ title: fd.get("title") ?? "", position: fd.get("position") ?? "", is_published: true });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { data: mod } = await supabase.from("course_modules").select("course_id").eq("id", moduleId).maybeSingle();
  if (!mod) return { error: "Блок табылмады" };
  const pos = parsed.data.position ?? (await nextPosition("module_lessons", "module_id", moduleId));

  let variantId: string | null = null;
  if (kind === "test") {
    // Еркін тест — practice нұсқа (сұрақтары бұрынғы редактормен қосылады)
    const { data: v, error } = await supabase
      .from("test_variants")
      .insert({ title: parsed.data.title.padEnd(3, "."), subject: "Математика", course_id: mod.course_id, kind: "practice", status: "draft", position: 1, created_by: user.id })
      .select("id")
      .single();
    if (error) return { error: humanizeError(error) };
    variantId = v.id;
  }

  const { error } = await supabase.from("module_lessons").insert({
    course_id: mod.course_id,
    module_id: moduleId,
    kind,
    title: parsed.data.title,
    position: pos,
    is_published: true,
    variant_id: variantId,
  });
  if (error) {
    if (variantId) await supabase.from("test_variants").delete().eq("id", variantId);
    return { error: humanizeError(error) };
  }
  revalidateCourse(mod.course_id);
  // Тест құрылса — бірден сұрақ қосуға өтеміз
  if (variantId) redirect(`/admin/variants/${variantId}`);
  return { ok: true, message: "Сабақ қосылды. Енді видеосын жүктеңіз" };
}

export async function updateLesson(lessonId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(lessonId).success) return { error: "Сабақ табылмады" };
  const parsed = lessonSchema.safeParse({ title: fd.get("title") ?? "", position: fd.get("position") ?? "", is_published: fd.get("is_published") === "on" });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("module_lessons")
    .update({ ...parsed.data, position: parsed.data.position ?? 1 })
    .eq("id", lessonId)
    .select("course_id, variant_id")
    .single();
  if (error) return { error: humanizeError(error) };
  // Тест атауы нәтижелер бетінде де көрінеді — нұсқа атауын да жаңартамыз
  if (data.variant_id && parsed.data.title.length >= 3) await supabase.from("test_variants").update({ title: parsed.data.title }).eq("id", data.variant_id);
  revalidateCourse(data.course_id);
  return { ok: true, message: "Сабақ сақталды" };
}

export async function deleteLesson(lessonId: string): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(lessonId).success) return { error: "Сабақ табылмады" };
  const supabase = await createClient();
  const { data: lesson } = await supabase.from("module_lessons").select("course_id, variant_id, video_provider, cloudflare_video_uid").eq("id", lessonId).maybeSingle();
  if (!lesson) return { error: "Сабақ табылмады" };
  const { error } = lesson.variant_id
    ? await supabase.from("test_variants").delete().eq("id", lesson.variant_id) // сабақ та бірге өшеді (cascade)
    : await supabase.from("module_lessons").delete().eq("id", lessonId);
  if (error) return { error: humanizeError(error) };
  await cleanupVideos([lesson.video_provider === "cloudflare" ? lesson.cloudflare_video_uid : null]);
  revalidateCourse(lesson.course_id);
  return { ok: true, message: "Сабақ өшірілді" };
}

/** Курсқа кіріспе видео сабағын құру (бір курсқа біреу) */
export async function ensureIntroLesson(courseId: string): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(courseId).success) return { error: "Курс табылмады" };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("module_lessons").select("id").eq("course_id", courseId).eq("kind", "intro").maybeSingle();
  if (!existing) {
    const { error } = await supabase.from("module_lessons").insert({ course_id: courseId, kind: "intro", title: "Курсқа кіріспе", position: 1 });
    if (error) return { error: humanizeError(error) };
  }
  revalidateCourse(courseId);
  return { ok: true };
}

/** Өшірілген сабақтардың Cloudflare видеолары — басқа жерде қолданылмаса, Cloudflare-дан да өшіріледі */
async function cleanupVideos(uids: (string | null | undefined)[]) {
  const list = uids.filter((u): u is string => !!u && /^[a-f0-9]{32}$/.test(u));
  if (!list.length) return;
  try {
    const admin = createAdminClient();
    for (const uid of list) {
      if (await isUidInUse(admin, uid)) continue;
      await deleteStreamVideo(uid).catch((e) => console.error("[structure] delete video:", e instanceof Error ? e.message : e));
      await admin.from("stream_videos").update({ deleted_at: new Date().toISOString(), replaced_at: new Date().toISOString() }).eq("cloudflare_uid", uid);
    }
  } catch (e) {
    console.error("[structure] cleanup:", e instanceof Error ? e.message : e);
  }
}
