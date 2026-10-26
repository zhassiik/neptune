import { describe, expect, it } from "vitest";
import {
  MAX_TOTAL_SCORE,
  SECTIONS,
  questionTypeForPosition,
  scoreAttempt,
  scoreMatching,
  scoreMultiple,
  scoreQuestion,
  scoreSingle,
  type AnswerKey,
} from "./index";

describe("questionTypeForPosition", () => {
  it("1–30 → single, 31–35 → matching, 36–40 → multiple", () => {
    expect(questionTypeForPosition(1)).toBe("single");
    expect(questionTypeForPosition(30)).toBe("single");
    expect(questionTypeForPosition(31)).toBe("matching");
    expect(questionTypeForPosition(35)).toBe("matching");
    expect(questionTypeForPosition(36)).toBe("multiple");
    expect(questionTypeForPosition(40)).toBe("multiple");
  });

  it("шектен тыс нөмірлерге қате береді", () => {
    expect(() => questionTypeForPosition(0)).toThrow(RangeError);
    expect(() => questionTypeForPosition(41)).toThrow(RangeError);
    expect(() => questionTypeForPosition(2.5)).toThrow(RangeError);
  });

  it("бөлімдердің максималды балдарының қосындысы 50", () => {
    const total = SECTIONS.reduce((s, sec) => s + (sec.to - sec.from + 1) * sec.pointsEach, 0);
    expect(total).toBe(MAX_TOTAL_SCORE);
  });
});

describe("scoreSingle (1–30)", () => {
  it("дұрыс жауап — 1 балл", () => expect(scoreSingle("a", ["a"])).toBe(1));
  it("қате жауап — 0 балл", () => expect(scoreSingle("a", ["b"])).toBe(0));
  it("жауапсыз — 0 балл", () => expect(scoreSingle("a", [])).toBe(0));
  it("бірнеше таңдау — 0 балл", () => expect(scoreSingle("a", ["a", "b"])).toBe(0));
  it("бірдей ID қайталанса, бір таңдау деп есептеледі", () => expect(scoreSingle("a", ["a", "a"])).toBe(1));
});

describe("scoreMatching (31–35)", () => {
  const items = [
    { id: "A", correctOptionId: "o1" },
    { id: "B", correctOptionId: "o3" },
  ];

  it("A және B екеуі дұрыс — 2 балл", () => expect(scoreMatching(items, { A: "o1", B: "o3" })).toBe(2));
  it("тек A дұрыс — 1 балл", () => expect(scoreMatching(items, { A: "o1", B: "o2" })).toBe(1));
  it("тек B дұрыс — 1 балл", () => expect(scoreMatching(items, { A: "o2", B: "o3" })).toBe(1));
  it("тек біреуіне жауап беріліп, ол дұрыс — 1 балл", () => expect(scoreMatching(items, { A: "o1" })).toBe(1));
  it("екеуі де қате — 0 балл", () => expect(scoreMatching(items, { A: "o2", B: "o1" })).toBe(0));
  it("жауапсыз — 0 балл", () => expect(scoreMatching(items, {})).toBe(0));
  it("дұрыс жауабы белгіленбеген элемент балл бермейді", () =>
    expect(scoreMatching([{ id: "A", correctOptionId: null }], { A: "o1" })).toBe(0));
});

describe("scoreMultiple (36–40): қателік = max(белгіленбеген дұрыс, артық қате)", () => {
  // [дұрыс жауаптар, оқушының жауабы, күтілетін балл, түсіндірме]
  const cases: [string, string, number, string][] = [
    // 2 балл — толық және қатесіз
    ["A", "A", 2, "толық дұрыс"],
    ["AB", "AB", 2, "толық дұрыс"],
    ["ABC", "ABC", 2, "толық дұрыс (3 балл емес — максимум 2)"],
    // 1 балл — бір қателік
    ["A", "AB", 1, "бір қате жауап артық"],
    ["AB", "A", 1, "бір дұрыс жауап белгіленбеген"],
    ["AB", "ABC", 1, "бір қате жауап артық"],
    ["ABC", "AB", 1, "бір дұрыс жауап белгіленбеген"],
    ["ABC", "ABE", 1, "C орнына E белгіленген"],
    ["ABC", "ADC", 1, "B орнына D белгіленген"],
    ["ABC", "ABCD", 1, "бір қате жауап артық"],
    ["AB", "AC", 1, "B орнына C белгіленген"],
    // 0 балл — екі немесе одан көп қателік
    ["A", "ABC", 0, "екі қате жауап артық"],
    ["AB", "ADE", 0, "екі қате жауап белгіленген"],
    ["AB", "ABDE", 0, "дұрыстары толық, бірақ екі қате артық"],
    ["ABC", "ADE", 0, "екі дұрыстың орнына екі қате"],
    ["ABC", "A", 0, "екі дұрыс жауап белгіленбеген"],
    ["ABC", "", 0, "жауап берілмеген"],
    ["A", "", 0, "жауап берілмеген"],
    ["A", "B", 0, "бірде-бір дұрыс жауап белгіленбеген"],
    ["AB", "CD", 0, "бірде-бір дұрыс жауап белгіленбеген"],
  ];

  for (const [correct, selected, points, why] of cases) {
    it(`дұрыс ${correct}, белгіленген ${selected || "—"} → ${points} балл (${why})`, () => {
      expect(scoreMultiple([...correct], [...selected])).toBe(points);
    });
  }

  it("қайталанған ID бір рет есептеледі", () => expect(scoreMultiple(["A"], ["A", "A"])).toBe(2));
  it("дұрыс жауабы жоқ сұрақ — 0", () => expect(scoreMultiple([], ["A"])).toBe(0));
});

describe("scoreQuestion", () => {
  const single: AnswerKey = {
    questionId: "q1",
    position: 1,
    type: "single",
    optionIds: ["a", "b", "c", "d"],
    correctOptionIds: ["b"],
  };

  it("нәтиже түрін анықтайды", () => {
    expect(scoreQuestion(single, { selectedOptionIds: ["b"] }).result).toBe("correct");
    expect(scoreQuestion(single, { selectedOptionIds: ["a"] }).result).toBe("incorrect");
    expect(scoreQuestion(single, { selectedOptionIds: [] }).result).toBe("unanswered");
    expect(scoreQuestion(single, undefined).result).toBe("unanswered");
  });

  it("басқа сұрақтың ID-лері елемейді", () => {
    const res = scoreQuestion(single, { selectedOptionIds: ["foreign", "b"] });
    expect(res.points).toBe(1);
  });

  it("matching: жартылай дұрыс → partial, бөтен опция есептелмейді", () => {
    const key: AnswerKey = {
      questionId: "q31",
      position: 31,
      type: "matching",
      optionIds: ["o1", "o2", "o3"],
      items: [
        { id: "iA", correctOptionId: "o1" },
        { id: "iB", correctOptionId: "o2" },
      ],
    };
    expect(scoreQuestion(key, { matchingAnswers: { iA: "o1", iB: "o3" } })).toMatchObject({
      points: 1,
      maxPoints: 2,
      result: "partial",
    });
    expect(scoreQuestion(key, { matchingAnswers: { iA: "x", iB: "y" } }).points).toBe(0);
    expect(scoreQuestion(key, { matchingAnswers: { other: "o1" } }).result).toBe("unanswered");
  });
});

describe("scoreAttempt", () => {
  function buildKeys(): AnswerKey[] {
    const keys: AnswerKey[] = [];
    for (let p = 1; p <= 40; p++) {
      const id = `q${p}`;
      if (p <= 30) {
        keys.push({ questionId: id, position: p, type: "single", optionIds: [`${id}a`, `${id}b`, `${id}c`, `${id}d`], correctOptionIds: [`${id}a`] });
      } else if (p <= 35) {
        keys.push({
          questionId: id,
          position: p,
          type: "matching",
          optionIds: [`${id}o1`, `${id}o2`, `${id}o3`],
          items: [
            { id: `${id}A`, correctOptionId: `${id}o1` },
            { id: `${id}B`, correctOptionId: `${id}o2` },
          ],
        });
      } else {
        keys.push({
          questionId: id,
          position: p,
          type: "multiple",
          optionIds: [`${id}1`, `${id}2`, `${id}3`, `${id}4`, `${id}5`],
          correctOptionIds: [`${id}1`, `${id}2`],
        });
      }
    }
    return keys;
  }

  function perfectAnswers(keys: AnswerKey[]) {
    return Object.fromEntries(
      keys.map((k) =>
        k.type === "matching"
          ? [k.questionId, { matchingAnswers: Object.fromEntries(k.items.map((i) => [i.id, i.correctOptionId!])) }]
          : [k.questionId, { selectedOptionIds: k.correctOptionIds }],
      ),
    );
  }

  it("барлығы дұрыс — 50/50", () => {
    const keys = buildKeys();
    const res = scoreAttempt(keys, perfectAnswers(keys));
    expect(res.totalScore).toBe(50);
    expect(res.maxScore).toBe(50);
    expect(res.percent).toBe(100);
    expect(res.counts).toEqual({ correct: 40, partial: 0, incorrect: 0, unanswered: 0 });
  });

  it("бос тест — 0/50, барлығы жауапсыз", () => {
    const res = scoreAttempt(buildKeys(), {});
    expect(res.totalScore).toBe(0);
    expect(res.maxScore).toBe(50);
    expect(res.counts.unanswered).toBe(40);
  });

  it("аралас жағдай дұрыс есептеледі", () => {
    const keys = buildKeys();
    const answers = perfectAnswers(keys);
    answers.q1 = { selectedOptionIds: ["q1b"] }; // -1
    delete answers.q2; // -1
    answers.q31 = { matchingAnswers: { q31A: "q31o1", q31B: "q31o3" } }; // -1 (partial)
    answers.q36 = { selectedOptionIds: ["q361"] }; // -1 (partial)
    answers.q37 = { selectedOptionIds: ["q373", "q374"] }; // -2

    const res = scoreAttempt(keys, answers);
    expect(res.totalScore).toBe(44);
    expect(res.counts).toEqual({ correct: 35, partial: 2, incorrect: 2, unanswered: 1 });
    expect(res.questions.map((q) => q.position)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    expect(res.percent).toBe(88);
  });
});
