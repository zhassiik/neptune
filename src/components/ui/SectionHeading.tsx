import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Бөлім тақырыбы: тақырып + сипаттама (ашық және қараңғы фонға). Үстінде «eyebrow» белгісі жоқ — тақырыптың өзі сөйлейді */
export function SectionHeading({
  title,
  subtitle,
  dark = false,
  align = "left",
  as: Tag = "h2",
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  dark?: boolean;
  align?: "left" | "center";
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", align === "center" && "items-center text-center", className)}>
      <Tag className={cn("text-3xl leading-tight font-extrabold text-balance sm:text-4xl", Tag === "h1" && "sm:text-5xl", dark && "text-white")}>{title}</Tag>
      {subtitle && <p className={cn("max-w-2xl text-base leading-relaxed sm:text-lg", dark ? "text-white/70" : "text-slate-500")}>{subtitle}</p>}
    </div>
  );
}
