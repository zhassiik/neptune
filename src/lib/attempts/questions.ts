import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnswerKey, QuestionType } from "@/lib/scoring";
import type { PublicQuestion } from "@/lib/types";

export const IMAGE_BUCKET = "question-images";
const SIGNED_URL_TTL = 60 * 60 * 6; // 6 сағат

interface RawQuestion {
  id: string;
  position: number;
  type: QuestionType;
  prompt: string | null;
  image_path: string | null;
  explanation: string | null;
  answer_options: { id: string; position: number; text: string; is_correct: boolean }[];
  matching_items: { id: string; label: "A" | "B"; text: string; correct_option_id: string | null }[];
  matching_options: { id: string; position: number; text: string }[];
}

/**
 * Нұсқаның барлық сұрақтарын (дұрыс жауаптарымен бірге) жүктейді.
 * Бұл деректер ешқашан тікелей клиентке жіберілмейді — toPublicQuestion арқылы тазаланады.
 */
export async function fetchRawQuestions(client: SupabaseClient, variantId: string): Promise<RawQuestion[]> {
  const { data, error } = await client
    .from("questions")
    .select(
      "id, position, type, prompt, image_path, explanation, answer_options(id, position, text, is_correct), matching_items(id, label, text, correct_option_id), matching_options(id, position, text)",
    )
    .eq("variant_id", variantId)
    .order("position");
  if (error) throw error;
  return ((data ?? []) as RawQuestion[]).map((q) => ({
    ...q,
    answer_options: [...q.answer_options].sort((a, b) => a.position - b.position),
    matching_options: [...q.matching_options].sort((a, b) => a.position - b.position),
    matching_items: [...q.matching_items].sort((a, b) => a.label.localeCompare(b.label)),
  }));
}

export async function signImageUrls(client: SupabaseClient, paths: (string | null)[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (unique.length === 0) return {};
  const { data, error } = await client.storage.from(IMAGE_BUCKET).createSignedUrls(unique, SIGNED_URL_TTL);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}

/** Дұрыс жауаптар мен түсіндірмені алып тастайды */
export function toPublicQuestion(q: RawQuestion, imageUrls: Record<string, string>): PublicQuestion {
  return {
    id: q.id,
    position: q.position,
    type: q.type,
    prompt: q.prompt,
    imageUrl: q.image_path ? (imageUrls[q.image_path] ?? null) : null,
    options: q.answer_options.map((o) => ({ id: o.id, text: o.text })),
    matchingItems: q.matching_items.map((i) => ({ id: i.id, label: i.label, text: i.text })),
    matchingOptions: q.matching_options.map((o) => ({ id: o.id, text: o.text })),
  };
}

export async function loadPublicQuestions(client: SupabaseClient, variantId: string) {
  const raw = await fetchRawQuestions(client, variantId);
  const urls = await signImageUrls(client, raw.map((q) => q.image_path));
  return { raw, questions: raw.map((q) => toPublicQuestion(q, urls)), imageUrls: urls };
}

export function toAnswerKey(q: RawQuestion): AnswerKey {
  if (q.type === "matching") {
    return {
      questionId: q.id,
      position: q.position,
      type: "matching",
      optionIds: q.matching_options.map((o) => o.id),
      items: q.matching_items.map((i) => ({ id: i.id, correctOptionId: i.correct_option_id })),
    };
  }
  return {
    questionId: q.id,
    position: q.position,
    type: q.type,
    optionIds: q.answer_options.map((o) => o.id),
    correctOptionIds: q.answer_options.filter((o) => o.is_correct).map((o) => o.id),
  };
}

export type { RawQuestion };
