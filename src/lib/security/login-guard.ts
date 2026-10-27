import "server-only";
import { createHash } from "node:crypto";
import { deviceServiceClient } from "@/lib/devices/register";

/** Осынша сәтсіз әрекеттен кейін CAPTCHA сұралады (Turnstile бапталған болса) */
export const CAPTCHA_AFTER_FAILURES = 3;

export function hashEmail(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/** null — rate limit қолжетімсіз (migration жоқ / сервер баптауы) — кіруге кедергі жасамаймыз */
export async function loginRateStatus(emailHash: string, ip: string | null) {
  const sb = deviceServiceClient();
  if (!sb) return null;
  const { data, error } = await sb.rpc("login_rate_status", { p_email_hash: emailHash, p_ip: ip });
  if (error) return null;
  const r = data as { email_failures: number; ip_failures: number; retry_after_seconds: number };
  return { failures: r.email_failures, retryAfter: r.retry_after_seconds };
}

export async function loginRateRecord(emailHash: string, ip: string | null, success: boolean) {
  const sb = deviceServiceClient();
  if (!sb) return;
  await sb.rpc("login_rate_record", { p_email_hash: emailHash, p_ip: ip, p_success: success });
}
