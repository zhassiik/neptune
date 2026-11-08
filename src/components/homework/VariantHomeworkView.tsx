import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { HomeworkChecklist, type ChecklistStudent } from "@/components/admin/HomeworkChecklist";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { variantHeading } from "@/lib/video";
import { formatDateTime } from "@/lib/utils";
import type { HomeworkStatus, TestVariant } from "@/lib/types";

/**
 * Черновик/конспект тексерісі: оқушылар тізімі және белгілер.
 * Әкімші (барлық курс) және куратор (өз курсы) ортақ қолданады — оқу құқығын RLS шектейді,
 * белгіні set_homework_check() дерекқор функциясы тексереді.
 */
export async function VariantHomeworkView({ variantId, backHref, backLabel, settingsHint }: { variantId: string; backHref: string; backLabel: string; settingsHint: boolean }) {
  if (!/^[0-9a-f-]{36}$/i.test(variantId)) notFound();
  const supabase = await createClient();

  const { data: variant } = await supabase.from("test_variants").select("*, courses(title, access_mode)").eq("id", variantId).maybeSingle<TestVariant & { courses: { title: string; access_mode?: string } | null }>();
  if (!variant) notFound();

  // Кімдер тізімде: ашық курс — барлық оқушы; жабық курс — рұқсат берілгендер, осы курста тест тапсырғандар және бұрын белгіленгендер
  const open = (variant.courses?.access_mode ?? "open") !== "enrolled";
  const [{ data: checks }, { data: enrolled }, { data: attempts }] = await Promise.all([
    supabase.from("homework_checks").select("student_id, draft_status, notes_status").eq("variant_id", variantId),
    open ? Promise.resolve({ data: [] }) : supabase.from("course_enrollments").select("student_id").eq("course_id", variant.course_id),
    open ? Promise.resolve({ data: [] }) : supabase.from("test_attempts").select("student_id, test_variants!inner(course_id)").eq("test_variants.course_id", variant.course_id),
  ]);

  let profileQuery = supabase.from("profiles").select("id, full_name, email").eq("role", "student").order("full_name").limit(2000);
  if (!open) {
    const ids = [...new Set([...(checks ?? []), ...(enrolled ?? []), ...(attempts ?? [])].map((r: { student_id: string }) => r.student_id))];
    profileQuery = profileQuery.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data: profiles, error } = await profileQuery;

  const byStudent = new Map((checks ?? []).map((c) => [c.student_id as string, c as { draft_status: HomeworkStatus | null; notes_status: HomeworkStatus | null }]));
  const students: ChecklistStudent[] = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name || p.email || "Оқушы",
    email: p.email,
    draft: byStudent.get(p.id)?.draft_status ?? null,
    notes: byStudent.get(p.id)?.notes_status ?? null,
  }));

  const draftUrl = variant.draft_url || variant.classroom_url;
  const notesUrl = variant.notes_url || variant.classroom_url;

  return (
    <>
      <ButtonLink href={backHref} variant="ghost" size="sm" className="-ml-3 mb-2">
        <ArrowLeft className="size-4" /> {backLabel}
      </ButtonLink>
      <PageHeader
        title="Черновик және конспект"
        description={
          <>
            {variantHeading(variant)} · {variant.courses?.title}
            {variant.homework_deadline && <> · Дедлайн: {formatDateTime(variant.homework_deadline)}</>}
          </>
        }
        actions={
          <>
            {draftUrl && (
              <a href={draftUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Черновик (Classroom) <ExternalLink className="size-4" />
              </a>
            )}
            {notesUrl && (
              <a href={notesUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Конспект (Classroom) <ExternalLink className="size-4" />
              </a>
            )}
          </>
        }
      />
      {!draftUrl && !notesUrl && (
        <Alert tone="warning" className="mb-5">
          Classroom сілтемелері қойылмаған — оқушылар бұл бөлімдерді көрмейді.
          {settingsHint && " Нұсқа редакторы → «Нұсқа баптаулары» → «Черновик және конспект»."}
        </Alert>
      )}
      {error && (
        <Alert tone="error" className="mb-5">
          Оқушылар тізімін жүктеу мүмкін болмады.
        </Alert>
      )}
      <p className="mb-4 text-sm text-slate-500">Оқушы Classroom-ға салса — галочка қойыңыз. Әр белгі бірден сақталады және оқушыға курс бетінде ✓ болып көрінеді.</p>
      <HomeworkChecklist variantId={variantId} students={students} />
    </>
  );
}
