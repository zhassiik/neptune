import type { AnswersMap, PublicQuestion } from "@/lib/types";

export interface AnswerRow {
  question_id: string;
  selected_option_ids: string[] | null;
  matching_answers: Record<string, string> | null;
}

export function rowsToAnswers(rows: AnswerRow[], questions: Pick<PublicQuestion, "id" | "type">[]): AnswersMap {
  const types = new Map(questions.map((q) => [q.id, q.type]));
  const map: AnswersMap = {};
  for (const r of rows) {
    const type = types.get(r.question_id);
    if (!type) continue;
    map[r.question_id] = type === "matching" ? { matching: r.matching_answers ?? {} } : { selected: r.selected_option_ids ?? [] };
  }
  return map;
}
