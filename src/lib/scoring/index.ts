/**
 * ҰБТ бағалау модулі.
 *
 * Таза функциялар: базаға, браузерге немесе Next.js-ке тәуелді емес.
 * Балл тек серверде (src/lib/attempts/submit.ts) осы модуль арқылы есептеледі.
 */

export type QuestionType = "single" | "matching" | "multiple";
export type AnswerResult = "correct" | "partial" | "incorrect" | "unanswered";

export const TOTAL_QUESTIONS = 40;
export const MAX_TOTAL_SCORE = 50;
export const MAX_MULTIPLE_SELECTIONS = 3;

export const SECTIONS = [
  { type: "single" as const, from: 1, to: 30, pointsEach: 1 },
  { type: "matching" as const, from: 31, to: 35, pointsEach: 2 },
  { type: "multiple" as const, from: 36, to: 40, pointsEach: 2 },
];

/** Сұрақ нөмірі бойынша оның типін анықтайды (1–30, 31–35, 36–40). */
export function questionTypeForPosition(position: number): QuestionType {
  if (!Number.isInteger(position) || position < 1 || position > TOTAL_QUESTIONS) {
    throw new RangeError(`Сұрақ нөмірі 1–${TOTAL_QUESTIONS} аралығында болуы керек: ${position}`);
  }
  if (position <= 30) return "single";
  if (position <= 35) return "matching";
  return "multiple";
}

export function maxPointsForType(type: QuestionType): number {
  return type === "single" ? 1 : 2;
}

// ---------------------------------------------------------------------
// Жеке сұрақ түрлерін бағалау
// ---------------------------------------------------------------------

/**
 * 1–30: бір дұрыс жауап.
 * Дұрыс жауап — 1 балл; қате, бос немесе бірнеше таңдау — 0 балл.
 */
export function scoreSingle(correctOptionId: string, selectedOptionIds: readonly string[]): number {
  const selected = unique(selectedOptionIds);
  return selected.length === 1 && selected[0] === correctOptionId ? 1 : 0;
}

/**
 * 31–35: сәйкестендіру (A және B).
 * Екеуі дұрыс — 2, біреуі дұрыс — 1, қалғаны — 0.
 */
export function scoreMatching(
  items: readonly { id: string; correctOptionId: string | null }[],
  answers: Readonly<Record<string, string | null | undefined>>,
): number {
  let points = 0;
  for (const item of items) {
    const chosen = answers[item.id];
    if (item.correctOptionId && chosen && chosen === item.correctOptionId) points += 1;
  }
  return Math.min(points, 2);
}

/**
 * 36–40: бірнеше дұрыс жауап (дұрыс жауаптар саны 1–3), максимум 2 балл.
 *
 * Екі сан бөлек есептеледі:
 *   missed — белгіленбей қалған дұрыс жауаптар саны;
 *   extra  — артық белгіленген қате жауаптар саны.
 * Қателік саны = max(missed, extra) (қосылмайды: бір дұрысты бір қатемен
 * алмастыру — бір қателік).
 *   0 қателік → 2 балл, 1 қателік → 1 балл, 2+ қателік → 0 балл.
 *
 * Қосымша шарттар:
 *   - ештеңе белгіленбесе → 0;
 *   - бірде-бір дұрыс жауап белгіленбесе → 0 (мысалы, дұрыс A, белгіленгені B).
 */
export function scoreMultiple(
  correctOptionIds: readonly string[],
  selectedOptionIds: readonly string[],
): number {
  const correct = new Set(correctOptionIds);
  const selected = unique(selectedOptionIds);

  if (correct.size === 0 || selected.length === 0) return 0;

  const correctSelected = selected.filter((id) => correct.has(id)).length;
  if (correctSelected === 0) return 0;

  const missed = correct.size - correctSelected;
  const extra = selected.length - correctSelected;
  const mistakes = Math.max(missed, extra);

  return mistakes === 0 ? 2 : mistakes === 1 ? 1 : 0;
}

// ---------------------------------------------------------------------
// Жалпы интерфейс
// ---------------------------------------------------------------------

export type AnswerKey =
  | { questionId: string; position: number; type: "single"; optionIds: string[]; correctOptionIds: string[] }
  | { questionId: string; position: number; type: "multiple"; optionIds: string[]; correctOptionIds: string[] }
  | {
      questionId: string;
      position: number;
      type: "matching";
      optionIds: string[];
      items: { id: string; correctOptionId: string | null }[];
    };

export interface StudentAnswer {
  selectedOptionIds?: string[];
  matchingAnswers?: Record<string, string | null | undefined>;
}

export interface QuestionScore {
  questionId: string;
  position: number;
  points: number;
  maxPoints: number;
  result: AnswerResult;
}

export interface AttemptScore {
  totalScore: number;
  maxScore: number;
  percent: number;
  counts: Record<AnswerResult, number>;
  questions: QuestionScore[];
}

/** Жауап мүлдем берілмеген бе (бөтен ID-лер есептелмейді). */
export function isAnswerEmpty(key: AnswerKey, answer: StudentAnswer | undefined): boolean {
  if (!answer) return true;
  if (key.type === "matching") {
    const itemIds = new Set(key.items.map((i) => i.id));
    return !Object.entries(answer.matchingAnswers ?? {}).some(([itemId, opt]) => itemIds.has(itemId) && !!opt);
  }
  return (answer.selectedOptionIds ?? []).length === 0;
}

export function scoreQuestion(key: AnswerKey, answer: StudentAnswer | undefined): QuestionScore {
  const maxPoints = maxPointsForType(key.type);
  const base = { questionId: key.questionId, position: key.position, maxPoints };

  if (isAnswerEmpty(key, answer)) {
    return { ...base, points: 0, result: "unanswered" };
  }

  let points: number;
  if (key.type === "matching") {
    const validOptions = new Set(key.optionIds);
    const sanitized: Record<string, string> = {};
    for (const [itemId, opt] of Object.entries(answer?.matchingAnswers ?? {})) {
      if (opt && validOptions.has(opt)) sanitized[itemId] = opt;
    }
    points = scoreMatching(key.items, sanitized);
  } else {
    // Бөтен (басқа сұрақтың) ID-лерін елемейміз
    const valid = new Set(key.optionIds);
    const selected = (answer?.selectedOptionIds ?? []).filter((id) => valid.has(id));
    points =
      key.type === "single"
        ? scoreSingle(key.correctOptionIds[0] ?? "", key.correctOptionIds.length === 1 ? selected : [])
        : scoreMultiple(key.correctOptionIds, selected);
  }

  const result: AnswerResult = points === maxPoints ? "correct" : points > 0 ? "partial" : "incorrect";
  return { ...base, points, result };
}

export function scoreAttempt(
  keys: readonly AnswerKey[],
  answers: Readonly<Record<string, StudentAnswer | undefined>>,
): AttemptScore {
  const counts: Record<AnswerResult, number> = { correct: 0, partial: 0, incorrect: 0, unanswered: 0 };
  const questions = [...keys]
    .sort((a, b) => a.position - b.position)
    .map((key) => {
      const score = scoreQuestion(key, answers[key.questionId]);
      counts[score.result] += 1;
      return score;
    });

  const totalScore = questions.reduce((sum, q) => sum + q.points, 0);
  const maxScore = questions.reduce((sum, q) => sum + q.maxPoints, 0);

  return {
    totalScore,
    maxScore,
    percent: maxScore === 0 ? 0 : Math.round((totalScore / maxScore) * 100),
    counts,
    questions,
  };
}

function unique(ids: readonly string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}
