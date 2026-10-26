import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPublicQuestions } from "@/lib/attempts/questions";
import { AttemptError, getOwnAttempt, isPastDeadline, submitAttempt } from "@/lib/attempts/server";
import { rowsToAnswers, type AnswerRow } from "@/lib/attempts/mappers";
import { TestRunner } from "@/components/test/TestRunner";

export const metadata: Metadata = { title: "Тест" };
export const dynamic = "force-dynamic";

export default async function TestPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) notFound();

  const user = await requireUser(`/test/${attemptId}`);
  const admin = createAdminClient();

  let attempt;
  try {
    attempt = await getOwnAttempt(admin, attemptId, user.id);
  } catch (err) {
    if (err instanceof AttemptError) notFound();
    throw err;
  }

  if (attempt.status === "submitted") redirect(`/results/${attempt.id}`);

  // Уақыт өтіп кеткен болса — серверде автоматты аяқтау
  if (isPastDeadline(attempt)) {
    await submitAttempt(admin, attempt);
    redirect(`/results/${attempt.id}`);
  }

  const [{ data: variant }, { questions }, { data: answerRows }] = await Promise.all([
    admin.from("test_variants").select("title, position, courses(slug)").eq("id", attempt.variant_id).single<{ title: string; position: number; courses: { slug: string } | null }>(),
    loadPublicQuestions(admin, attempt.variant_id),
    admin.from("student_answers").select("question_id, selected_option_ids, matching_answers").eq("attempt_id", attempt.id),
  ]);

  return (
    <TestRunner
      mode="attempt"
      attemptId={attempt.id}
      title={variant ? `НҰСҚА №${variant.position}. ${variant.title}` : "ҰБТ нұсқасы"}
      questions={questions}
      initialAnswers={rowsToAnswers((answerRows ?? []) as AnswerRow[], questions)}
      deadline={attempt.deadline_at}
      serverNow={new Date().toISOString()}
      exitHref={variant?.courses ? `/courses/${variant.courses.slug}` : "/courses"}
    />
  );
}
