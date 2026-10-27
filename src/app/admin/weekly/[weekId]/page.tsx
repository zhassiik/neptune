import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, NotebookPen, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { WeekForm } from "@/components/admin/weekly/WeekForm";
import { VariantScheduleRow, type ScheduleVariant } from "@/components/admin/weekly/VariantScheduleRow";
import { HomeworkGrid, type GridStudent } from "@/components/admin/weekly/HomeworkGrid";
import { DeleteWeekButton } from "@/components/admin/weekly/DeleteWeekButton";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { saveVariantSchedule, updateWeek } from "@/lib/admin/weekly-actions";
import { getLeaderboard } from "@/lib/weekly-server";
import { formatPoints, formatWindow } from "@/lib/weekly";
import { variantHeading } from "@/lib/video";
import type { ContestWeek, HomeworkStatus, TestVariant } from "@/lib/types";

export const metadata: Metadata = { title: "Апта үздігі" };

export default async function AdminWeekPage({ params, searchParams }: { params: Promise<{ weekId: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ weekId }, { created }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(weekId)) notFound();
  const supabase = await createClient();

  const { data: week } = await supabase.from("contest_weeks").select("*, courses(title)").eq("id", weekId).maybeSingle<ContestWeek & { courses: { title: string } | null }>();
  if (!week) notFound();

  const [{ data: variantsData }, { data: otherWeeks }] = await Promise.all([
    supabase.from("test_variants").select("*").eq("course_id", week.course_id).order("position").order("created_at"),
    supabase.from("contest_weeks").select("id, title").eq("course_id", week.course_id),
  ]);
  const variants = (variantsData ?? []) as TestVariant[];
  const weekTitles = new Map((otherWeeks ?? []).map((w) => [w.id, w.title]));
  const weekVariants = variants.filter((v) => v.week_id === weekId);
  const weekVariantIds = weekVariants.map((v) => v.id);

  // Тексеру кестесіндегі оқушылар: осы апта нұсқаларын тапсырғандар, бағасы барлар, курсқа рұқсат берілгендер
  const [{ data: attempts }, { data: checks }, { data: enrollments }, leaderboard] = await Promise.all([
    weekVariantIds.length ? supabase.from("test_attempts").select("student_id").in("variant_id", weekVariantIds) : Promise.resolve({ data: [] }),
    weekVariantIds.length ? supabase.from("homework_checks").select("variant_id, student_id, draft_status, notes_status").in("variant_id", weekVariantIds) : Promise.resolve({ data: [] }),
    supabase.from("course_enrollments").select("student_id").eq("course_id", week.course_id),
    getLeaderboard(supabase, weekId, null),
  ]);
  const studentIds = [...new Set([...(attempts ?? []), ...(checks ?? []), ...(enrollments ?? [])].map((r: { student_id: string }) => r.student_id))];
  const { data: profiles } = studentIds.length
    ? await supabase.from("profiles").select("id, full_name, email, role").in("id", studentIds).eq("role", "student").order("full_name")
    : { data: [] };
  const students: GridStudent[] = (profiles ?? []).map((p) => ({ id: p.id, name: p.full_name || p.email || "Оқушы", email: p.email }));
  const initialChecks: Record<string, { draft_status: HomeworkStatus | null; notes_status: HomeworkStatus | null }> = {};
  for (const c of (checks ?? []) as { variant_id: string; student_id: string; draft_status: HomeworkStatus | null; notes_status: HomeworkStatus | null }[]) {
    initialChecks[`${c.variant_id}:${c.student_id}`] = { draft_status: c.draft_status, notes_status: c.notes_status };
  }

  const schedule: ScheduleVariant[] = variants.map((v) => ({
    id: v.id,
    heading: variantHeading(v),
    week_id: v.week_id ?? null,
    otherWeekTitle: v.week_id && v.week_id !== weekId ? (weekTitles.get(v.week_id) ?? null) : null,
    contest_starts_at: v.contest_starts_at ?? null,
    contest_ends_at: v.contest_ends_at ?? null,
    classroom_url: v.classroom_url ?? null,
    homework_deadline: v.homework_deadline ?? null,
  }));
  const saveAction = saveVariantSchedule.bind(null, weekId);

  return (
    <>
      <ButtonLink href="/admin/weekly" variant="ghost" size="sm" className="-ml-3 mb-2">
        <ArrowLeft className="size-4" /> Апталар
      </ButtonLink>
      <PageHeader title={`Апта үздігі · ${week.title}`} description={week.courses?.title} actions={<DeleteWeekButton weekId={week.id} title={week.title} />} />
      {created && (
        <Alert tone="success" className="mb-5">
          Апта құрылды! Төменде осы аптаның нұсқаларын белгілеп, әрқайсысына күн мен уақыт аралығын (мысалы, 05:00–06:30) беріңіз.
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <CalendarClock className="size-5 text-amber-500" /> Нұсқалар және уақыт аралығы
          </h2>
          <p className="text-sm text-slate-500">
            Белгіленген нұсқа аралық басталғанша оқушыларға ашылмайды. Аралық ішінде басталып, тапсырылған бірінші талпыныс есептеледі. Дұрыс жауаптар аралық біткенше жасырын.
          </p>
          {schedule.length === 0 ? (
            <Alert tone="info">Бұл курста әзірге нұсқа жоқ.</Alert>
          ) : (
            schedule.map((v) => <VariantScheduleRow key={v.id} v={v} weekId={weekId} action={saveAction} />)
          )}
        </section>

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-4 text-lg font-bold">Апта баптаулары</h2>
            <WeekForm action={updateWeek.bind(null, week.id)} initial={week} submitLabel="Сақтау" />
          </section>
          <section className="card overflow-hidden">
            <h2 className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 text-lg font-bold">
              <Trophy className="size-5 text-amber-500" /> Толық рейтинг
            </h2>
            {leaderboard.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">Әзірге нәтиже жоқ.</p>
            ) : (
              <ol className="max-h-[480px] divide-y divide-slate-100 overflow-y-auto">
                {leaderboard.map((r) => (
                  <li key={r.student_id ?? r.full_name} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span className="w-6 font-display font-extrabold text-slate-400">{r.rank}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-navy-900">{r.full_name}</span>
                    <span className="text-xs text-slate-500">
                      {r.test_points} + {formatPoints(r.homework_points)}
                    </span>
                    <b className="w-12 text-right text-navy-900">{formatPoints(r.total)}</b>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      <section className="card mt-8 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <NotebookPen className="size-5 text-amber-500" /> Черновик және конспект тексерісі
        </h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          Classroom-нан тексеріп, белгілеңіз: <b>Уақытында</b> — черновик +5, конспект +10; <b>Кешікті</b> — жартысы; <b>Салмады</b> — 0. Әр өзгеріс бірден сақталады.
        </p>
        <HomeworkGrid
          variants={weekVariants.map((v) => ({
            id: v.id,
            label: v.contest_starts_at && v.contest_ends_at ? `№${v.position} · ${formatWindow(v.contest_starts_at, v.contest_ends_at)}` : `№${v.position}`,
          }))}
          students={students}
          initial={initialChecks}
        />
      </section>
    </>
  );
}
