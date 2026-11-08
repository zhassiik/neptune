import { describe, expect, it } from "vitest";
import { almatyDay, computeStreak, type StreakVariant } from "./streak";

// 2026-11-08 — жексенбі. Алматы уақыты = UTC+5
const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+05:00`).toISOString();
const variant = (id: string, day: string, hhmm = "05:00"): StreakVariant => ({ id, title: `Нұсқа ${id}`, position: Number(id.replace(/\D/g, "")) || 1, courseSlug: "tangy-200", publishedAt: at(day, hhmm) });
const sub = (variantId: string, day: string, hhmm: string) => ({ variantId, submittedAt: at(day, hhmm) });
const base = { now: at("2026-11-08", "10:00"), signupAt: at("2026-10-01", "12:00") };

describe("almatyDay", () => {
  it("UTC 19:30 → Алматыда келесі күн", () => {
    expect(almatyDay("2026-11-07T19:30:00Z")).toBe("2026-11-08");
    expect(almatyDay("2026-11-07T18:59:00Z")).toBe("2026-11-07");
  });
});

describe("computeStreak", () => {
  it("жаңа нұсқа шыққан күндері орындаса — жұлдыз өседі, демалыс күндері сақталады", () => {
    const r = computeStreak({
      ...base,
      variants: [variant("v1", "2026-11-03"), variant("v2", "2026-11-04"), variant("v3", "2026-11-06")],
      submissions: [sub("v1", "2026-11-03", "09:00"), sub("v2", "2026-11-04", "23:59"), sub("v3", "2026-11-06", "07:00")],
    });
    expect(r.count).toBe(3);
    expect(r.week.map((d) => d.state)).toEqual(["rest", "done", "done", "rest", "done", "rest", "rest"]);
    expect(r.today).toMatchObject({ kind: "rest", done: false });
  });

  it("жаңа нұсқаны сол күні 00:00-ге дейін орындамаса — жұлдыз сөнеді", () => {
    const r = computeStreak({
      ...base,
      variants: [variant("v1", "2026-11-03"), variant("v2", "2026-11-04"), variant("v3", "2026-11-06")],
      // v2-ні келесі күні 00:10-да тапсырды — кеш
      submissions: [sub("v1", "2026-11-03", "09:00"), sub("v2", "2026-11-05", "00:10"), sub("v3", "2026-11-06", "08:00")],
    });
    expect(r.count).toBe(1); // тек 6-қарашадағы v3; 4-қараша үзді
    expect(r.week[2].state).toBe("missed");
  });

  it("демалыс күні басқа нұсқа тапсырса — күн жанады, бірақ серия өспейді", () => {
    const r = computeStreak({
      ...base,
      variants: [variant("v1", "2026-11-02")],
      submissions: [sub("v1", "2026-11-02", "06:00"), sub("v1", "2026-11-05", "12:00")],
    });
    expect(r.count).toBe(1);
    expect(r.week[3].state).toBe("done"); // бейсенбі — демалыс, бірақ нұсқа орындады
  });

  it("бүгінгі жаңа нұсқа әлі орындалмаса — күтуде, серия үзілмейді; орындаса — +1", () => {
    const now = at("2026-11-07", "10:00"); // сенбі
    const vars = [variant("v1", "2026-11-06"), variant("v2", "2026-11-07", "05:00")];
    const pending = computeStreak({ ...base, now, variants: vars, submissions: [sub("v1", "2026-11-06", "06:00")] });
    expect(pending.count).toBe(1);
    expect(pending.today).toMatchObject({ kind: "task", done: false });
    expect(pending.week[5].state).toBe("pending");
    expect(pending.today.variants.map((v) => v.id)).toEqual(["v2"]);

    const done = computeStreak({ ...base, now, variants: vars, submissions: [sub("v1", "2026-11-06", "06:00"), sub("v2", "2026-11-07", "09:30")] });
    expect(done.count).toBe(2);
    expect(done.today.done).toBe(true);
  });

  it("бейсенбі мен жексенбі — тұрақты демалыс: сол күні нұсқа шықса да міндетті емес, жұлдыз сақталады", () => {
    const r = computeStreak({
      ...base,
      // бейсенбі (5-қараша) мен жексенбі (8-қараша) шыққан нұсқалар орындалмады
      variants: [variant("v1", "2026-11-04"), variant("v2", "2026-11-05"), variant("v3", "2026-11-06"), variant("v4", "2026-11-08")],
      submissions: [sub("v1", "2026-11-04", "08:00"), sub("v3", "2026-11-06", "08:00")],
    });
    expect(r.count).toBe(2); // ср + жм, бейсенбі үзбеді
    expect(r.week[3].state).toBe("rest");
    expect(r.week[6].state).toBe("rest");
    expect(r.today).toMatchObject({ kind: "rest", variants: [] });
  });

  it("демалыс күні нұсқа орындаса — жұлдыз өспейді", () => {
    const r = computeStreak({
      ...base,
      variants: [variant("v1", "2026-11-05")],
      submissions: [sub("v1", "2026-11-05", "08:00")],
    });
    expect(r.count).toBe(0);
    expect(r.week[3].state).toBe("done");
  });

  it("жұмыс күні нұсқа әлі шықпаса — «күтуде», серия сақталады", () => {
    const r = computeStreak({
      ...base,
      now: at("2026-11-09", "03:00"), // дүйсенбі, таңғы 5-ке дейін
      variants: [variant("v1", "2026-11-07")],
      submissions: [sub("v1", "2026-11-07", "08:00")],
    });
    expect(r.count).toBe(1);
    expect(r.today).toMatchObject({ kind: "waiting", done: false });
  });

  it("бір күні бірнеше жаңа нұсқа — біреуін орындау жеткілікті", () => {
    const r = computeStreak({
      ...base,
      variants: [variant("v1", "2026-11-06"), variant("v2", "2026-11-06")],
      submissions: [sub("v2", "2026-11-06", "20:00")],
    });
    expect(r.count).toBe(1);
  });

  it("тіркелгенге дейінгі тапсырма күндері серияны үзбейді", () => {
    const r = computeStreak({
      now: at("2026-11-08", "10:00"),
      signupAt: at("2026-11-05", "12:00"),
      variants: [variant("v0", "2026-11-03"), variant("v1", "2026-11-06")],
      submissions: [sub("v1", "2026-11-06", "06:00")],
    });
    expect(r.count).toBe(1);
    expect(r.week[1].state).toBe("rest"); // 3-қараша — тіркелгенге дейін
  });
});
