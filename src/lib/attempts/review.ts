import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AnswerResult } from "@/lib/scoring";
import type { ReviewQuestion, TestAttempt, TestVariant } from "@/lib/types";
import { fetchRawQuestions, signImageUrls, toPublicQuestion } from "./questions";

export interface AttemptReview {
  attempt: TestAttempt;
  variant: Pick<TestVariant, "id" | "title" | "subject" | "position" | "show_correct_answers" | "video_url" | "video_provider" | "cloudflare_video_uid"> & { courses: { slug: string; title: string } | null };
  student: { full_name: string; email: string | null } | null;
  showAnswers: boolean;
  questions: ReviewQuestion[];
}

/**
 * Аяқталған талпыныстың толық талдауы.
 * Дұрыс жауаптар тек тест аяқталғаннан кейін және мұғалім рұқсат етсе ғана қосылады.
 */
export async function loadAttemptReview(attemptId: string, viewer: { id: string; isAdmin: boolean }): Promise<AttemptReview | null> {
  const admin = createAdminClient();
  const { data: attempt } = await admin.from("test_attempts").select("*").eq("id", attemptId).maybeSingle<TestAttempt>();
  if (!attempt) return null;
  if (attempt.student_id !== viewer.id && !viewer.isAdmin) return null;
  if (attempt.status !== "submitted") return null;

  const [{ data: variant }, { data: student }, raw, { data: scores }, { data: answers }] = await Promise.all([
    admin
      .from("test_variants")
      .select("*, courses(slug, title)")
      .eq("id", attempt.variant_id)
      .single<AttemptReview["variant"]>(),
    admin.from("profiles").select("full_name, email").eq("id", attempt.student_id).maybeSingle(),
    fetchRawQuestions(admin, attempt.variant_id),
    admin.from("attempt_scores").select("question_id, points, max_points, result").eq("attempt_id", attempt.id),
    admin.from("student_answers").select("question_id, selected_option_ids, matching_answers").eq("attempt_id", attempt.id),
  ]);
  if (!variant) return null;

  const showAnswers = variant.show_correct_answers || viewer.isAdmin;
  const urls = await signImageUrls(admin, raw.map((q) => q.image_path));
  const scoreMap = new Map((scores ?? []).map((s) => [s.question_id, s]));
  const answerMap = new Map((answers ?? []).map((a) => [a.question_id, a]));

  const questions: ReviewQuestion[] = raw.map((q) => {
    const score = scoreMap.get(q.id);
    const ans = answerMap.get(q.id);
    return {
      ...toPublicQuestion(q, urls),
      points: score?.points ?? 0,
      maxPoints: score?.max_points ?? (q.type === "single" ? 1 : 2),
      result: (score?.result ?? "unanswered") as AnswerResult,
      studentSelected: ans?.selected_option_ids ?? [],
      studentMatching: (ans?.matching_answers ?? {}) as Record<string, string>,
      correctOptionIds: showAnswers ? q.answer_options.filter((o) => o.is_correct).map((o) => o.id) : null,
      correctMatching: showAnswers ? Object.fromEntries(q.matching_items.map((i) => [i.id, i.correct_option_id])) : null,
      explanation: showAnswers ? q.explanation : null,
    };
  });

  return { attempt, variant, student, showAnswers, questions };
}
