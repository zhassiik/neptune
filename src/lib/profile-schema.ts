import { z } from "zod";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";

/** Міндетті телефон өрісі: енгізілген мәтінді «+77001234567» түріне келтіреді */
export const phoneField = (emptyMessage: string) =>
  z
    .string()
    .trim()
    .min(1, emptyMessage)
    .transform((value, ctx) => {
      const phone = normalizePhone(value);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: PHONE_ERROR });
        return z.NEVER;
      }
      return phone;
    });

export const fullNameField = z.string().trim().min(2, "Аты-жөніңізді толық жазыңыз").max(120, "Тым ұзын");

export const contactFields = {
  phone: phoneField("Телефон нөміріңізді енгізіңіз"),
  parent_phone: phoneField("Ата-анаңыздың телефон нөмірін енгізіңіз"),
};

/** Ата-ананың нөмірі оқушының өз нөмірінен басқа болуы керек */
export function differentPhones(d: { phone: string; parent_phone: string }) {
  return d.phone !== d.parent_phone;
}
export const DIFFERENT_PHONES_ERROR = { message: "Ата-анаңыздың нөмірі өз нөміріңізден басқа болуы керек", path: ["parent_phone"] };
