import { z } from "zod";
import { questionTypeForPosition, type QuestionType } from "@/lib/scoring";

/**
 * Сұрақ редакторының форма құрылымы және валидациясы.
 * Клиентте (жедел қате көрсету) және серверде (server action) бірдей қолданылады.
 */

export const OPTION_LIMITS: Record<Exclude<QuestionType, "matching">, { min: number; max: number }> = {
  single: { min: 4, max: 5 },
  multiple: { min: 5, max: 6 },
};
export const MATCHING_OPTION_LIMITS = { min: 2, max: 10 };
export const MAX_CORRECT_MULTIPLE = 3;

export interface OptionDraft {
  id: string | null;
  key: string;
  text: string;
  isCorrect: boolean;
}

export interface MatchingItemDraft {
  label: "A" | "B";
  text: string;
  correctKey: string | null;
}

export interface QuestionDraft {
  variantId: string;
  position: number;
  prompt: string;
  imagePath: string | null;
  explanation: string;
  options: OptionDraft[];
  matchingOptions: OptionDraft[];
  matchingItems: MatchingItemDraft[];
}

const optionSchema = z.object({
  id: z.string().uuid().nullable(),
  key: z.string().min(1).max(64),
  // Мәтін міндетті емес: мұғалім тек скрин жүктеп, дұрыс әріпті белгілей алады
  text: z.string().trim().max(1000, "Мәтін тым ұзын (макс. 1000)"),
  isCorrect: z.boolean(),
});

const baseSchema = z.object({
  variantId: z.string().uuid(),
  position: z.number().int().min(1).max(40),
  prompt: z.string().trim().max(4000, "Сұрақ мәтіні тым ұзын (макс. 4000)"),
  imagePath: z
    .string()
    .regex(/^variants\/[0-9a-f-]{36}\/[\w.-]+$/i, "Сурет жолы дұрыс емес")
    .nullable(),
  explanation: z.string().trim().max(4000, "Түсіндірме тым ұзын (макс. 4000)"),
  options: z.array(optionSchema).max(10),
  matchingOptions: z.array(optionSchema.extend({ text: optionSchema.shape.text.max(500, "Мәтін тым ұзын (макс. 500)") })).max(10),
  matchingItems: z
    .array(
      z.object({
        label: z.enum(["A", "B"]),
        text: z.string().trim().max(500, "Мәтін тым ұзын (макс. 500)"),
        correctKey: z.string().nullable(),
      }),
    )
    .max(2),
});

export type QuestionErrors = Partial<Record<"form" | "content" | "options" | "correct" | "matchingA" | "matchingB" | "matchingOptions" | "explanation" | "prompt", string>> & {
  optionTexts?: Record<string, string>;
};

export function validateQuestion(draft: QuestionDraft): { ok: true; data: QuestionDraft } | { ok: false; errors: QuestionErrors } {
  const errors: QuestionErrors = {};
  const parsed = baseSchema.safeParse(draft);

  if (!parsed.success) {
    const optionTexts: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const [field, index] = issue.path;
      if ((field === "options" || field === "matchingOptions") && typeof index === "number") {
        const list = field === "options" ? draft.options : draft.matchingOptions;
        const key = list[index]?.key;
        if (key) optionTexts[key] = issue.message;
      } else if (field === "matchingItems" && typeof index === "number") {
        const label = draft.matchingItems[index]?.label;
        errors[label === "B" ? "matchingB" : "matchingA"] ??= issue.message;
      } else if (field === "prompt" || field === "explanation") {
        errors[field] ??= issue.message;
      } else {
        errors.form ??= issue.message;
      }
    }
    if (Object.keys(optionTexts).length) errors.optionTexts = optionTexts;
    return { ok: false, errors };
  }

  const data = parsed.data as QuestionDraft;
  const type = questionTypeForPosition(data.position);

  if (!data.imagePath && !data.prompt) {
    errors.content = "Сұраққа сурет жүктеңіз немесе сұрақ мәтінін жазыңыз";
  }

  if (type === "matching") {
    const a = data.matchingItems.find((i) => i.label === "A");
    const b = data.matchingItems.find((i) => i.label === "B");
    const keys = new Set(data.matchingOptions.map((o) => o.key));
    if (data.matchingOptions.length < MATCHING_OPTION_LIMITS.min) {
      errors.matchingOptions = `Кемінде ${MATCHING_OPTION_LIMITS.min} жауап нұсқасын енгізіңіз`;
    }
    for (const [item, key] of [
      [a, "matchingA"],
      [b, "matchingB"],
    ] as const) {
      if (!item || !item.correctKey || !keys.has(item.correctKey)) errors[key] = "Дұрыс сәйкестікті белгілеңіз";
    }
  } else {
    const limits = OPTION_LIMITS[type];
    if (data.options.length < limits.min || data.options.length > limits.max) {
      errors.options = `Жауап нұсқаларының саны ${limits.min}–${limits.max} болуы керек (қазір ${data.options.length})`;
    }
    const correct = data.options.filter((o) => o.isCorrect).length;
    if (type === "single" && correct !== 1) {
      errors.correct = correct === 0 ? "Дұрыс жауапты белгілеңіз" : "Тек бір дұрыс жауап болуы керек";
    }
    if (type === "multiple" && (correct < 1 || correct > MAX_CORRECT_MULTIPLE)) {
      errors.correct = correct === 0 ? "Кемінде бір дұрыс жауапты белгілеңіз" : `Дұрыс жауаптар саны ${MAX_CORRECT_MULTIPLE}-тен аспауы керек`;
    }
    const texts = data.options.map((o) => o.text.toLocaleLowerCase("kk")).filter(Boolean);
    if (new Set(texts).size !== texts.length) errors.options ??= "Жауап нұсқалары қайталанбауы керек";
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

/** save_question RPC-ке берілетін payload */
export function toRpcPayload(d: QuestionDraft) {
  return {
    prompt: d.prompt,
    image_path: d.imagePath,
    explanation: d.explanation,
    options: d.options.map((o) => ({ id: o.id, text: o.text, is_correct: o.isCorrect })),
    matching_options: d.matchingOptions.map((o) => ({ id: o.id, key: o.key, text: o.text })),
    matching_items: d.matchingItems.map((i) => ({ label: i.label, text: i.text, correct_key: i.correctKey })),
  };
}

/* ---------- Нұсқаның толықтығын тексеру (жариялау алдында) ---------- */

export interface StoredQuestion {
  position: number;
  type: QuestionType;
  prompt: string | null;
  image_path: string | null;
  answer_options: { text: string; is_correct: boolean }[];
  matching_items: { label: string; text: string; correct_option_id: string | null }[];
  matching_options: { id: string; text: string }[];
}

/** Сақталған сұрақтың толық екенін тексереді. Мәселе болса — қысқа сипаттама. */
export function questionIssue(q: StoredQuestion): string | null {
  if (!q.prompt && !q.image_path) return "сурет/мәтін жоқ";
  if (q.type === "matching") {
    const ids = new Set(q.matching_options.map((o) => o.id));
    if (q.matching_options.length < MATCHING_OPTION_LIMITS.min) return "жауап нұсқалары жеткіліксіз";
    for (const label of ["A", "B"]) {
      const item = q.matching_items.find((i) => i.label === label);
      if (!item) return `${label} элементі жоқ`;
      if (!item.correct_option_id || !ids.has(item.correct_option_id)) return `${label} үшін дұрыс жауап белгіленбеген`;
    }
    return null;
  }
  const limits = OPTION_LIMITS[q.type];
  if (q.answer_options.length < limits.min || q.answer_options.length > limits.max) return "жауап нұсқаларының саны дұрыс емес";
  const correct = q.answer_options.filter((o) => o.is_correct).length;
  if (q.type === "single" && correct !== 1) return "дұрыс жауап белгіленбеген";
  if (q.type === "multiple" && (correct < 1 || correct > MAX_CORRECT_MULTIPLE)) return "дұрыс жауаптар саны 1–3 болуы керек";
  return null;
}

export function checkVariantCompleteness(questions: StoredQuestion[]) {
  const byPos = new Map(questions.map((q) => [q.position, q]));
  const problems: { position: number; issue: string }[] = [];
  for (let p = 1; p <= 40; p++) {
    const q = byPos.get(p);
    if (!q) problems.push({ position: p, issue: "сұрақ қосылмаған" });
    else {
      const issue = questionIssue(q);
      if (issue) problems.push({ position: p, issue });
    }
  }
  return problems;
}
