"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCurator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { humanizeError } from "@/lib/utils";
import type { FormState } from "./actions";

const uuid = z.string().uuid();
const statusSchema = z.enum(["on_time", "late", "missing"]).nullable();

/**
 * Куратор немесе әкімші: оқушының черновик/конспектін белгілеу.
 * on_time — ✓ расталды; null — белгіні алу. Бір нұсқаға бір оқушыда бір жазба (variant_id, student_id).
 * Құқық (осы курстың кураторы ма) дерекқор функциясында тексеріледі: set_homework_check().
 */
export async function setHomeworkStatus(variantId: string, studentId: string, kind: "draft" | "notes", status: string | null): Promise<FormState> {
  await assertCurator();
  const parsed = statusSchema.safeParse(status || null);
  if (!uuid.safeParse(variantId).success || !uuid.safeParse(studentId).success || !parsed.success || (kind !== "draft" && kind !== "notes")) {
    return { error: "Деректер дұрыс емес" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_homework_check", { p_variant: variantId, p_student: studentId, p_kind: kind, p_status: parsed.data });
  if (error) return { error: humanizeError(error) };
  revalidatePath("/courses", "layout");
  return { ok: true };
}
