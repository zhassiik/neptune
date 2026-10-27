import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck, CheckCircle2, CircleDashed, ClipboardList, Clock, MinusCircle, PlayCircle, Trophy, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/States";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { StartAttemptButton } from "@/components/courses/StartAttemptButton";
import { formatDateTime, formatDuration, percent } from "@/lib/utils";
import { hasVideo, variantHeading } from "@/lib/video";
import { getLeaderboard } from "@/lib/weekly-server";
import { Leaderboard } from "@/components/weekly/Leaderboard";
import type { ContestWeek } from "@/lib/types";

export const metadata: Metadata = { title: "Менің нәтижелерім" };
export const dynamic = "force-dynamic";

interface AttemptRow {
  id: string;
  variant_id: string;
  status: "in_progress" | "submitted";
  total_score: number | null;
  max_score: number;
  correct_count: number | null;
  partial_count: number | null;
  incorrect_count: number | null;
  unanswered_count: number | null;
  started_at: string;
  submitted_at: string | null;
  test_variants: {
    id: string;
    title: string;
    position: number;
    video_url: string | null;
    video_provider: "url" | "cloudflare";
    cloudflare_video_uid: string | null;
    courses: { slug: string; title: string } | null;
  } | null;
}

export default async function CabinetPage() {
  const user = await requireUser("/cabinet");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("test_attempts")
    .select(
      "id, variant_id, status, total_score, max_score, correct_count, partial_count, incorrect_count, unanswered_count, started_at, submitted_at, test_variants(*, courses(slug, title))",
    )
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .returns<AttemptRow[]>();
  if (error) throw new Error("Нәтижелерді жүктеу мүмкін болмады");

  const attempts = data ?? [];
  const submitted = attempts.filter((a) => a.status === "submitted");
  const active = attempts.filter((a) => a.status === "in_progress");
  const best = submitted.reduce((m, a) => Math.max(m, a.total_score ?? 0), 0);
  const avg = submitted.length ? Math.round(submitted.reduce((s, a) => s + (a.total_score ?? 0), 0) / submitted.length) : 0;

  // «Апта үздігі»: соңғы жарияланған апта (кесте жоқ болса — көрсетілмейді)
  const { data: latestWeek } = await supabase
    .from("contest_weeks")
    .select("id, course_id, title, position, is_published, courses(slug)")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ContestWeek & { courses: { slug: string } | null }>();
  const leaderboard = latestWeek ? await getLeaderboard(supabase, latestWeek.id, 5) : [];

  // Әр нұсқаның нешінші талпынысы екенін көрсету үшін (ескіден жаңаға қарай нөмірлейміз)
  const attemptNumber = new Map<string, number>();
  const perVariant = new Map<string, number>();
  for (const a of [...submitted].reverse()) {
    const n = (perVariant.get(a.variant_id) ?? 0) + 1;
    perVariant.set(a.variant_id, n);
    attemptNumber.set(a.id, n);
  }

  return (
    <div className="bg-slate-50/60">
      <div className="container-page py-10 sm:py-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Менің нәтижелерім</h1>
          <ButtonLink href="/cabinet/devices" variant="outline" size="sm">
            <ShieldCheck className="size-4" /> Менің құрылғыларым
          </ButtonLink>
        </div>
        <p className="mt-2 text-slate-500">
          Сәлем, <b className="text-slate-700">{user.profile?.full_name || user.email}</b>! Мұнда тапсырған барлық нұсқаларыңыз бен қателеріңіздің талдауы сақталады.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Тапсырылған нұсқалар", value: submitted.length, icon: ClipboardList },
            { label: "Ең жоғары балл", value: submitted.length ? `${best}/50` : "—", icon: Trophy },
            { label: "Орташа балл", value: submitted.length ? `${avg}/50` : "—", icon: Trophy },
          ].map((s) => (
            <div key={s.label} className="card flex items-center gap-4 p-5">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-500">
                <s.icon className="size-6" />
              </span>
              <div>
                <div className="font-display text-2xl font-extrabold text-navy-900">{s.value}</div>
                <div className="text-sm text-slate-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {latestWeek && (
          <div className="mt-8">
            <Leaderboard
              weeks={[latestWeek]}
              activeWeekId={latestWeek.id}
              rows={leaderboard}
              footer={
                latestWeek.courses && (
                  <a href={`/courses/${latestWeek.courses.slug}#top`} className="text-sm font-semibold text-brand-600 hover:underline">
                    Барлық апталар және нұсқалар →
                  </a>
                )
              }
            />
          </div>
        )}

        {active.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-bold">Аяқталмаған тесттер</h2>
            <div className="grid gap-3">
              {active.map((a) => (
                <div key={a.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    {a.test_variants?.courses && <div className="text-xs font-semibold text-brand-600 uppercase">{a.test_variants.courses.title}</div>}
                    <div className="font-semibold text-navy-900">{a.test_variants ? variantHeading(a.test_variants) : "—"}</div>
                    <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
                      <Clock className="size-4" /> Басталды: {formatDateTime(a.started_at)}
                    </div>
                  </div>
                  <ButtonLink href={`/test/${a.id}`}>
                    Жалғастыру <ArrowRight className="size-4" />
                  </ButtonLink>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold">Тапсырылған нұсқалар</h2>
          {submitted.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Әзірге тапсырылған нұсқа жоқ"
              description="Алғашқы нұсқаны орындаңыз — нәтижеңіз бен қателеріңіздің талдауы осы жерде сақталады."
              action={<ButtonLink href="/courses">Курстарды көру</ButtonLink>}
            />
          ) : (
            <div className="grid gap-4">
              {submitted.map((a) => {
                const v = a.test_variants;
                const p = percent(a.total_score, a.max_score);
                const mistakes = (a.incorrect_count ?? 0) + (a.partial_count ?? 0) + (a.unanswered_count ?? 0);
                const courseHref = v?.courses ? `/courses/${v.courses.slug}` : "/courses";
                return (
                  <article key={a.id} className="card p-5 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                      {/* Балл */}
                      <div className="flex items-center gap-4 lg:w-44 lg:shrink-0 lg:flex-col lg:items-start lg:gap-2">
                        <div className="font-display text-3xl font-extrabold text-navy-900">
                          {a.total_score}
                          <span className="text-lg text-slate-400">/{a.max_score}</span>
                        </div>
                        <div className="w-full max-w-40">
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${p >= 80 ? "bg-emerald-500" : p >= 50 ? "bg-brand-500" : p >= 30 ? "bg-amber-400" : "bg-red-500"}`}
                              style={{ width: `${p}%` }}
                            />
                          </div>
                          <div className="mt-1 text-xs font-semibold text-slate-500">{p}%</div>
                        </div>
                      </div>

                      {/* Нұсқа */}
                      <div className="min-w-0 flex-1">
                        {v?.courses && <div className="text-xs font-semibold text-brand-600 uppercase">{v.courses.title}</div>}
                        <Link href={`/results/${a.id}`} className="font-display text-lg font-bold text-navy-900 transition hover:text-brand-600">
                          {v ? variantHeading(v) : "Өшірілген нұсқа"}
                        </Link>
                        <div className="mt-1 text-sm text-slate-500">
                          {formatDateTime(a.submitted_at)} · {formatDuration(a.started_at, a.submitted_at)}
                          {(perVariant.get(a.variant_id) ?? 1) > 1 && <> · {attemptNumber.get(a.id)}-талпыныс</>}
                        </div>
                        <ul className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                          <li className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                            <CheckCircle2 className="size-3.5" /> Дұрыс: {a.correct_count ?? 0}
                          </li>
                          <li className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">
                            <MinusCircle className="size-3.5" /> Жартылай: {a.partial_count ?? 0}
                          </li>
                          <li className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-red-700">
                            <XCircle className="size-3.5" /> Қате: {a.incorrect_count ?? 0}
                          </li>
                          <li className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                            <CircleDashed className="size-3.5" /> Жауапсыз: {a.unanswered_count ?? 0}
                          </li>
                        </ul>
                      </div>

                      {/* Әрекеттер */}
                      <div className="flex flex-wrap gap-2 lg:w-60 lg:shrink-0 lg:flex-col">
                        {mistakes > 0 ? (
                          <ButtonLink href={`/results/${a.id}?filter=mistakes#review`} className="lg:w-full">
                            <XCircle className="size-4" /> Қателерді көру ({mistakes})
                          </ButtonLink>
                        ) : (
                          <Badge tone="green" className="h-11 justify-center px-4 text-sm lg:w-full">
                            <CheckCircle2 className="size-4" /> Қатесіз!
                          </Badge>
                        )}
                        <ButtonLink href={`/results/${a.id}#review`} variant="outline" className="lg:w-full">
                          Толық талдау
                        </ButtonLink>
                        {v && hasVideo(v) && v.courses && (
                          <ButtonLink href={`/courses/${v.courses.slug}/video/${v.id}`} variant="secondary" className="lg:w-full">
                            <PlayCircle className="size-4" /> Видео-талдау
                          </ButtonLink>
                        )}
                        {v && (
                          <StartAttemptButton variantId={v.id} mode="retake" returnTo={courseHref} className="lg:w-full" />
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
