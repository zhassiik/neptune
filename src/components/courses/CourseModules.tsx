import Link from "next/link";
import { ChevronDown, ClipboardList, Lock, PlayCircle, Trophy } from "lucide-react";
import { Planet } from "@/components/courses/Planet";
import { StartAttemptButton } from "@/components/courses/StartAttemptButton";
import { PLANETS } from "@/lib/planets";
import { formatMinutes } from "@/lib/video";
import { lessonHasVideo, type CourseLesson, type CourseModule } from "@/lib/course-structure";

/**
 * Курс бағдарламасы: әр блок — айналып тұрған ғаламшар (ғарыш стилі), ішінде видео сабақтар мен тесттер.
 * access: "open" — ашық; "login" — кіру керек; "locked" — курсқа рұқсат жоқ.
 */
export function CourseModules({ modules, courseSlug, access }: { modules: CourseModule[]; courseSlug: string; access: "open" | "login" | "locked" }) {
  const lessonsCount = modules.reduce((s, m) => s + m.lessons.length, 0);
  const minutes = modules.reduce((s, m) => s + m.lessons.reduce((x, l) => x + (l.kind === "video" ? (l.duration_minutes ?? 0) : 0), 0), 0);
  const loginHref = `/login?next=${encodeURIComponent(`/courses/${courseSlug}`)}`;

  return (
    <section className="space-bg relative isolate overflow-hidden rounded-3xl p-4 ring-1 ring-white/10 sm:p-7" aria-labelledby="course-program-title">
      <div className="stars stars-drift" aria-hidden />
      <div className="relative">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <h2 id="course-program-title" className="text-xl font-extrabold text-white sm:text-2xl">
            Осы курсқа арналған тақырыптар
          </h2>
          <span className="text-sm text-white/60">
            {lessonsCount} сабақ{minutes > 0 ? ` · ${formatMinutes(minutes)}` : ""}
          </span>
        </div>

        <div className="space-y-3">
          {modules.map((m, i) => (
            <details key={m.id} className="group glass-dark overflow-hidden rounded-2xl" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 transition select-none hover:bg-white/5 sm:gap-5 sm:px-5 sm:py-4 [&::-webkit-details-marker]:hidden">
                <Planet planet={m.planet} className="w-14 sm:w-[72px]" />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-extrabold text-white uppercase sm:text-lg">
                    №{m.position}. {m.title}
                  </span>
                  {!m.title.toLowerCase().includes(PLANETS[m.planet].name.toLowerCase()) && (
                    <span className="mt-0.5 block text-xs text-neptune-200/75">{PLANETS[m.planet].name}</span>
                  )}
                </span>
                <span className="shrink-0 text-sm text-white/55">{m.lessons.length} сабақ</span>
                <ChevronDown className="size-5 shrink-0 text-white/60 transition group-open:rotate-180" />
              </summary>

              {m.lessons.length === 0 ? (
                <p className="border-t border-white/10 px-5 py-4 text-sm text-white/50">Бұл блокқа сабақтар жақында қосылады.</p>
              ) : (
                <ol className="divide-y divide-white/10 border-t border-white/10">
                  {m.lessons.map((l) => (
                    <LessonItem key={l.id} lesson={l} courseSlug={courseSlug} access={access} loginHref={loginHref} />
                  ))}
                </ol>
              )}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function LessonItem({ lesson, courseSlug, access, loginHref }: { lesson: CourseLesson; courseSlug: string; access: "open" | "login" | "locked"; loginHref: string }) {
  const isTest = lesson.kind === "test";
  const duration = formatMinutes(lesson.duration_minutes);
  const t = lesson.test;

  let action: React.ReactNode;
  if (access === "login") {
    action = (
      <Link href={loginHref} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-white">
        <Lock className="size-4" /> Кіру
      </Link>
    );
  } else if (access === "locked") {
    action = (
      <span className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-white/50" title="Бұл курсқа рұқсатыңыз жоқ">
        <Lock className="size-4" /> Рұқсат жоқ
      </span>
    );
  } else if (isTest && lesson.variant_id) {
    action = t?.activeAttemptId ? (
      <Link href={`/test/${t.activeAttemptId}`} className="inline-flex h-9 items-center rounded-xl bg-gradient-to-r from-brand-500 to-neptune-500 px-3.5 text-sm font-semibold text-white shadow-glow transition hover:brightness-110">
        Жалғастыру
      </Link>
    ) : (
      <span className="flex flex-wrap items-center justify-end gap-2">
        {t?.lastAttemptId && (
          <Link href={`/results/${t.lastAttemptId}`} className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/15 px-3 text-sm font-semibold text-white transition hover:bg-white/10">
            <Trophy className="size-4 text-amber-300" /> {t.lastScore}/{t.maxScore}
          </Link>
        )}
        <StartAttemptButton variantId={lesson.variant_id} mode={t?.lastAttemptId ? "retake" : "start"} size="sm" returnTo={`/courses/${courseSlug}`} />
      </span>
    );
  } else if (lessonHasVideo(lesson)) {
    action = (
      <Link
        href={`/courses/${courseSlug}/lessons/${lesson.id}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 text-sm font-semibold text-white transition hover:border-neptune-400/60 hover:bg-white/10"
      >
        <PlayCircle className="size-4 text-neptune-300" /> Көру
      </Link>
    );
  } else {
    action = <span className="px-3 text-xs text-white/65">Жақында</span>;
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3.5 sm:px-5">
      <div className="flex min-w-[12rem] flex-1 items-center gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${isTest ? "bg-neptune-400/15 text-neptune-300" : "bg-white/10 text-white"}`}>
          {isTest ? <ClipboardList className="size-5" /> : <PlayCircle className="size-5" />}
        </span>
        <div className="min-w-0">
          <div className="truncate font-semibold text-white">{lesson.title}</div>
          <div className="text-xs text-white/55">{isTest ? "Тест" : `Видео-сабақ${duration ? ` · ${duration}` : ""}`}</div>
        </div>
      </div>
      <div className="ml-auto shrink-0">{action}</div>
    </li>
  );
}
