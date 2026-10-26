import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCourseBySlug } from "@/lib/courses";
import { formatMinutes, variantHeading } from "@/lib/video";
import { VideoPlayer } from "@/components/courses/VideoPlayer";
import { SecureVideoPlayer } from "@/components/video/SecureVideoPlayer";
import { getCourseAccess } from "@/lib/access";
import { ButtonLink } from "@/components/ui/Button";
import type { TestVariant } from "@/lib/types";

export const metadata: Metadata = { title: "Видео-талдау" };
export const dynamic = "force-dynamic";

export default async function VideoPage({ params }: { params: Promise<{ slug: string; variantId: string }> }) {
  const { slug, variantId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(variantId)) notFound();
  const user = await requireUser(`/courses/${slug}/video/${variantId}`);
  const course = await getCourseBySlug(slug);
  if (!course) notFound();
  const isAdmin = user.profile?.role === "admin";
  if (course.status !== "published" && !isAdmin) notFound();

  const supabase = await createClient();
  const { data: variant } = await supabase
    .from("test_variants")
    .select("*")
    .eq("id", variantId)
    .eq("course_id", course.id)
    .maybeSingle<TestVariant>();
  if (!variant || (variant.status !== "published" && !isAdmin)) notFound();

  // Курсқа рұқсат серверде тексеріледі (token API де қайта тексереді)
  const access = await getCourseAccess(supabase, user, course);

  const { data: last } = await supabase
    .from("test_attempts")
    .select("id, total_score")
    .eq("student_id", user.id)
    .eq("variant_id", variant.id)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const duration = formatMinutes(variant.video_duration_minutes);

  return (
    <div className="bg-slate-50/60">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <ButtonLink href={`/courses/${course.slug}`} variant="ghost" size="sm" className="-ml-3">
          <ArrowLeft className="size-4" /> {course.title}
        </ButtonLink>
        <p className="mt-4 text-sm font-semibold text-brand-600">{variantHeading(variant)}</p>
        <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">
          ТАЛДАУ №{variant.position}
          {duration && <span className="ml-3 align-middle text-base font-medium text-slate-500">{duration}</span>}
        </h1>

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
          ) : variant.video_provider === "cloudflare" ? (
            <SecureVideoPlayer
              variantId={variant.id}
              title={`ТАЛДАУ №${variant.position}`}
              watermark={{ name: user.profile?.full_name || "Оқушы", email: user.email ?? "" }}
            />
          ) : (
            <VideoPlayer url={variant.video_url} title={`ТАЛДАУ №${variant.position}`} />
          )}
        </div>

        <div className="card mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-500">
              <ClipboardList className="size-5" />
            </span>
            <div>
              <div className="font-semibold text-navy-900">НҰСҚА №{variant.position}</div>
              <div className="text-sm text-slate-500">
                {last ? `Сіздің нәтижеңіз: ${last.total_score}/50` : "Талдауды көрмес бұрын нұсқаны өзіңіз орындап көріңіз"}
              </div>
            </div>
          </div>
          {last ? (
            <ButtonLink href={`/results/${last.id}`} variant="secondary">
              Нәтижемді ашу
            </ButtonLink>
          ) : (
            <ButtonLink href={`/courses/${course.slug}`}>Нұсқаны орындау</ButtonLink>
          )}
        </div>
      </div>
    </div>
  );
}
