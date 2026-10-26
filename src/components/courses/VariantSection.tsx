import Link from "next/link";
import { ChevronDown, ClipboardList, Lock, PlayCircle, Trophy } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatMinutes, hasVideo, variantHeading } from "@/lib/video";
import type { TestVariant } from "@/lib/types";
import { StartAttemptButton } from "./StartAttemptButton";

export interface VariantProgress {
  activeAttemptId: string | null;
  lastScore: number | null;
  lastAttemptId: string | null;
  attemptsCount: number;
}

/** Курс бетіндегі бір бөлім: «НҰСҚА N. ...» → тест + видео-талдау */
export function VariantSection({
  variant,
  courseSlug,
  progress,
  loggedIn,
  defaultOpen,
  locked = false,
}: {
  variant: TestVariant;
  courseSlug: string;
  progress?: VariantProgress;
  loggedIn: boolean;
  defaultOpen?: boolean;
  /** Оқушы кірген, бірақ курсқа рұқсаты жоқ */
  locked?: boolean;
}) {
  const n = variant.position;
  const withVideo = hasVideo(variant);
  const lessons = withVideo ? 2 : 1;
  const lockedBadge = (
    <span className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-500" title="Бұл курсқа рұқсатыңыз жоқ">
      <Lock className="size-4" /> Рұқсат жоқ
    </span>
  );
  const loginHref = `/login?next=${encodeURIComponent(`/courses/${courseSlug}`)}`;
  const duration = formatMinutes(variant.video_duration_minutes);

  return (
    <details className="group card overflow-hidden" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-5 transition select-none hover:bg-slate-50/70 sm:px-7 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-5 shrink-0 text-slate-500 transition group-open:rotate-180" />
        <span className="min-w-0 flex-1 font-display text-base font-bold text-navy-900 sm:text-lg">{variantHeading(variant)}</span>
        {progress?.lastScore != null && (
          <Badge tone="green" className="hidden sm:inline-flex">
            <Trophy className="size-3.5" /> {progress.lastScore}/50
          </Badge>
        )}
        <span className="shrink-0 text-sm text-slate-500">{lessons} сабақ</span>
      </summary>

      <div className="border-t border-slate-100">
        {/* Тест */}
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">
              <ClipboardList className="size-5" />
            </span>
            <div>
              <div className="font-semibold text-navy-900">НҰСҚА №{n}</div>
              <div className="text-sm text-slate-500">
                40 сұрақ · макс. 50 балл{variant.time_limit_minutes ? ` · ${formatMinutes(variant.time_limit_minutes)}` : ""}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {locked ? (
              lockedBadge
            ) : !loggedIn ? (
              <Link href={loginHref} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100" title="Кіріп, бастаңыз">
                <Lock className="size-4" /> Кіру
              </Link>
            ) : progress?.activeAttemptId ? (
              <ButtonLink href={`/test/${progress.activeAttemptId}`} size="sm">
                Жалғастыру
              </ButtonLink>
            ) : (
              <>
                {progress?.lastAttemptId && (
                  <ButtonLink href={`/results/${progress.lastAttemptId}`} size="sm" variant="secondary">
                    Нәтиже: {progress.lastScore}/50
                  </ButtonLink>
                )}
                <StartAttemptButton variantId={variant.id} mode={progress?.attemptsCount ? "retake" : "start"} size="sm" returnTo={`/courses/${courseSlug}`} />
              </>
            )}
          </div>
        </div>

        {/* Видео-талдау */}
        {withVideo && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy-800 text-white">
                <PlayCircle className="size-5" />
              </span>
              <div>
                <div className="font-semibold text-navy-900">ТАЛДАУ №{n}</div>
                <div className="text-sm text-slate-500">Видео-талдау{duration ? ` · ${duration}` : ""}</div>
              </div>
            </div>
            {locked ? (
              lockedBadge
            ) : loggedIn ? (
              <ButtonLink href={`/courses/${courseSlug}/video/${variant.id}`} size="sm" variant="outline">
                <PlayCircle className="size-4" /> Көру
              </ButtonLink>
            ) : (
              <Link href={loginHref} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100">
                <Lock className="size-4" /> Кіру
              </Link>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
