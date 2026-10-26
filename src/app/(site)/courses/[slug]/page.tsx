import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, FileQuestion, ListChecks, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { coverUrl, formatPrice, getCourseBySlug } from "@/lib/courses";
import { getCourseAccess } from "@/lib/access";
import { getPlatformSettings } from "@/lib/settings";
import { hasVideo } from "@/lib/video";
import { CourseCover } from "@/components/courses/CourseCover";
import { VariantSection, type VariantProgress } from "@/components/courses/VariantSection";
import { EmptyState } from "@/components/ui/States";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import type { TestVariant } from "@/lib/types";

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
  const contacts = locked ? await getPlatformSettings() : null;
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
    variants = (data ?? []) as TestVariant[];
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

  const videos = variants.filter(hasVideo).length;
  const price = formatPrice(course.price);

  return (
    <div className="bg-slate-50/60">
      <div className="container-page py-8 sm:py-12">
        <Link href="/courses" className="inline-flex items-center gap-1 rounded-lg text-sm font-medium text-slate-500 transition hover:text-brand-600">
          <ChevronLeft className="size-4" /> Курстар
        </Link>

        <section className="card mt-4 grid gap-6 p-5 sm:p-7 md:grid-cols-[minmax(0,340px)_1fr] md:items-center">
          <CourseCover url={coverUrl(course.cover_path)} title={course.title} priority sizes="(max-width: 768px) 100vw, 340px" />
          <div>
            {!open && (
              <Badge tone="amber" className="mb-3">
                <Clock className="size-3.5" /> Жақында ашылады
              </Badge>
            )}
            <h1 className="text-2xl leading-tight font-extrabold uppercase sm:text-4xl">{course.title}</h1>
            {course.description && <p className="mt-3 max-w-2xl leading-relaxed text-slate-600">{course.description}</p>}
            <ul className="mt-5 flex flex-wrap gap-2 text-sm">
              <li className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 font-medium text-brand-700">
                <ListChecks className="size-4" /> {variants.length} нұсқа
              </li>
              {videos > 0 && (
                <li className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 font-medium text-brand-700">
                  <PlayCircle className="size-4" /> {videos} видео-талдау
                </li>
              )}
              {price && <li className="inline-flex items-center rounded-full bg-navy-800 px-3 py-1.5 font-semibold text-white">{price}</li>}
            </ul>
          </div>
        </section>

        {locked && (
          <Alert tone="warning" className="mt-6">
            <b>Бұл курсқа рұқсатыңыз жоқ.</b> Нұсқалар мен видео-талдауларды ашу үшін мұғаліммен байланысыңыз
            {contacts?.contact_phone && <> — {contacts.contact_phone}</>}
            {contacts?.contact_email && <> · {contacts.contact_email}</>}.
          </Alert>
        )}

        {!open && isAdmin && (
          <Alert tone="warning" className="mt-6">
            Бұл курс оқушыларға әлі ашылмаған («Жақында» күйінде). Сіз әкімші ретінде көріп тұрсыз.
          </Alert>
        )}

        <div className="mt-8 space-y-4">
          {!open && !isAdmin ? (
            <EmptyState icon={Clock} title="Курс жақында ашылады" description="Курс ашылғанда нұсқалар мен видео-талдаулар осы жерде пайда болады." />
          ) : variants.length === 0 ? (
            <EmptyState icon={FileQuestion} title="Әзірге жарияланған нұсқа жоқ" description="Жаңа нұсқа жарияланғанда, ол осы жерде пайда болады." />
          ) : (
            variants.map((v, i) => (
              <VariantSection key={v.id} variant={v} courseSlug={course.slug} progress={progress[v.id]} loggedIn={!!user} locked={locked} defaultOpen={i === 0} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
