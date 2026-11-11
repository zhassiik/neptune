"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { humanizeError } from "@/lib/utils";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";
import { contactFields, DIFFERENT_PHONES_ERROR, differentPhones, fullNameField } from "@/lib/profile-schema";

export interface ProfileFormState {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

/** Оқушыға телефондар міндетті */
const studentSchema = z.object({ full_name: fullNameField, ...contactFields }).refine(differentPhones, DIFFERENT_PHONES_ERROR);

/** Әкімші мен куратор үшін телефондар міндетті емес */
const optionalPhone = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return null;
    const phone = normalizePhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: PHONE_ERROR });
      return z.NEVER;
    }
    return phone;
  });
const staffSchema = z.object({ full_name: fullNameField, phone: optionalPhone, parent_phone: optionalPhone });

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/courses";
}

/** Өз профилін сақтау: аты-жөні, телефоны, ата-анасының телефоны */
export async function updateProfile(_prev: ProfileFormState, fd: FormData): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Қайта кіріңіз" };

  const raw = { full_name: String(fd.get("full_name") ?? ""), phone: String(fd.get("phone") ?? ""), parent_phone: String(fd.get("parent_phone") ?? "") };
  const isStudent = (user.profile?.role ?? "student") === "student";
  const parsed = isStudent ? studentSchema.safeParse(raw) : staffSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { error: humanizeError(error) };

  revalidatePath("/", "layout");
  // Алғаш толтыру: сақтаған соң оқуға қайтарамыз
  if (fd.get("complete") === "1") redirect(safeNext(fd.get("next")));
  return { ok: true, message: "Профиль сақталды" };
}
