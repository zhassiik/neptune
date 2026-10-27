import { describe, expect, it } from "vitest";
import { countdownParts } from "./countdown";

describe("countdownParts", () => {
  const target = new Date("2027-01-03T09:00:00+05:00").getTime();
  it("ай/күн/сағат/минутқа бөледі", () => {
    const now = new Date("2026-10-18T14:45:00+05:00").getTime();
    expect(countdownParts(now, target)).toEqual({ months: 2, days: 15, hours: 18, minutes: 15, done: false });
  });
  it("бір айдан аз қалғанда", () => {
    const now = new Date("2026-12-30T09:00:00+05:00").getTime();
    expect(countdownParts(now, target)).toEqual({ months: 0, days: 4, hours: 0, minutes: 0, done: false });
  });
  it("уақыт өтіп кетсе — done", () => {
    expect(countdownParts(target + 1000, target).done).toBe(true);
    expect(countdownParts(Date.now(), NaN).done).toBe(true);
  });
});
