import type { PlatformSettings } from "@/lib/types";

/**
 * «Курсқа қосылу» батырмасы қайда апарады:
 * 1) Баптаулардағы сілтеме (мысалы, WhatsApp); 2) WhatsApp нөмірі (дайын хабарламамен); 3) курс беті.
 */
export function joinCta(settings: Pick<PlatformSettings, "join_url" | "whatsapp_phone">, fallbackHref: string) {
  if (settings.join_url) return { href: settings.join_url, external: true };
  const digits = settings.whatsapp_phone?.replace(/\D/g, "");
  if (digits) {
    const text = encodeURIComponent("Сәлеметсіз бе! Курсқа қосылғым келеді");
    return { href: `https://wa.me/${digits}?text=${text}`, external: true };
  }
  return { href: fallbackHref, external: false };
}
