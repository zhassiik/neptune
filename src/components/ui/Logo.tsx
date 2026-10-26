import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const DEFAULT_PLATFORM_NAME = "Neptune UBT | Жазира Тұрғымбай";

/**
 * Логотип + платформа атауы.
 * «Neptune UBT | Жазира Тұрғымбай» → жоғарғы жол «Neptune UBT», астында кішірек «Жазира Тұрғымбай».
 */
export function Logo({ name = DEFAULT_PLATFORM_NAME, className, compact }: { name?: string; className?: string; compact?: boolean }) {
  const [primary, ...rest] = name.split("|").map((s) => s.trim());
  const secondary = rest.join(" | ");

  return (
    <Link href="/" className={cn("group inline-flex min-w-0 items-center gap-2.5 rounded-xl", className)} aria-label={`${name} — басты бет`}>
      <Image
        src="/brand/neptune-logo.png"
        alt=""
        width={379}
        height={228}
        priority
        className="h-11 w-auto shrink-0 transition group-hover:scale-105"
      />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-display text-base font-extrabold tracking-tight text-navy-900 sm:text-lg">{primary}</span>
        {secondary && !compact && <span className="hidden truncate text-xs font-medium text-slate-500 sm:block">{secondary}</span>}
      </span>
    </Link>
  );
}
