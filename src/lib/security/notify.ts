import "server-only";
import { cleanText } from "@/lib/devices/ua";

/**
 * Optional: жаңа құрылғыдан кіру туралы email (Resend: RESEND_API_KEY + EMAIL_FROM).
 * Тек мәтін (HTML емес) — User-Agent ішіндегі мәтін инъекциясынан қауіпсіз.
 */
export function newDeviceEmailEnabled() {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function notifyNewDevice(input: { to: string; name: string; deviceName: string; browser: string; os: string; location: string | null }) {
  if (!newDeviceEmailEnabled() || !input.to) return;
  const when = new Intl.DateTimeFormat("kk-KZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Almaty" }).format(new Date());
  const text = [
    `Сәлем, ${cleanText(input.name, 80) || "оқушы"}!`,
    "",
    "Аккаунтыңызға жаңа құрылғыдан кіру тіркелді:",
    `• Құрылғы: ${cleanText(input.deviceName, 80)}`,
    `• Браузер: ${cleanText(input.browser, 60)} (${cleanText(input.os, 60)})`,
    input.location ? `• Шамамен орналасуы: ${cleanText(input.location, 80)}` : null,
    `• Уақыты: ${when}`,
    "",
    "Бұл сіз болмасаңыз, «Менің құрылғыларым» бөлімінен бұл құрылғыны өшіріп, құпиясөзіңізді ауыстырыңыз.",
  ]
    .filter((l) => l !== null)
    .join("\n");
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [input.to], subject: "Жаңа құрылғыдан кіру", text }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error("[notify] new device email failed", e instanceof Error ? e.message : e);
  }
}
