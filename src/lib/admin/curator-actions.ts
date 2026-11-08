"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { humanizeError } from "@/lib/utils";
import type { FormState } from "./actions";

/**
 * Кураторлар (тек әкімші): gmail бойынша куратор беру және курстарын бекіту.
 * Адам тіркелген болса — бірден куратор болады; тіркелмеген болса — шақыру сақталады,
 * сол email-мен тіркелген сәтте дерекқор триггері оны куратор етеді.
 */

const uuid = z.string().uuid();
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email тым ұзын")
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Email дұрыс емес (мысалы, name@gmail.com)");

function readCourses(fd: FormData) {
  const ids = [...new Set(fd.getAll("course_id").map(String))];
  return ids.every((id) => uuid.safeParse(id).success) ? ids : null;
}

function revalidate() {
  revalidatePath("/admin/curators");
  revalidatePath("/admin/students", "layout");
}

async function setAssignments(supabase: Awaited<ReturnType<typeof createClient>>, curatorId: string, courseIds: string[], adminId: string) {
  const { error: delError } = await supabase.from("course_curators").delete().eq("curator_id", curatorId);
  if (delError) return delError;
  if (!courseIds.length) return null;
  const { error } = await supabase.from("course_curators").insert(courseIds.map((course_id) => ({ course_id, curator_id: curatorId, created_by: adminId })));
  return error;
}

export async function addCurator(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await assertAdmin();
  const email = emailSchema.safeParse(fd.get("email") ?? "");
  if (!email.success) return { fieldErrors: { email: email.error.issues[0]?.message ?? "Email дұрыс емес" } };
  const courseIds = readCourses(fd);
  if (!courseIds) return { error: "Курс табылмады" };
  if (!courseIds.length) return { fieldErrors: { courses: "Кемінде бір курсты белгілеңіз" } };

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id, role, full_name").eq("email", email.data).maybeSingle();

  if (profile) {
    if (profile.id === admin.id) return { error: "Өз рөліңізді өзгерте алмайсыз" };
    if (profile.role === "admin") return { error: "Бұл адам — әкімші. Әкімшінің барлық курсқа рұқсаты бар" };
    if (profile.role !== "curator") {
      const { error } = await supabase.from("profiles").update({ role: "curator" }).eq("id", profile.id);
      if (error) return { error: humanizeError(error) };
    }
    const error = await setAssignments(supabase, profile.id, courseIds, admin.id);
    if (error) return { error: humanizeError(error) };
    revalidate();
    return { ok: true, message: `${profile.full_name || email.data} енді куратор` };
  }

  // Әлі тіркелмеген: шақыру — сол gmail-мен тіркелгенде куратор болады
  const { error } = await supabase.from("curator_invites").upsert({ email: email.data, course_ids: courseIds, created_by: admin.id }, { onConflict: "email" });
  if (error) return { error: humanizeError(error) };
  revalidate();
  return { ok: true, message: `${email.data} әлі тіркелмеген. Осы gmail-мен тіркелген сәтте автоматты түрде куратор болады` };
}

export async function updateCuratorCourses(curatorId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await assertAdmin();
  if (!uuid.safeParse(curatorId).success) return { error: "Куратор табылмады" };
  const courseIds = readCourses(fd);
  if (!courseIds) return { error: "Курс табылмады" };
  if (!courseIds.length) return { error: "Кемінде бір курсты белгілеңіз (куратор құқығын алу үшін «Куратор емес» батырмасын басыңыз)" };
  const supabase = await createClient();
  const error = await setAssignments(supabase, curatorId, courseIds, admin.id);
  if (error) return { error: humanizeError(error) };
  revalidate();
  return { ok: true, message: "Курстары сақталды" };
}

/** Куратор құқығын алу: қайтадан оқушы */
export async function removeCurator(curatorId: string): Promise<FormState> {
  const admin = await assertAdmin();
  if (!uuid.safeParse(curatorId).success) return { error: "Куратор табылмады" };
  if (curatorId === admin.id) return { error: "Өз рөліңізді өзгерте алмайсыз" };
  const supabase = await createClient();
  const { error: delError } = await supabase.from("course_curators").delete().eq("curator_id", curatorId);
  if (delError) return { error: humanizeError(delError) };
  const { error } = await supabase.from("profiles").update({ role: "student" }).eq("id", curatorId).eq("role", "curator");
  if (error) return { error: humanizeError(error) };
  revalidate();
  return { ok: true, message: "Куратор құқығы алынды" };
}

export async function cancelCuratorInvite(email: string): Promise<FormState> {
  await assertAdmin();
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { error: "Email дұрыс емес" };
  const supabase = await createClient();
  const { error } = await supabase.from("curator_invites").delete().eq("email", parsed.data);
  if (error) return { error: humanizeError(error) };
  revalidate();
  return { ok: true, message: "Шақыру алынды" };
}
