"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { humanizeError } from "@/lib/utils";

export interface AuthState {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
  values?: Record<string, string>;
}

/** Ашық redirect-тен қорғау: тек ішкі жолдарға рұқсат */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/cabinet";
}

function collectFieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email енгізіңіз").email("Email форматы дұрыс емес"),
  password: z.string().min(1, "Құпиясөзді енгізіңіз"),
});

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { fieldErrors: collectFieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: humanizeError(error), values };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  revalidatePath("/", "layout");

  const next = formData.get("next");
  if (!next && profile?.role === "admin") redirect("/admin");
  redirect(safeNext(next));
}

const registerSchema = z
  .object({
    full_name: z.string().trim().min(2, "Аты-жөніңізді толық жазыңыз").max(120, "Тым ұзын"),
    email: z.string().trim().min(1, "Email енгізіңіз").email("Email форматы дұрыс емес"),
    password: z.string().min(8, "Құпиясөз кемінде 8 таңбадан тұруы керек").max(72, "Құпиясөз тым ұзын"),
    password_confirm: z.string(),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: "Құпиясөздер сәйкес келмейді",
    path: ["password_confirm"],
  });

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = Object.fromEntries(["full_name", "email", "password", "password_confirm"].map((k) => [k, String(formData.get(k) ?? "")]));
  const values = { full_name: raw.full_name, email: raw.email };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: collectFieldErrors(parsed.error), values };

  // Растау сілтемесі тіркелу жүрген адреске қайтуы керек (PKCE cookie сол адресте сақталады)
  const origin = (await headers()).get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${origin}/auth/callback?next=/courses`,
    },
  });
  if (error) return { error: humanizeError(error), values };

  // Supabase бар email үшін қате бермей, бос identities қайтарады
  if (data.user && data.user.identities?.length === 0) {
    return { error: "Бұл email бұрын тіркелген. Кіру бетін қолданыңыз", values };
  }

  if (!data.session) {
    return {
      message: "Тіркелу сәтті өтті! Поштаңызға жіберілген сілтеме арқылы email-ді растаңыз, содан кейін кіріңіз.",
      values,
    };
  }

  revalidatePath("/", "layout");
  redirect(formData.get("next") ? safeNext(formData.get("next")) : "/courses");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
