import { describe, expect, it } from "vitest";
import { almatyDate, almatyTime, almatyWindow, contestPhase, formatPoints, homeworkPoints } from "./weekly";

describe("homeworkPoints", () => {
  it("черновик 5, конспект 10; кешіксе — жартысы; салмаса 0", () => {
    expect(homeworkPoints("on_time", "draft")).toBe(5);
    expect(homeworkPoints("late", "draft")).toBe(2.5);
    expect(homeworkPoints("on_time", "notes")).toBe(10);
    expect(homeworkPoints("late", "notes")).toBe(5);
    expect(homeworkPoints("missing", "notes")).toBe(0);
    expect(homeworkPoints(null, "draft")).toBe(0);
  });
  it("ұпайды қазақша форматтайды", () => {
    expect(formatPoints(2.5)).toBe("2,5");
    expect(formatPoints(17.5)).toBe("17,5");
    expect(formatPoints(10)).toBe("10");
  });
});

describe("уақыт аралығы", () => {
  it("Алматы уақытымен 05:00–06:30", () => {
    const w = almatyWindow("2026-11-03", "05:00", "06:30");
    expect(w).toEqual({ startsAt: "2026-11-03T00:00:00.000Z", endsAt: "2026-11-03T01:30:00.000Z" });
    expect(almatyTime(w!.startsAt)).toBe("05:00");
    expect(almatyDate(w!.startsAt)).toBe("2026-11-03");
  });
  it("түн ортасынан асатын аралық келесі күнге ауысады", () => {
    const w = almatyWindow("2026-11-03", "23:00", "00:30");
    expect(new Date(w!.endsAt).getTime() - new Date(w!.startsAt).getTime()).toBe(90 * 60_000);
  });
  it("қате мән — null", () => {
    expect(almatyWindow("", "05:00", "06:30")).toBeNull();
    expect(almatyWindow("2026-11-03", "5", "06:30")).toBeNull();
  });
  it("кезеңдер", () => {
    const s = "2026-11-03T00:00:00Z";
    const e = "2026-11-03T01:30:00Z";
    expect(contestPhase(s, e, Date.parse("2026-11-02T23:00:00Z"))).toBe("upcoming");
    expect(contestPhase(s, e, Date.parse("2026-11-03T01:00:00Z"))).toBe("live");
    expect(contestPhase(s, e, Date.parse("2026-11-03T02:00:00Z"))).toBe("ended");
    expect(contestPhase(null, null)).toBe("none");
  });
});
