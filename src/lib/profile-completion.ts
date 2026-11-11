import type { Profile } from "@/lib/types";

/**
 * Оқушының телефоны немесе ата-анасының телефоны жоқ па.
 * Миграция 20261113 әлі іске қосылмаса, бағандар жоқ (undefined) — ештеңе сұрамаймыз.
 */
export function needsContacts(profile: Pick<Profile, "role" | "phone" | "parent_phone"> | null | undefined) {
  if (!profile || profile.role !== "student") return false;
  return profile.phone === null || profile.parent_phone === null;
}

/** Профиль толтырылмағанда қай бетке жіберу керек (null — осы бетте қала береді) */
export function profileCompletionRedirect(pathname: string) {
  const allowed = ["/cabinet/profile", "/login", "/register", "/auth"];
  if (allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return `/cabinet/profile?complete=1&next=${encodeURIComponent(pathname)}`;
}
