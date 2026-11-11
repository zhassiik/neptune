import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("Қазақстан нөмірлерінің әр түрлі жазылуы", () => {
    expect(normalizePhone("+7 (700) 123-45-67")).toBe("+77001234567");
    expect(normalizePhone("8 700 123 45 67")).toBe("+77001234567");
    expect(normalizePhone("87001234567")).toBe("+77001234567");
    expect(normalizePhone("77001234567")).toBe("+77001234567");
    expect(normalizePhone("7001234567")).toBe("+77001234567");
  });

  it("халықаралық нөмір «+» арқылы", () => {
    expect(normalizePhone("+998 90 123 45 67")).toBe("+998901234567");
  });

  it("дұрыс емес нөмірлер — null", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("+7 700 12")).toBeNull();
    expect(normalizePhone("8 700 abc 45 67")).toBeNull();
    expect(normalizePhone("1234567890")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("+7 нөмірін оқуға ыңғайлы етеді", () => {
    expect(formatPhone("+77001234567")).toBe("+7 700 123 45 67");
    expect(formatPhone("+998901234567")).toBe("+998901234567");
    expect(formatPhone(null)).toBe("");
  });
});
