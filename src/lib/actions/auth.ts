"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { humanizeError } from "@/lib/utils";
import { clientIpFromHeaders } from "@/lib/devices/network";
import { parseUserAgent } from "@/lib/devices/ua";
import { attachDeviceToSession, releaseCurrentDevice } from "@/lib/devices/server";
import { CAPTCHA_AFTER_FAILURES, hashEmail, loginRateRecord, loginRateStatus } from "@/lib/security/login-guard";
import { turnstileEnabled, verifyTurnstile } from "@/lib/security/turnstile";
import { notifyNewDevice } from "@/lib/security/notify";

export interface AuthState {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
  values?: Record<string, string>;
  /** Cloudflare Turnstile CAPTCHA көрсету керек */
  captchaRequired?: boolean;
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

  const hdrs = await headers();
  const ip = clientIpFromHeaders(hdrs);
  const emailHash = hashEmail(parsed.data.email);

  // Rate limit: email бойынша 15 минутта 5, IP бойынша 30 сәтсіз әрекет
  const rate = await loginRateStatus(emailHash, ip);
  if (rate && rate.retryAfter > 0) {
    return { error: `Тым көп сәтсіз әрекет жасалды. ${Math.max(1, Math.ceil(rate.retryAfter / 60))} минуттан кейін қайталаңыз`, values };
  }
  const captchaOn = turnstileEnabled() && (rate?.failures ?? 0) >= CAPTCHA_AFTER_FAILURES;
  if (captchaOn && !(await verifyTurnstile(formData.get("cf-turnstile-response"), ip))) {
    return { error: "Робот емес екеніңізді растаңыз", captchaRequired: true, values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (/Invalid login credentials/i.test(error.message)) await loginRateRecord(emailHash, ip, false);
    const failures = (rate?.failures ?? 0) + 1;
    return { error: humanizeError(error), values, captchaRequired: turnstileEnabled() && failures >= CAPTCHA_AFTER_FAILURES };
  }
  await loginRateRecord(emailHash, ip, true);

  // Құрылғы бақылауы: лимит толса — сессия бірден жабылады
  const device = await attachDeviceToSession(data.user.id, data.session?.access_token);
  if (!device.ok) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: device.message, values };
  }

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", data.user.id).maybeSingle();
  if (device.isNew && data.user.email) {
    const info = parseUserAgent(hdrs.get("user-agent"));
    void notifyNewDevice({ to: data.user.email, name: profile?.full_name ?? "", ...info, location: null });
  }
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

  const device = await attachDeviceToSession(data.user!.id, data.session.access_token);
  if (!device.ok) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: device.message, values };
  }

  revalidatePath("/", "layout");
  redirect(formData.get("next") ? safeNext(formData.get("next")) : "/courses");
}

export async function signOut() {
  const supabase = await createClient();
  const [{ data: userData }, { data: claims }] = await Promise.all([supabase.auth.getUser(), supabase.auth.getClaims()]);
  const sessionId = typeof claims?.claims?.session_id === "string" ? claims.claims.session_id : null;
  await supabase.auth.signOut({ scope: "local" });
  // Шыққан құрылғының орны босайды (лимитке есептелмейді)
  if (userData.user) await releaseCurrentDevice(userData.user.id, sessionId);
  revalidatePath("/", "layout");
  redirect("/");
}
