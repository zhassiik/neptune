import "server-only";

/** Optional: Cloudflare Turnstile CAPTCHA (NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY) */
export function turnstileEnabled() {
  return !!(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(token: FormDataEntryValue | null, ip: string | null): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (typeof token !== "string" || !token) return false;
  const body = new FormData();
  body.set("secret", process.env.TURNSTILE_SECRET_KEY!);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(8000) });
    const json = (await res.json()) as { success?: boolean };
    return !!json.success;
  } catch {
    return false;
  }
}
