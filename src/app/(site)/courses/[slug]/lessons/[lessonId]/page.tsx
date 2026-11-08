import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCourseBySlug } from "@/lib/courses";
import { getCourseAccess } from "@/lib/access";
import { formatMinutes } from "@/lib/video";
import { PLANETS, isPlanetKey } from "@/lib/planets";
import { lessonHasVideo, loadCourseStructure } from "@/lib/course-structure";
import { VideoPlayer } from "@/components/courses/VideoPlayer";
import { SecureVideoPlayer } from "@/components/video/SecureVideoPlayer";
import { Planet } from "@/components/courses/Planet";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Видео-сабақ" };
export const dynamic = "force-dynamic";

/** Блоктағы видео-сабақ: ойнатқыш + блок ішіндегі алдыңғы/келесі сабақ */
export default async function LessonPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) notFound();
  const user = await requireUser(`/courses/${slug}/lessons/${lessonId}`);
  const course = await getCourseBySlug(slug);
  if (!course) notFound();
  const isAdmin = user.profile?.role === "admin";
  if (course.status !== "published" && !isAdmin) notFound();

  const supabase = await createClient();
  const structure = await loadCourseStructure(supabase, course.id, user.id);
  const mod = structure.modules.find((m) => m.lessons.some((l) => l.id === lessonId));
  const lesson = mod?.lessons.find((l) => l.id === lessonId);
  if (!mod || !lesson || lesson.kind !== "video") notFound();

  // Курсқа рұқсат серверде тексеріледі (token API де қайта тексереді)
  const access = await getCourseAccess(supabase, user, course);

  // Блок ішіндегі көрсетуге болатын видео-сабақтар: алдыңғы / келесі
  const videos = mod.lessons.filter((l) => l.kind === "video" && lessonHasVideo(l));
  const idx = videos.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? videos[idx - 1] : null;
  const next = idx >= 0 && idx < videos.length - 1 ? videos[idx + 1] : null;
  const planet = isPlanetKey(mod.planet) ? mod.planet : "mercury";
  const duration = formatMinutes(lesson.duration_minutes);

  return (
    <div className="bg-slate-50/60">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <ButtonLink href={`/courses/${course.slug}`} variant="ghost" size="sm" className="-ml-3">
          <ArrowLeft className="size-4" /> {course.title}
        </ButtonLink>

        <div className="mt-4 flex items-center gap-3">
          <Planet planet={planet} className="w-12" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-600">
              №{mod.position}. {mod.title} · {PLANETS[planet].name}
            </p>
            <h1 className="text-2xl font-extrabold sm:text-3xl">
              {lesson.title}
              {duration && <span className="ml-3 align-middle text-base font-medium text-slate-500">{duration}</span>}
            </h1>
          </div>
        </div>

        <div className="mt-6">
          {!access.allowed ? (
            <div className="grid aspect-video place-items-center rounded-2xl bg-navy-900 p-6 text-center text-white">
              <div>
                <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-white/10">
                  <Lock className="size-7" />
                </div>
                <p className="font-semibold">Бұл видеоны көруге рұқсатыңыз жоқ</p>
                <p className="mt-1 text-sm text-white/60">Рұқсат алу үшін мұғаліммен байланысыңыз.</p>
              </div>
            </div>
          ) : !lessonHasVideo(lesson) ? (
            <div className="grid aspect-video place-items-center rounded-2xl bg-navy-900 text-white/70">Видео жақында қосылады</div>
          ) : lesson.video_provider === "cloudflare" ? (
            <SecureVideoPlayer tokenUrl={`/api/video/lesson/${lesson.id}/token`} title={lesson.title} watermark={{ name: user.profile?.full_name || "Оқушы", email: user.email ?? "" }} />
          ) : (
            <VideoPlayer url={lesson.video_url} title={lesson.title} />
          )}
        </div>

        {(prev || next) && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
            {prev ? (
              <ButtonLink href={`/courses/${course.slug}/lessons/${prev.id}`} variant="outline">
                <ArrowLeft className="size-4" /> <span className="truncate">{prev.title}</span>
              </ButtonLink>
            ) : (
              <span />
            )}
            {next && (
              <ButtonLink href={`/courses/${course.slug}/lessons/${next.id}`}>
                <span className="truncate">{next.title}</span> <ArrowRight className="size-4" />
              </ButtonLink>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
