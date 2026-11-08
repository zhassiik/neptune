import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, FileQuestion, ListChecks, Orbit, PlayCircle, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { coverUrl, formatPrice, getCourseBySlug } from "@/lib/courses";
import { getCourseAccess } from "@/lib/access";
import { getPlatformSettings } from "@/lib/settings";
import { accessRequestHref } from "@/lib/join-cta";
import { WhatsAppAccessButton } from "@/components/courses/WhatsAppAccessButton";
import { hasVideo } from "@/lib/video";
import { CourseCover } from "@/components/courses/CourseCover";
import { VariantSection, type VariantProgress } from "@/components/courses/VariantSection";
import { EmptyState } from "@/components/ui/States";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { SpaceBand } from "@/components/ui/SpaceBand";
import type { TestVariant } from "@/lib/types";
import { getMyHomework } from "@/lib/homework-server";
import { loadCourseStructure, lessonHasVideo } from "@/lib/course-structure";
import { CourseModules } from "@/components/courses/CourseModules";
import { SecureVideoPlayer } from "@/components/video/SecureVideoPlayer";
import { VideoPlayer } from "@/components/courses/VideoPlayer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const course = await getCourseBySlug((await params).slug);
  return { title: course?.title ?? "Курс" };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [course, user] = await Promise.all([getCourseBySlug(slug), getCurrentUser()]);
  if (!course) notFound();
  const isAdmin = user?.profile?.role === "admin";
  const open = course.status === "published";

  const supabase = await createClient();
  const access = await getCourseAccess(supabase, user, course);
  const locked = !!user && !access.allowed && access.reason === "not_enrolled";
  const accessHref = locked ? accessRequestHref(await getPlatformSettings(), course.title) : null;
  let variants: TestVariant[] = [];
  if (open || isAdmin) {
    const { data, error } = await supabase
      .from("test_variants")
      .select("*")
      .eq("course_id", course.id)
      .eq("status", "published")
      .order("position")
      .order("created_at");
    if (error) throw new Error("Нұсқаларды жүктеу мүмкін болмады");
    // Блоктағы еркін тесттер (practice) нұсқалар тізімінде көрсетілмейді
    variants = ((data ?? []) as TestVariant[]).filter((v) => (v.kind ?? "ubt") === "ubt");
  }

  const progress: Record<string, VariantProgress> = {};
  if (user && variants.length > 0) {
    const { data: attempts } = await supabase
      .from("test_attempts")
      .select("id, variant_id, status, total_score, created_at")
      .eq("student_id", user.id)
      .in("variant_id", variants.map((v) => v.id))
      .order("created_at", { ascending: false });
    for (const a of attempts ?? []) {
      const p = (progress[a.variant_id] ??= { activeAttemptId: null, lastScore: null, lastAttemptId: null, attemptsCount: 0 });
      if (a.status === "in_progress") p.activeAttemptId = a.id;
      else {
        p.attemptsCount += 1;
        if (p.lastAttemptId == null) {
          p.lastAttemptId = a.id;
          p.lastScore = a.total_score;
        }
      }
    }
  }

  // Оқушының черновик/конспект белгілері
  const homework = user && !locked ? await getMyHomework(supabase, user.id, variants.map((v) => v.id)) : {};

  // Курс құрылымы: кіріспе видео + ғаламшар-блоктар (бар болса)
  const structure = open || isAdmin ? await loadCourseStructure(supabase, course.id, user?.id ?? null) : { intro: null, modules: [] };
  const intro = structure.intro && lessonHasVideo(structure.intro) ? structure.intro : null;
  const hasModules = structure.modules.length > 0;
  const moduleAccess: "open" | "login" | "locked" = !user ? "login" : access.allowed ? "open" : "locked";

  const videos = variants.filter(hasVideo).length;
  const price = formatPrice(course.price);

  return (
    <div className="bg-slate-50/60">
      <SpaceBand innerClassName="py-8 sm:py-12">
        <Link href="/courses" className="inline-flex items-center gap-1 rounded-lg text-sm font-medium text-white/60 transition hover:text-neptune-200">
          <ChevronLeft className="size-4" /> Курстар
        </Link>

        <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,360px)_1fr] md:items-center md:gap-10">
          <div className="rounded-3xl p-1.5 ring-1 ring-white/15 glass-dark">
            <CourseCover url={coverUrl(course.cover_path)} title={course.title} priority sizes="(max-width: 768px) 100vw, 360px" />
          </div>
          <div>
            {!open && (
              <Badge tone="amber" className="mb-3">
                <Clock className="size-3.5" /> Жақында ашылады
              </Badge>
            )}
            <h1 className="text-2xl leading-tight font-extrabold text-white uppercase sm:text-4xl">{course.title}</h1>
            {course.description && <p className="mt-3 max-w-2xl leading-relaxed text-white/75">{course.description}</p>}
            <ul className="mt-5 flex flex-wrap gap-2 text-sm">
              {variants.length > 0 && (
                <li className="glass-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-neptune-200">
                  <ListChecks className="size-4" /> {variants.length} нұсқа
                </li>
              )}
              {videos > 0 && (
                <li className="glass-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-neptune-200">
                  <PlayCircle className="size-4" /> {videos} видео-талдау
                </li>
              )}
              {structure.modules.length > 0 && (
                <li className="glass-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-neptune-200">
                  <Orbit className="size-4" /> {structure.modules.length} тақырыптық блок
                </li>
              )}
              {price && <li className="inline-flex items-center rounded-full bg-gradient-to-r from-brand-500 to-neptune-500 px-3.5 py-1.5 font-bold text-white shadow-glow">{price}</li>}
            </ul>
          </div>
        </div>
      </SpaceBand>

      <div className="container-page pb-8 sm:pb-12">
        {locked && (
          <div role="status" className="mt-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
                <TriangleAlert className="size-4.5" aria-hidden />
              </span>
              <p className="leading-snug">
                <b>Бұл курсқа рұқсатыңыз жоқ.</b> Нұсқалар мен видео-талдауларды ашу үшін мұғаліммен байланысыңыз.
              </p>
            </div>
            {accessHref && <WhatsAppAccessButton href={accessHref} className="shrink-0" />}
          </div>
        )}

        {!open && isAdmin && (
          <Alert tone="warning" className="mt-6">
            Бұл курс оқушыларға әлі ашылмаған («Жақында» күйінде). Сіз әкімші ретінде көріп тұрсыз.
          </Alert>
        )}

        {/* Курсқа кіріспе видео — курсқа жазылмаған келушілер де көреді */}
        {intro && (
          <section className="mt-8">
            <h2 className="mb-3 text-xl font-extrabold">Курсқа кіріспе</h2>
            {intro.video_provider === "cloudflare" ? (
              <SecureVideoPlayer
                tokenUrl={`/api/video/lesson/${intro.id}/token`}
                title={intro.title}
                watermark={{ name: user?.profile?.full_name || "Neptune UBT", email: user?.email ?? "" }}
              />
            ) : (
              <VideoPlayer url={intro.video_url} title={intro.title} />
            )}
          </section>
        )}

        {hasModules && (
          <div className="mt-8">
            <CourseModules modules={structure.modules} courseSlug={course.slug} access={isAdmin ? "open" : moduleAccess} />
          </div>
        )}

        <div className="mt-8 space-y-4">
          {!open && !isAdmin ? (
            <EmptyState icon={Clock} title="Курс жақында ашылады" description="Курс ашылғанда нұсқалар мен видео-талдаулар осы жерде пайда болады." />
          ) : variants.length === 0 ? (
            hasModules || intro ? null : <EmptyState icon={FileQuestion} title="Әзірге жарияланған нұсқа жоқ" description="Жаңа нұсқа жарияланғанда, ол осы жерде пайда болады." />
          ) : (
            variants.map((v, i) => (
              <VariantSection
                key={v.id}
                variant={v}
                courseSlug={course.slug}
                progress={progress[v.id]}
                loggedIn={!!user}
                locked={locked}
                defaultOpen={i === 0}
                homework={homework[v.id]}
                isAdmin={isAdmin}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
