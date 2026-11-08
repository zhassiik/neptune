import { describe, expect, it } from "vitest";
import { maxScoreForTypes } from "@/lib/scoring";
import { checkVariantCompleteness, draftType, type StoredQuestion } from "@/lib/admin/question-schema";
import { defaultPlanet, isPlanetKey, PLANET_KEYS, PLANETS } from "@/lib/planets";
import { variantHeading } from "@/lib/video";

const single = (position: number): StoredQuestion => ({
  position,
  type: "single",
  prompt: "2+2?",
  image_path: null,
  answer_options: [
    { text: "4", is_correct: true },
    { text: "5", is_correct: false },
    { text: "6", is_correct: false },
    { text: "7", is_correct: false },
  ],
  matching_items: [],
  matching_options: [],
});

describe("еркін тест (practice)", () => {
  it("ең жоғары балл — сұрақ түрлерінің қосындысы", () => {
    expect(maxScoreForTypes(["single", "single", "matching", "multiple"])).toBe(6);
    expect(maxScoreForTypes([])).toBe(0);
  });
  it("толықтығы: кемінде бір сұрақ, әрқайсысы толық; 40-қа дейін толтыру міндетті емес", () => {
    expect(checkVariantCompleteness([], "practice")).toEqual([{ position: 1, issue: "сұрақ қосылмаған" }]);
    expect(checkVariantCompleteness([single(1), single(2), single(3)], "practice")).toEqual([]);
    const broken = { ...single(2), answer_options: single(2).answer_options.map((o) => ({ ...o, is_correct: false })) };
    expect(checkVariantCompleteness([single(1), broken], "practice").map((p) => p.position)).toEqual([2]);
  });
  it("ҰБТ нұсқасы бұрынғыдай 40 сұрақты талап етеді", () => {
    expect(checkVariantCompleteness([single(1)], "ubt")).toHaveLength(39);
  });
  it("сұрақ түрі: еркін тестте таңдалғаны, ҰБТ-да нөмірден", () => {
    expect(draftType({ position: 1, type: "matching" })).toBe("matching");
    expect(draftType({ position: 33 })).toBe("matching");
    expect(draftType({ position: 38 })).toBe("multiple");
  });
  it("тақырып: еркін тестте нөмірсіз", () => {
    expect(variantHeading({ position: 1, title: "Практикалық сабақ", kind: "practice" })).toBe("Практикалық сабақ");
    expect(variantHeading({ position: 7, title: "Бақылау", kind: "ubt" })).toBe("НҰСҚА 7. Бақылау");
  });
});

describe("ғаламшарлар", () => {
  it("10 ғаламшар, әрқайсысының қазақша атауы бар", () => {
    expect(PLANET_KEYS).toHaveLength(10);
    expect(PLANETS.venus.name).toBe("Шолпан");
    expect(PLANETS.earth.name).toBe("Жер");
    expect(isPlanetKey("neptune")).toBe(true);
    expect(isPlanetKey("pluto")).toBe(false);
  });
  it("әдепкі ғаламшар реті бойынша: 1 — Меркурий … 8 — Нептун, 11 — қайтадан Меркурий", () => {
    expect(defaultPlanet(1)).toBe("mercury");
    expect(defaultPlanet(8)).toBe("neptune");
    expect(defaultPlanet(11)).toBe("mercury");
  });
});
