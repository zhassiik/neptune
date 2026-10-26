import { describe, expect, it } from "vitest";
import { checkVariantCompleteness, validateQuestion, type QuestionDraft, type StoredQuestion } from "./question-schema";

const VARIANT = "6f1c2c1e-1b1a-4c55-9a39-0d3c2a1b9f10";
const opt = (text: string, isCorrect = false) => ({ id: null, key: `k-${text}`, text, isCorrect });

function single(overrides: Partial<QuestionDraft> = {}): QuestionDraft {
  return {
    variantId: VARIANT,
    position: 1,
    prompt: "Сұрақ мәтіні",
    imagePath: null,
    explanation: "",
    options: [opt("А", true), opt("Ә"), opt("Б"), opt("В")],
    matchingOptions: [],
    matchingItems: [],
    ...overrides,
  };
}

describe("validateQuestion", () => {
  it("дұрыс single сұрақ өтеді", () => {
    expect(validateQuestion(single()).ok).toBe(true);
  });

  it("сурет те, мәтін де жоқ болса — қате", () => {
    const res = validateQuestion(single({ prompt: "  " }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.content).toBeDefined();
  });

  it("сурет болса, мәтін міндетті емес", () => {
    const res = validateQuestion(single({ prompt: "", imagePath: `variants/${VARIANT}/q1-abc.webp` }));
    expect(res.ok).toBe(true);
  });

  it("single: дұрыс жауап белгіленбесе немесе екеу болса — қате", () => {
    const none = validateQuestion(single({ options: [opt("1"), opt("2"), opt("3"), opt("4")] }));
    const two = validateQuestion(single({ options: [opt("1", true), opt("2", true), opt("3"), opt("4")] }));
    expect(!none.ok && none.errors.correct).toBeTruthy();
    expect(!two.ok && two.errors.correct).toBeTruthy();
  });

  it("single: 3 немесе 6 нұсқа — қате", () => {
    expect(validateQuestion(single({ options: [opt("1", true), opt("2"), opt("3")] })).ok).toBe(false);
    expect(validateQuestion(single({ options: [opt("1", true), opt("2"), opt("3"), opt("4"), opt("5"), opt("6")] })).ok).toBe(false);
  });

  it("тек скрин + дұрыс әріп (мәтінсіз нұсқалар) жарамды", () => {
    const blank = (k: string, c = false) => ({ id: null, key: k, text: "", isCorrect: c });
    const res = validateQuestion(single({ prompt: "", imagePath: `variants/${VARIANT}/q1-a.webp`, options: [blank("a"), blank("b", true), blank("c"), blank("d")] }));
    expect(res.ok).toBe(true);
  });

  it("тым ұзын нұсқа мәтіні өріс деңгейінде белгіленеді", () => {
    const res = validateQuestion(single({ options: [opt("1", true), opt("2"), opt("3"), { ...opt("x"), text: "ә".repeat(1001) }] }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.optionTexts?.["k-x"]).toBeDefined();
  });

  it("matching: элемент мәтіндері міндетті емес", () => {
    const res = validateQuestion(
      single({
        position: 32,
        options: [],
        matchingOptions: [opt(""), { ...opt(""), key: "k2" }],
        matchingItems: [
          { label: "A", text: "", correctKey: "k-" },
          { label: "B", text: "", correctKey: "k2" },
        ],
      }),
    );
    expect(res.ok).toBe(true);
  });

  it("қайталанған нұсқалар — қате", () => {
    const res = validateQuestion(single({ options: [opt("Ядро", true), { ...opt("ядро"), key: "dup" }, opt("3"), opt("4")] }));
    expect(res.ok).toBe(false);
  });

  it("multiple: 1–3 дұрыс жауап, 5–6 нұсқа", () => {
    const base = { position: 36 };
    const ok = validateQuestion(single({ ...base, options: [opt("1", true), opt("2", true), opt("3"), opt("4"), opt("5")] }));
    const four = validateQuestion(single({ ...base, options: [opt("1", true), opt("2", true), opt("3", true), opt("4", true), opt("5")] }));
    const tooFew = validateQuestion(single({ ...base, options: [opt("1", true), opt("2"), opt("3"), opt("4")] }));
    expect(ok.ok).toBe(true);
    expect(four.ok).toBe(false);
    expect(tooFew.ok).toBe(false);
  });

  it("matching: A мен B үшін дұрыс сәйкестік міндетті", () => {
    const draft = single({
      position: 31,
      options: [],
      matchingOptions: [opt("x"), opt("y"), opt("z")],
      matchingItems: [
        { label: "A", text: "Элемент A", correctKey: "k-x" },
        { label: "B", text: "Элемент B", correctKey: null },
      ],
    });
    const res = validateQuestion(draft);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.matchingA).toBeUndefined();
      expect(res.errors.matchingB).toBeDefined();
    }
    draft.matchingItems[1].correctKey = "k-z";
    expect(validateQuestion(draft).ok).toBe(true);
  });
});

describe("checkVariantCompleteness", () => {
  it("40 толық сұрақ — мәселе жоқ, бос нұсқа — 40 мәселе", () => {
    const qs: StoredQuestion[] = Array.from({ length: 40 }, (_, i) => {
      const position = i + 1;
      if (position <= 30)
        return { position, type: "single", prompt: "q", image_path: null, answer_options: [1, 2, 3, 4].map((n) => ({ text: `${n}`, is_correct: n === 1 })), matching_items: [], matching_options: [] };
      if (position <= 35)
        return {
          position,
          type: "matching",
          prompt: "q",
          image_path: null,
          answer_options: [],
          matching_options: [{ id: "o1", text: "1" }, { id: "o2", text: "2" }],
          matching_items: [
            { label: "A", text: "a", correct_option_id: "o1" },
            { label: "B", text: "b", correct_option_id: "o2" },
          ],
        };
      return { position, type: "multiple", prompt: "q", image_path: null, answer_options: [1, 2, 3, 4, 5].map((n) => ({ text: `${n}`, is_correct: n < 3 })), matching_items: [], matching_options: [] };
    });
    expect(checkVariantCompleteness(qs)).toEqual([]);
    expect(checkVariantCompleteness([])).toHaveLength(40);

    qs[0].answer_options = qs[0].answer_options.map((o) => ({ ...o, is_correct: false }));
    expect(checkVariantCompleteness(qs)).toEqual([{ position: 1, issue: "дұрыс жауап белгіленбеген" }]);
  });
});
