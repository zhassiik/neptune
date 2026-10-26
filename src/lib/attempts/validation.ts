import { z } from "zod";
import { MAX_MULTIPLE_SELECTIONS } from "@/lib/scoring";

export const answerPayloadSchema = z.object({
  questionId: z.string().uuid(),
  selected: z.array(z.string().uuid()).max(6).optional(),
  matching: z.record(z.string().uuid(), z.string().uuid()).optional(),
});

export const saveAnswersSchema = z.object({
  answers: z.array(answerPayloadSchema).max(40),
});

export type AnswerPayload = z.infer<typeof answerPayloadSchema>;

export interface QuestionMeta {
  type: "single" | "matching" | "multiple";
  optionIds: Set<string>;
  itemIds: Set<string>;
}

/** Жауапты сұрақ құрылымына сәйкес тазалайды. Сәйкес келмесе — null. */
export function sanitizeAnswer(payload: AnswerPayload, meta: QuestionMeta) {
  if (meta.type === "matching") {
    const matching: Record<string, string> = {};
    for (const [itemId, optionId] of Object.entries(payload.matching ?? {})) {
      if (meta.itemIds.has(itemId) && meta.optionIds.has(optionId)) matching[itemId] = optionId;
    }
    return { selected_option_ids: [] as string[], matching_answers: matching };
  }

  const selected = Array.from(new Set(payload.selected ?? [])).filter((id) => meta.optionIds.has(id));
  if (meta.type === "single" && selected.length > 1) return null;
  if (meta.type === "multiple" && selected.length > MAX_MULTIPLE_SELECTIONS) return null;
  return { selected_option_ids: selected, matching_answers: {} };
}
