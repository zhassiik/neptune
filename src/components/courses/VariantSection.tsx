import Link from "next/link";
import { CalendarClock, ChevronDown, ClipboardList, ExternalLink, Lock, NotebookPen, PlayCircle, Trophy, Zap } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatMinutes, hasVideo, variantHeading } from "@/lib/video";
import { contestPhase, formatPoints, formatWindow, homeworkPoints, HOMEWORK_LABELS } from "@/lib/weekly";
import { cn, formatDateTime } from "@/lib/utils";
import type { HomeworkCheck, HomeworkStatus, TestVariant } from "@/lib/types";
import { StartAttemptButton } from "./StartAttemptButton";

export interface VariantProgress {
  activeAttemptId: string | null;
  lastScore: number | null;
  lastAttemptId: string | null;
  attemptsCount: number;
}

const STATUS_TONE: Record<HomeworkStatus, string> = {
  on_time: "bg-emerald-50 text-emerald-700",
  late: "bg-amber-50 text-amber-800",
  missing: "bg-red-50 text-red-700",
};

/** Курс бетіндегі бір бөлім: «НҰСҚА N. ...» → тест + видео-талдау + черновик/конспект */
export function VariantSection({
  variant,
  courseSlug,
  progress,
  loggedIn,
  defaultOpen,
  locked = false,
  homework,
  weekTitle,
  isAdmin = false,
}: {
  variant: TestVariant;
  courseSlug: string;
  progress?: VariantProgress;
  loggedIn: boolean;
  defaultOpen?: boolean;
  /** Оқушы кірген, бірақ курсқа рұқсаты жоқ */
  locked?: boolean;
  /** Оқушының черновик/конспект бағасы */
  homework?: HomeworkCheck;
  weekTitle?: string;
  isAdmin?: boolean;
}) {
  const n = variant.position;
  const withVideo = hasVideo(variant);
  const withHomework = !!variant.classroom_url;
  const lessons = 1 + (withVideo ? 1 : 0) + (withHomework ? 1 : 0);
  const phase = contestPhase(variant.contest_starts_at, variant.contest_ends_at);
  const notYetOpen = phase === "upcoming" && !isAdmin;
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
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-bold text-navy-900 sm:text-lg">{variantHeading(variant)}</span>
          {weekTitle && phase !== "none" && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
              <Trophy className="size-3.5" /> Апта үздігі · {weekTitle}
            </span>
          )}
        </span>
        {progress?.lastScore != null && (
          <Badge tone="green" className="hidden sm:inline-flex">
            <Trophy className="size-3.5" /> {progress.lastScore}/50
          </Badge>
        )}
        <span className="shrink-0 text-sm text-slate-500">{lessons} сабақ</span>
      </summary>

      <div className="border-t border-slate-100">
        {/* Апта үздігі: уақыт аралығы */}
        {phase !== "none" && variant.contest_starts_at && variant.contest_ends_at && (
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 px-5 py-3 text-sm sm:px-7",
              phase === "live" ? "bg-emerald-50 text-emerald-800" : phase === "upcoming" ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-600",
            )}
          >
            {phase === "live" ? <Zap className="size-4" /> : <CalendarClock className="size-4" />}
            <span>
              <b>Апта үздігі:</b> {formatWindow(variant.contest_starts_at, variant.contest_ends_at)}.{" "}
              {phase === "upcoming" && "Нұсқа осы уақытта ашылады — тек осы аралықтағы бірінші талпыныс есептеледі."}
              {phase === "live" && "Қазір жүріп жатыр! Аралық ішінде басталып, тапсырылған бірінші талпыныс есептеледі."}
              {phase === "ended" && "Аяқталды. Енді нұсқаны жаттығу үшін тапсыра аласыз (рейтингке есептелмейді)."}
            </span>
          </div>
        )}

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
            ) : notYetOpen ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                <Lock className="size-4" /> {formatDateTime(variant.contest_starts_at)}-де ашылады
              </span>
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

        {/* Черновик және конспект */}
        {withHomework && (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600">
                <NotebookPen className="size-5" />
              </span>
              <div>
                <div className="font-semibold text-navy-900">Черновик және конспект</div>
                <div className="text-sm text-slate-500">
                  {variant.homework_deadline ? (
                    <>
                      Дедлайн: <b className="text-navy-900">{formatDateTime(variant.homework_deadline)}</b>
                    </>
                  ) : (
                    "Classroom-ға салыңыз"
                  )}{" "}
                  · черновик +5, конспект +10 (кешіксе — жартысы)
                </div>
                {loggedIn && !locked && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
                    {(["draft", "notes"] as const).map((kind) => {
                      const status = kind === "draft" ? homework?.draft_status : homework?.notes_status;
                      const label = kind === "draft" ? "Черновик" : "Конспект";
                      return status ? (
                        <span key={kind} className={cn("rounded-full px-2.5 py-1", STATUS_TONE[status])}>
                          {label}: {HOMEWORK_LABELS[status]} (+{formatPoints(homeworkPoints(status, kind))})
                        </span>
                      ) : (
                        <span key={kind} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">
                          {label}: тексерілмеді
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {locked ? (
              lockedBadge
            ) : loggedIn ? (
              <a
                href={variant.classroom_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 text-sm font-semibold text-white transition hover:bg-amber-600 active:scale-[0.97]"
              >
                Classroom-ға салу <ExternalLink className="size-4" />
              </a>
            ) : (
              <Link href={loginHref} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100">
                <Lock className="size-4" /> Кіру
              </Link>
            )}
          </div>
        )}

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
