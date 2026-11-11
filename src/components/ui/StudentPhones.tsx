import { Phone, Users } from "lucide-react";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

/** Оқушының және ата-анасының телефоны (басқанда қоңырау шалады). Нөмір жоқ болса — ештеңе көрсетпейді */
export function StudentPhones({ phone, parentPhone, className }: { phone?: string | null; parentPhone?: string | null; className?: string }) {
  if (!phone && !parentPhone) return null;
  return (
    <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500", className)}>
      {phone && (
        <a href={`tel:${phone}`} className="inline-flex items-center gap-1 whitespace-nowrap transition hover:text-brand-600" title="Оқушының телефоны">
          <Phone className="size-3.5" aria-hidden /> {formatPhone(phone)}
        </a>
      )}
      {parentPhone && (
        <a href={`tel:${parentPhone}`} className="inline-flex items-center gap-1 whitespace-nowrap transition hover:text-brand-600" title="Ата-анасының телефоны">
          <Users className="size-3.5" aria-hidden /> Ата-ана: {formatPhone(parentPhone)}
        </a>
      )}
    </span>
  );
}
