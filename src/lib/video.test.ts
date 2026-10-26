import { describe, expect, it } from "vitest";
import { formatMinutes, parseVideoUrl, variantHeading } from "./video";

describe("parseVideoUrl", () => {
  it("YouTube сілтемелерінің барлық түрі", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://youtube.com/shorts/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ]) {
      expect(parseVideoUrl(url)).toEqual({
        kind: "iframe",
        provider: "youtube",
        src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1",
      });
    }
  });

  it("Vimeo (жеке hash-пен бірге)", () => {
    expect(parseVideoUrl("https://vimeo.com/123456789")?.kind).toBe("iframe");
    expect(parseVideoUrl("https://vimeo.com/123456789/abcdef12")).toMatchObject({ src: "https://player.vimeo.com/video/123456789?h=abcdef12" });
  });

  it("Kinescope және тікелей mp4", () => {
    expect(parseVideoUrl("https://kinescope.io/abc123XYZ")).toMatchObject({ provider: "kinescope", src: "https://kinescope.io/embed/abc123XYZ" });
    expect(parseVideoUrl("https://cdn.example.kz/talday-1.mp4")).toEqual({ kind: "file", src: "https://cdn.example.kz/talday-1.mp4" });
  });

  it("қолдау көрсетілмейтін немесе қауіпті сілтемелер", () => {
    expect(parseVideoUrl("javascript:alert(1)")).toBeNull();
    expect(parseVideoUrl("https://example.com/page")).toBeNull();
    expect(parseVideoUrl("не сілтеме")).toBeNull();
    expect(parseVideoUrl("")).toBeNull();
  });
});

describe("formatMinutes / variantHeading", () => {
  it("уақытты қазақша форматтайды", () => {
    expect(formatMinutes(101)).toBe("1 сағ 41 мин");
    expect(formatMinutes(45)).toBe("45 мин");
    expect(formatMinutes(120)).toBe("2 сағ");
    expect(formatMinutes(null)).toBeNull();
  });
  it("бөлім атауы", () => {
    expect(variantHeading({ position: 1, title: "Контекст Қарағай ағашы" })).toBe("НҰСҚА 1. Контекст Қарағай ағашы");
  });
});
