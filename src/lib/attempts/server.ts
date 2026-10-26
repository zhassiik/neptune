import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreAttempt, type StudentAnswer } from "@/lib/scoring";
import { fetchRawQuestions, toAnswerKey } from "./questions";
import { sanitizeAnswer, type AnswerPayload, type QuestionMeta } from "./validation";
import type { TestAttempt } from "@/lib/types";

export const ANSWER_GRACE_MS = 2 * 60_000;

export class AttemptError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export async function getOwnAttempt(admin: SupabaseClient, attemptId: string, userId: string) {
  const { data, error } = await admin.from("test_attempts").select("*").eq("id", attemptId).maybeSingle<TestAttempt>();
  if (error) throw error;
  if (!data || data.student_id !== userId) throw new AttemptError("Талпыныс табылмады", 404);
  return data;
}

export function isPastDeadline(attempt: TestAttempt, graceMs = ANSWER_GRACE_MS) {
  return !!attempt.deadline_at && Date.now() > new Date(attempt.deadline_at).getTime() + graceMs;
}

export async function loadQuestionMeta(admin: SupabaseClient, variantId: string) {
  const { data, error } = await admin
    .from("questions")
    .select("id, type, answer_options(id), matching_items(id), matching_options(id)")
    .eq("variant_id", variantId);
  if (error) throw error;
  const meta = new Map<string, QuestionMeta>();
  for (const q of data ?? []) {
    const isMatching = q.type === "matching";
    meta.set(q.id, {
      type: q.type,
      optionIds: new Set((isMatching ? q.matching_options : q.answer_options).map((o: { id: string }) => o.id)),
      itemIds: new Set(q.matching_items.map((i: { id: string }) => i.id)),
    });
  }
  return meta;
}

export function buildAnswerRows(attemptId: string, answers: AnswerPayload[], meta: Map<string, QuestionMeta>) {
  const rows = [];
  for (const a of answers) {
    const m = meta.get(a.questionId);
    if (!m) throw new AttemptError("Сұрақ бұл нұсқаға жатпайды", 400);
    const clean = sanitizeAnswer(a, m);
    if (!clean) throw new AttemptError("Жауап форматы дұрыс емес", 400);
    rows.push({ attempt_id: attemptId, question_id: a.questionId, ...clean });
  }
  return rows;
}

/**
 * Тестті аяқтау: жауаптарды жүктеп, балды серверде есептеп, нәтижені атомарлы жазады.
 * admin — service_role клиенті (дұрыс жауаптарды оқу үшін).
 */
export async function submitAttempt(admin: SupabaseClient, attempt: TestAttempt, finalAnswers: AnswerPayload[] = []) {
  if (attempt.status === "submitted") return { alreadySubmitted: true };

  if (finalAnswers.length > 0 && !isPastDeadline(attempt)) {
    const meta = await loadQuestionMeta(admin, attempt.variant_id);
    const rows = buildAnswerRows(attempt.id, finalAnswers, meta);
    if (rows.length > 0) {
      const { error } = await admin.from("student_answers").upsert(rows, { onConflict: "attempt_id,question_id" });
      if (error) throw error;
    }
  }

  const [raw, answersRes] = await Promise.all([
    fetchRawQuestions(admin, attempt.variant_id),
    admin.from("student_answers").select("question_id, selected_option_ids, matching_answers").eq("attempt_id", attempt.id),
  ]);
  if (answersRes.error) throw answersRes.error;

  const answers: Record<string, StudentAnswer> = {};
  for (const row of answersRes.data ?? []) {
    answers[row.question_id] = {
      selectedOptionIds: row.selected_option_ids ?? [],
      matchingAnswers: (row.matching_answers ?? {}) as Record<string, string>,
    };
  }

  const result = scoreAttempt(raw.map(toAnswerKey), answers);
  const payload = result.questions.map((q) => ({
    question_id: q.questionId,
    position: q.position,
    points: q.points,
    max_points: q.maxPoints,
    result: q.result,
  }));

  const { data: ok, error } = await admin.rpc("finalize_attempt", { p_attempt_id: attempt.id, p_scores: payload });
  if (error) throw error;
  return { alreadySubmitted: ok === false, totalScore: result.totalScore };
}
