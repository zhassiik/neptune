import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { coverUrl, formatPrice } from "@/lib/courses";
import { cn } from "@/lib/utils";
import type { Course } from "@/lib/types";
import { CourseCover } from "./CourseCover";

export function CourseCard({ course, variantsCount }: { course: Course; variantsCount?: number }) {
  const open = course.status === "published";
  const price = formatPrice(course.price);
  const href = `/courses/${course.slug}`;

  const body = (
    <>
      <div className="relative">
        <CourseCover url={coverUrl(course.cover_path)} title={course.title} />
        {!open && (
          <Badge tone="amber" className="absolute top-3 left-3 shadow-sm">
            <Clock className="size-3.5" /> Жақында ашылады
          </Badge>
        )}
      </div>
      <h3 className="mt-5 min-h-[3.25rem] text-lg leading-snug font-bold uppercase">{course.title}</h3>
      <div className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-500">
        {price && <span className="font-display text-2xl font-extrabold text-navy-900">{price}</span>}
        {open && variantsCount != null && variantsCount > 0 && <span>{variantsCount} нұсқа</span>}
      </div>
      {open ? (
        <span className={buttonClasses({ size: "lg", className: "mt-5 w-full" })}>
          Өту <ArrowRight className="size-5 transition group-hover:translate-x-0.5" />
        </span>
      ) : (
        <span className="mt-5 inline-flex h-13 w-full items-center justify-center rounded-xl bg-slate-100 font-semibold text-slate-500">Жақында</span>
      )}
    </>
  );

  const cls = "card group flex flex-col p-5 transition duration-200";
  return open ? (
    <Link href={href} className={cn(cls, "hover:-translate-y-0.5 hover:shadow-lift")}>
      {body}
    </Link>
  ) : (
    <article className={cn(cls, "opacity-90")} aria-label={`${course.title} — жақында ашылады`}>
      {body}
    </article>
  );
}
