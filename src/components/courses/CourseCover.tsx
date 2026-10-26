import Image from "next/image";
import { cn } from "@/lib/utils";

/** Курс мұқабасы. Сурет жүктелмесе — атауы бар градиентті мұқаба. */
export function CourseCover({ url, title, className, sizes = "(max-width: 768px) 100vw, 400px", priority }: { url: string | null; title: string; className?: string; sizes?: string; priority?: boolean }) {
  return (
    <div className={cn("relative aspect-video overflow-hidden rounded-2xl bg-navy-800", className)}>
      {url ? (
        <Image src={url} alt={title} fill sizes={sizes} className="object-cover" priority={priority} />
      ) : (
        <div className="absolute inset-0 flex items-end bg-[radial-gradient(circle_at_80%_10%,var(--color-brand-400),transparent_55%),linear-gradient(135deg,var(--color-navy-900),var(--color-brand-700))] p-5">
          <span className="line-clamp-3 font-display text-lg leading-tight font-extrabold text-white uppercase sm:text-xl">{title}</span>
        </div>
      )}
    </div>
  );
}
