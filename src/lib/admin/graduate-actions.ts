"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { humanizeError } from "@/lib/utils";
import type { FormState } from "./actions";

const uuid = z.string().uuid();
const imagePath = z
  .string()
  .regex(/^(graduates\/[\w-]+\.(webp|jpg|png))?$/, "Сурет жолы дұрыс емес")
  .transform((v) => v || null);

const graduateSchema = z.object({
  student_name: z.string().trim().min(2, "Түлектің атын жазыңыз").max(80, "Тым ұзын"),
  score: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 140), "Балл 0–140 аралығында болуы керек"),
  score_label: z.string().trim().max(40, "Тым ұзын").transform((v) => v || null),
  text: z.string().trim().min(10, "Пікір мәтіні кемінде 10 таңба").max(4000, "Тым ұзын"),
  photo_path: imagePath,
  certificate_path: imagePath,
  position: z
    .string()
    .trim()
    .transform((v) => Number(v || 1))
    .refine((v) => Number.isInteger(v) && v >= 1 && v <= 1000, "Реті 1–1000"),
  is_published: z.boolean(),
});

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

function readGraduate(fd: FormData) {
  return graduateSchema.safeParse({
    ...Object.fromEntries(["student_name", "score", "score_label", "text", "photo_path", "certificate_path", "position"].map((k) => [k, String(fd.get(k) ?? "")])),
    is_published: fd.get("is_published") === "on",
  });
}

/** Ауыстырылған/өшірілген суреттерді Storage-тан тазалау */
async function removeImages(supabase: Awaited<ReturnType<typeof createClient>>, paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await supabase.storage.from("site-media").remove(list);
}

export async function createGraduate(_prev: FormState, fd: FormData): Promise<FormState> {
  await assertAdmin();
  const parsed = readGraduate(fd);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("graduates").insert(parsed.data);
  if (error) return { error: humanizeError(error) };
  revalidatePath("/", "layout");
  redirect("/admin/graduates?saved=1");
}

export async function updateGraduate(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(id).success) return { error: "Түлек табылмады" };
  const parsed = readGraduate(fd);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { data: prev } = await supabase.from("graduates").select("photo_path, certificate_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("graduates").update(parsed.data).eq("id", id);
  if (error) return { error: humanizeError(error) };
  await removeImages(supabase, [
    prev?.photo_path !== parsed.data.photo_path ? prev?.photo_path : null,
    prev?.certificate_path !== parsed.data.certificate_path ? prev?.certificate_path : null,
  ]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Түлек сақталды" };
}

export async function deleteGraduate(id: string): Promise<FormState> {
  await assertAdmin();
  if (!uuid.safeParse(id).success) return { error: "Түлек табылмады" };
  const supabase = await createClient();
  const { data: prev } = await supabase.from("graduates").select("photo_path, certificate_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("graduates").delete().eq("id", id);
  if (error) return { error: humanizeError(error) };
  await removeImages(supabase, [prev?.photo_path, prev?.certificate_path]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Түлек өшірілді" };
}
