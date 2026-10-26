import { Mail, MapPin, Phone } from "lucide-react";
import { getPlatformSettings } from "@/lib/settings";
import { Logo } from "@/components/ui/Logo";

export async function Footer() {
  const s = await getPlatformSettings();
  return (
    <footer className="mt-auto border-t border-slate-100 bg-slate-50/60">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2">
        <div>
          <Logo name={s.platform_name} />
          <p className="mt-3 max-w-sm text-sm text-slate-500">
            ҰБТ форматындағы нұсқалармен дайындалып, нәтижеңізді бірден біліңіз.
          </p>
        </div>
        <div className="sm:justify-self-end">
          <h2 className="text-sm font-bold tracking-wide text-navy-900 uppercase">Байланыс</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {s.contact_email && (
              <li>
                <a href={`mailto:${s.contact_email}`} className="inline-flex items-center gap-2 transition hover:text-brand-600">
                  <Mail className="size-4 text-brand-500" /> {s.contact_email}
                </a>
              </li>
            )}
            {s.contact_phone && (
              <li>
                <a href={`tel:${s.contact_phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 transition hover:text-brand-600">
                  <Phone className="size-4 text-brand-500" /> {s.contact_phone}
                </a>
              </li>
            )}
            {s.contact_address && (
              <li className="inline-flex items-center gap-2">
                <MapPin className="size-4 text-brand-500" /> {s.contact_address}
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-100 py-5 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {s.platform_name}. Барлық құқықтар қорғалған.
      </div>
    </footer>
  );
}
