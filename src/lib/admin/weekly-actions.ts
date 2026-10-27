"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { humanizeError } from "@/lib/utils";
import { almatyWindow } from "@/lib/weekly";
import type { FormState } from "./actions";

const uuid = z.string().uuid();

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

const weekSchema = z.object({
  title: z.string().trim().min(2, "Атауын жазыңыз (мысалы, 1-апта)").max(80, "Тым ұзын"),
  position: z
    .string()
    .trim()
    .transform((v) => Number(v || 1))
    .refine((v) => Number.isInteger(v) && v >= 1 && v <= 1000, "Реті 1–1000"),
  is_published: z.boolean(),
});

function readWeek(fd: FormData) {
  return weekSchema.safeParse({ title: String(fd.get("title") ?? ""), position: String(fd.get("position") ?? ""), is_published: fd.get("is_published") === "on" });
}

export async function createWeek(_prev: FormState, fd: FormData): Promise<FormState> {
  await assertAdmin();
  const courseId = uuid.safeParse(fd.get("course_id"));
  if (!courseId.success) return { fieldErrors: { course_id: "Курсты таңдаңыз" } };
  const parsed = readWeek(fd);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("contest_weeks").insert({ ...parsed.data, course_id: courseId.data }).select("id").single();
  if (error) return { error: humanizeError(error) };
  revalidatePath("/admin/weekly");
  redirect(`/admin/weekly/${data.id}?created=1`);
}

export async function updateWeek(weekId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(weekId).success) return { error: "Апта табылмады" };
  const parsed = readWeek(fd);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("contest_weeks").update(parsed.data).eq("id", weekId);
  if (error) return { error: humanizeError(error) };
  revalidatePath("/admin/weekly", "layout");
  revalidatePath("/courses", "layout");
  return { ok: true, message: "Апта сақталды" };
}

export async function deleteWeek(weekId: string): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(weekId).success) return { error: "Апта табылмады" };
  const supabase = await createClient();
  // Нұсқалар өшпейді: week_id = null болады (FK on delete set null); үй жұмысы бағалары сақталады
  const { error } = await supabase.from("contest_weeks").delete().eq("id", weekId);
  if (error) return { error: humanizeError(error) };
  revalidatePath("/admin/weekly", "layout");
  revalidatePath("/courses", "layout");
  return { ok: true, message: "Апта өшірілді" };
}

/**
 * Нұсқаның апталық кестесі: аптаға қосу, конкурс уақыты (Алматы), Classroom сілтемесі және дедлайн.
 */
export async function saveVariantSchedule(weekId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await assertAdmin();
  const variantId = uuid.safeParse(fd.get("variant_id"));
  if (!uuid.safeParse(weekId).success || !variantId.success) return { error: "Деректер дұрыс емес" };

  const inWeek = fd.get("in_week") === "on";
  const date = String(fd.get("date") ?? "").trim();
  const from = String(fd.get("from") ?? "").trim();
  const to = String(fd.get("to") ?? "").trim();
  const classroom = String(fd.get("classroom_url") ?? "").trim();
  const deadline = String(fd.get("homework_deadline") ?? "").trim();

  let window: { startsAt: string; endsAt: string } | null = null;
  if (date || from || to) {
    window = almatyWindow(date, from, to);
    if (!window) return { fieldErrors: { window: "Күнді және уақыт аралығын толық енгізіңіз (мысалы, 05:00–06:30)" } };
  }
  if (inWeek && !window) return { fieldErrors: { window: "Апта үздігі үшін күн мен уақыт аралығын енгізіңіз" } };
  if (classroom && !/^https:\/\/\S+$/.test(classroom)) return { fieldErrors: { classroom_url: "Сілтеме https:// деп басталуы керек" } };
  if (deadline && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline)) return { fieldErrors: { homework_deadline: "Дедлайнды таңдаңыз" } };

  const supabase = await createClient();
  const { error } = await supabase
    .from("test_variants")
    .update({
      week_id: inWeek ? weekId : null,
      contest_starts_at: inWeek ? window!.startsAt : null,
      contest_ends_at: inWeek ? window!.endsAt : null,
      classroom_url: classroom || null,
      homework_deadline: deadline ? `${deadline}:00+05:00` : null,
    })
    .eq("id", variantId.data);
  if (error) return { error: humanizeError(error) };
  revalidatePath(`/admin/weekly/${weekId}`);
  revalidatePath("/courses", "layout");
  return { ok: true, message: inWeek ? "Сақталды: нұсқа аптаға қосылды" : "Сақталды" };
}

const statusSchema = z.enum(["on_time", "late", "missing"]).nullable();

/** Куратор: оқушының черновик/конспект күйін белгілеу (бос — «тексерілмеді») */
export async function setHomeworkStatus(variantId: string, studentId: string, kind: "draft" | "notes", status: string | null): Promise<FormState> {
  const admin = await assertAdmin();
  const parsed = statusSchema.safeParse(status || null);
  if (!uuid.safeParse(variantId).success || !uuid.safeParse(studentId).success || !parsed.success) return { error: "Деректер дұрыс емес" };
  const supabase = await createClient();
  const column = kind === "draft" ? "draft_status" : "notes_status";
  const { error } = await supabase
    .from("homework_checks")
    .upsert({ variant_id: variantId, student_id: studentId, [column]: parsed.data, checked_by: admin.id }, { onConflict: "variant_id,student_id" });
  if (error) return { error: humanizeError(error) };
  revalidatePath("/courses", "layout");
  return { ok: true };
}
