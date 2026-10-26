import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";

export function Pagination({ page, totalPages, buildHref }: { page: number; totalPages: number; buildHref: (page: number) => string }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Беттер">
      {page > 1 ? (
        <Link href={buildHref(page - 1)} className={buttonClasses({ variant: "outline", size: "sm" })}>
          <ChevronLeft className="size-4" /> Алдыңғы
        </Link>
      ) : (
        <span className={buttonClasses({ variant: "outline", size: "sm", className: "pointer-events-none opacity-40" })}>
          <ChevronLeft className="size-4" /> Алдыңғы
        </span>
      )}
      <span className="px-3 text-sm font-medium text-slate-600">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={buildHref(page + 1)} className={buttonClasses({ variant: "outline", size: "sm" })}>
          Келесі <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className={buttonClasses({ variant: "outline", size: "sm", className: "pointer-events-none opacity-40" })}>
          Келесі <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
