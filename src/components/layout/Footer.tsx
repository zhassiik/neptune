import { Mail, MapPin, Phone } from "lucide-react";
import { getPlatformSettings } from "@/lib/settings";
import { Logo } from "@/components/ui/Logo";
import { SocialIcons } from "@/components/landing/SocialIcons";

export async function Footer() {
  const s = await getPlatformSettings();
  const phoneHref = s.contact_phone ? `tel:${s.contact_phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <footer className="space-bg relative isolate mt-auto overflow-hidden border-t border-white/10">
      <div className="stars opacity-60" aria-hidden />
      <div className="relative container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <Logo name={s.platform_name} tone="light" />
          <p className="mt-4 max-w-xs text-sm text-white/60">ҰБТ математикасына авторлық нұсқалар мен видео-талдаулар арқылы дайындық.</p>
        </div>

        <div>
          <h2 className="text-base font-bold text-white">Мекенжай</h2>
          <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed whitespace-pre-line text-white/70">
            <MapPin className="mt-0.5 size-4 shrink-0 text-neptune-400" />
            {s.contact_address || "Қазақстан"}
          </p>
        </div>

        <div>
          <h2 className="text-base font-bold text-white">Байланыс</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {phoneHref && (
              <li>
                <a href={phoneHref} className="inline-flex items-center gap-2 text-neptune-300 underline-offset-4 hover:underline">
                  <Phone className="size-4" /> {s.contact_phone}
                </a>
              </li>
            )}
            {s.contact_email && (
              <li>
                <a href={`mailto:${s.contact_email}`} className="inline-flex items-center gap-2 text-white/70 transition hover:text-neptune-200">
                  <Mail className="size-4 text-neptune-400" /> {s.contact_email}
                </a>
              </li>
            )}
          </ul>
        </div>

        <div>
          <h2 className="text-base font-bold text-white">Әлеуметтік желілер</h2>
          <SocialIcons settings={s} className="mt-3" dark />
        </div>
      </div>
      <div className="relative border-t border-white/10 py-5 text-center text-xs text-white/45">
        © {new Date().getFullYear()} {s.platform_name}. Барлық құқықтар сақталған.
      </div>
    </footer>
  );
}
