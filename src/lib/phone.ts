/**
 * Телефон нөмірі: «8 700 123 45 67», «+7 (700) 123-45-67», «7001234567» → «+77001234567».
 * Қазақстан нөмірлері (+7) үшін 10 немесе 11 цифр; басқа елдер — «+» және 11–15 цифр.
 * Дұрыс емес болса — null.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  if (/[^\d\s()+\-.]/.test(raw)) return null;
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) {
    return digits.length >= 11 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 11 && (digits.startsWith("8") || digits.startsWith("7"))) return `+7${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("7")) return `+7${digits}`;
  return null;
}

/** «+77001234567» → «+7 700 123 45 67» (басқа форматтар өзгеріссіз) */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const m = /^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return m ? `+7 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

export const PHONE_ERROR = "Нөмір дұрыс емес. Мысалы: +7 700 123 45 67";
