import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Ішкі беттердің жоғарғы бөлігі: басты беттегідей ғарыш фоны, жұлдыздар және жұмсақ жарқыл */
export function SpaceBand({ children, className, innerClassName }: { children: ReactNode; className?: string; innerClassName?: string }) {
  return (
    <section className={cn("space-bg relative isolate overflow-hidden", className)}>
      <div className="stars stars-drift" aria-hidden />
      <div
        className="pointer-events-none absolute -top-24 right-[8%] -z-10 size-72 rounded-full bg-[radial-gradient(circle,rgb(79_220_251/0.22),transparent_65%)] blur-2xl"
        aria-hidden
      />
      <div className={cn("relative container-page py-10 sm:py-14", innerClassName)}>{children}</div>
    </section>
  );
}
