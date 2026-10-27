import type { PlatformSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Бренд иконкалары (lucide-та жоқ) — қарапайым inline SVG */
const ICONS = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden>
      <path d="M21.9 4.6 18.7 19.7c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.2-8.3c.4-.4-.1-.6-.6-.2L6.1 13.4 1.2 11.9c-1-.3-1.1-1 .2-1.5L20.6 3c.9-.3 1.6.2 1.3 1.6Z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.3Z" />
    </svg>
  ),
};

export function socialLinks(s: Pick<PlatformSettings, "instagram_url" | "telegram_url" | "whatsapp_phone">) {
  const wa = s.whatsapp_phone?.replace(/\D/g, "");
  return [
    s.instagram_url && { key: "instagram" as const, href: s.instagram_url, label: "Instagram", tone: "bg-pink-50 text-pink-600 hover:bg-pink-100" },
    s.telegram_url && { key: "telegram" as const, href: s.telegram_url, label: "Telegram", tone: "bg-sky-50 text-sky-600 hover:bg-sky-100" },
    wa && { key: "whatsapp" as const, href: `https://wa.me/${wa}`, label: "WhatsApp", tone: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" },
  ].filter(Boolean) as { key: keyof typeof ICONS; href: string; label: string; tone: string }[];
}

export function SocialIcons({
  settings,
  className,
  dark,
}: {
  settings: Pick<PlatformSettings, "instagram_url" | "telegram_url" | "whatsapp_phone">;
  className?: string;
  /** Күңгірт (ғарыш) фонға арналған шыны түймелер */
  dark?: boolean;
}) {
  const links = socialLinks(settings);
  if (!links.length) return null;
  return (
    <ul className={cn("flex gap-3", className)}>
      {links.map((l) => (
        <li key={l.key}>
          <a
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={l.label}
            title={l.label}
            className={cn(
              "grid size-12 place-items-center rounded-full transition hover:-translate-y-0.5 active:scale-95",
              dark ? "border border-white/15 bg-white/5 text-white hover:border-neptune-400/60 hover:bg-white/10 hover:text-neptune-200" : l.tone,
            )}
          >
            {ICONS[l.key]}
          </a>
        </li>
      ))}
    </ul>
  );
}
