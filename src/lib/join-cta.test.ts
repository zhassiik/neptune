import { describe, expect, it } from "vitest";
import { joinCta } from "./join-cta";

describe("joinCta", () => {
  it("Баптаулардағы сілтеме бірінші", () => {
    expect(joinCta({ join_url: "https://wa.me/77471401404", whatsapp_phone: "+7 700 111 22 33" }, "/courses")).toEqual({
      href: "https://wa.me/77471401404",
      external: true,
    });
  });

  it("сілтеме жоқ болса — WhatsApp нөміріне дайын хабарламамен", () => {
    const r = joinCta({ join_url: null, whatsapp_phone: "+7 (747) 140-14-04" }, "/courses");
    expect(r.external).toBe(true);
    expect(r.href.startsWith("https://wa.me/77471401404?text=")).toBe(true);
    expect(decodeURIComponent(r.href.split("text=")[1])).toBe("Сәлеметсіз бе! Курсқа қосылғым келеді");
  });

  it("екеуі де жоқ — курс беті", () => {
    expect(joinCta({ join_url: null, whatsapp_phone: null }, "/courses/tangy-200")).toEqual({ href: "/courses/tangy-200", external: false });
  });
});
