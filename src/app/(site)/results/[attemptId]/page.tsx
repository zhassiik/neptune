import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleDashed, EyeOff, MinusCircle, PlayCircle, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadAttemptReview } from "@/lib/attempts/review";
import { ScoreDonut } from "@/components/results/ScoreDonut";
import { ReviewList } from "@/components/results/ReviewList";
import { StartAttemptButton } from "@/components/courses/StartAttemptButton";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { SECTIONS } from "@/lib/scoring";
import { formatDateTime, formatDuration } from "@/lib/utils";
import { hasVideo, variantHeading } from "@/lib/video";

export const metadata: Metadata = { title: "Нәтиже" };
export const dynamic = "force-dynamic";

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const [{ attemptId }, { filter }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) notFound();
  const user = await requireUser(`/results/${attemptId}`);
  const isAdmin = user.profile?.role === "admin";

  const review = await loadAttemptReview(attemptId, { id: user.id, isAdmin });
  if (!review) notFound();

  const { attempt, variant, questions, showAnswers, student } = review;
  const isOwner = attempt.student_id === user.id;
  const score = attempt.total_score ?? 0;
  const courseHref = variant.courses ? `/courses/${variant.courses.slug}` : "/courses";

  const stats = [
    { label: "Дұрыс", value: attempt.correct_count ?? 0, icon: CheckCircle2, className: "text-emerald-600 bg-emerald-50" },
    { label: "Жартылай дұрыс", value: attempt.partial_count ?? 0, icon: MinusCircle, className: "text-amber-600 bg-amber-50" },
    { label: "Қате", value: attempt.incorrect_count ?? 0, icon: XCircle, className: "text-red-600 bg-red-50" },
    { label: "Жауапсыз", value: attempt.unanswered_count ?? 0, icon: CircleDashed, className: "text-slate-500 bg-slate-100" },
  ];

  const sections = SECTIONS.map((s) => {
    const qs = questions.filter((q) => q.position >= s.from && q.position <= s.to);
    return {
      label: `${s.from}–${s.to} сұрақ`,
      points: qs.reduce((sum, q) => sum + q.points, 0),
      max: qs.reduce((sum, q) => sum + q.maxPoints, 0),
    };
  });

  return (
    <div className="bg-slate-50/60">
      <div className="container-page py-8 sm:py-12">
        <ButtonLink href={isAdmin && !isOwner ? "/admin/results" : courseHref} variant="ghost" size="sm" className="-ml-3">
          <ArrowLeft className="size-4" /> {isAdmin && !isOwner ? "Нәтижелерге қайту" : "Нұсқаларға қайту"}
        </ButtonLink>

        {/* Жалпы нәтиже */}
        <section className="card mt-4 overflow-hidden p-6 sm:p-9">
          <div className="flex flex-col items-center gap-8 md:flex-row md:items-center">
            <ScoreDonut score={score} max={attempt.max_score} />
            <div className="w-full flex-1">
              <p className="text-sm font-semibold text-brand-600">{variant.courses?.title ?? variant.subject}</p>
              <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{variantHeading(variant)}</h1>
              <p className="mt-2 text-sm text-slate-500">
                {!isOwner && student && <>Оқушы: <b className="text-slate-700">{student.full_name || student.email}</b> · </>}
                Тапсырылды: {formatDateTime(attempt.submitted_at)} · Ұзақтығы: {formatDuration(attempt.started_at, attempt.submitted_at)}
              </p>
              <div className="mt-2 font-display text-xl font-extrabold text-navy-900">
                {score}/{attempt.max_score} балл
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-2xl border border-slate-100 p-3.5">
                    <div className={`mb-2 grid size-8 place-items-center rounded-lg ${s.className}`}>
                      <s.icon className="size-4.5" />
                    </div>
                    <div className="font-display text-2xl font-extrabold text-navy-900">{s.value}</div>
                    <div className="text-xs text-slate-500">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
            {sections.map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-600">{s.label}</span>
                  <span className="font-bold text-navy-900">
                    {s.points}/{s.max}
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${s.max ? (s.points / s.max) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>

          {isOwner && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {hasVideo(variant) && variant.courses && (
                <ButtonLink href={`/courses/${variant.courses.slug}/video/${variant.id}`} size="lg" variant="navy">
                  <PlayCircle className="size-5" /> Видео-талдауды көру
                </ButtonLink>
              )}
              <StartAttemptButton variantId={variant.id} mode="retake" size="lg" returnTo={courseHref} />
              <ButtonLink href={courseHref} size="lg" variant="outline">
                Нұсқаларға қайту
              </ButtonLink>
            </div>
          )}
        </section>

        <h2 id="review" className="mt-12 mb-5 scroll-mt-24 text-2xl font-extrabold">Сұрақтар бойынша талдау</h2>
        {!showAnswers && (
          <Alert tone="info" className="mb-5">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <EyeOff className="size-4" /> Дұрыс жауаптар жасырылған
            </span>
            <p className="mt-0.5">Мұғалім бұл нұсқа үшін дұрыс жауаптарды көрсетуді шектеген. Әр сұрақ бойынша алған балыңызды көре аласыз.</p>
          </Alert>
        )}
        <ReviewList questions={questions} showAnswers={showAnswers} initialFilter={filter === "mistakes" ? "mistakes" : "all"} />
      </div>
    </div>
  );
}
