import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const DEFAULT_PLATFORM_NAME = "Neptune UBT | Жазира Тұрғымбай";

/**
 * Логотип + платформа атауы.
 * «Neptune UBT | Жазира Тұрғымбай» → жоғарғы жол «Neptune UBT», астында кішірек «Жазира Тұрғымбай».
 * tone="light" — күңгірт (ғарыш) фонға арналған ақ логотип.
 */
export function Logo({
  name = DEFAULT_PLATFORM_NAME,
  className,
  compact,
  tone = "dark",
}: {
  name?: string;
  className?: string;
  compact?: boolean;
  tone?: "dark" | "light";
}) {
  const [primary, ...rest] = name.split("|").map((s) => s.trim());
  const secondary = rest.join(" | ");
  const light = tone === "light";

  return (
    <Link href="/" className={cn("group inline-flex min-w-0 items-center gap-2.5 rounded-xl", className)} aria-label={`${name} — басты бет`}>
      <Image
        src={light ? "/brand/neptune-logo-light.png" : "/brand/neptune-logo.png"}
        alt=""
        width={379}
        height={228}
        priority
        className="h-11 w-auto shrink-0 transition group-hover:scale-105"
      />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className={cn("truncate font-display text-base font-extrabold tracking-tight sm:text-lg", light ? "text-white" : "text-navy-900")}>{primary}</span>
        {secondary && !compact && (
          <span className={cn("hidden truncate text-xs font-medium sm:block", light ? "text-neptune-200/80" : "text-slate-500")}>{secondary}</span>
        )}
      </span>
    </Link>
  );
}
