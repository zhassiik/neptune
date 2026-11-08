import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Бөлім тақырыбы: шағын «eyebrow» белгісі + тақырып + сипаттама (ашық және қараңғы фонға) */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  dark = false,
  align = "left",
  as: Tag = "h2",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  dark?: boolean;
  align?: "left" | "center";
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", align === "center" && "items-center text-center", className)}>
      {eyebrow && (
        <span
          className={cn(
            "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-bold tracking-[0.14em] uppercase",
            dark ? "glass-dark text-neptune-200" : "bg-brand-50 text-brand-700 ring-1 ring-brand-100",
          )}
        >
          <span className={cn("size-1.5 rounded-full", dark ? "bg-neptune-400 shadow-[0_0_8px_var(--color-neptune-400)]" : "bg-brand-500")} aria-hidden />
          {eyebrow}
        </span>
      )}
      <Tag className={cn("text-3xl leading-tight font-extrabold text-balance sm:text-4xl", Tag === "h1" && "sm:text-5xl", dark && "text-white")}>{title}</Tag>
      {subtitle && <p className={cn("max-w-2xl text-base leading-relaxed sm:text-lg", dark ? "text-white/70" : "text-slate-500")}>{subtitle}</p>}
    </div>
  );
}
