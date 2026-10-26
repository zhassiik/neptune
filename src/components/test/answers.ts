import type { ClientAnswer, PublicQuestion } from "@/lib/types";

export function isAnswered(q: Pick<PublicQuestion, "type">, a: ClientAnswer | undefined): boolean {
  if (!a) return false;
  if (q.type === "matching") return Object.values(a.matching ?? {}).some(Boolean);
  return (a.selected ?? []).length > 0;
}

export function toPayload(questionId: string, a: ClientAnswer | undefined) {
  return a?.matching ? { questionId, matching: a.matching } : { questionId, selected: a?.selected ?? [] };
}
