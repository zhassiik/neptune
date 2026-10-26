import { describe, expect, it } from "vitest";
import { sanitizeAnswer } from "./validation";

const Q = "5b0a9c9e-0f7c-4c1a-9a1e-0a0a0a0a0a01";
const ids = Array.from({ length: 6 }, (_, i) => `5b0a9c9e-0f7c-4c1a-9a1e-0a0a0a0a0b0${i}`);

describe("sanitizeAnswer", () => {
  const multiple = { type: "multiple" as const, optionIds: new Set(ids), itemIds: new Set<string>() };

  it("multiple: 3-тен көп таңдау қабылданбайды", () => {
    expect(sanitizeAnswer({ questionId: Q, selected: ids.slice(0, 4) }, multiple)).toBeNull();
    expect(sanitizeAnswer({ questionId: Q, selected: ids.slice(0, 3) }, multiple)?.selected_option_ids).toHaveLength(3);
  });

  it("бөтен және қайталанған ID-лер алынып тасталады", () => {
    const res = sanitizeAnswer({ questionId: Q, selected: [ids[0], ids[0], "00000000-0000-4000-8000-000000000000"] }, multiple);
    expect(res?.selected_option_ids).toEqual([ids[0]]);
  });

  it("single: бірден көп таңдау қабылданбайды", () => {
    const single = { ...multiple, type: "single" as const };
    expect(sanitizeAnswer({ questionId: Q, selected: [ids[0], ids[1]] }, single)).toBeNull();
  });

  it("matching: тек осы сұрақтың элементтері мен опциялары сақталады", () => {
    const matching = { type: "matching" as const, optionIds: new Set([ids[0], ids[1]]), itemIds: new Set([ids[4]]) };
    const res = sanitizeAnswer({ questionId: Q, matching: { [ids[4]]: ids[1], [ids[5]]: ids[0] } }, matching);
    expect(res?.matching_answers).toEqual({ [ids[4]]: ids[1] });
  });
});
