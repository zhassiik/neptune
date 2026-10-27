import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { PlatformSettings } from "@/lib/types";

export const DEFAULT_SETTINGS: PlatformSettings = {
  platform_name: "Neptune UBT | Жазира Тұрғымбай",
  contact_email: null,
  contact_phone: null,
  contact_address: "Қазақстан",
  teacher_name: "Жазира Тұрғымбай",
  teacher_bio: "Abai university\n14 жылдық тәжірибесі бар математик\nҰБТ эксперті\nNeptune.ubt негізін қалаушы\nҰстаздар мен оқушылар курсының авторы",
  landing_stats: [
    { value: "78+", label: "оқушы 2026 ҰБТ-да 40+ балл жинады" },
    { value: "14", label: "жылдық тәжірибе" },
    { value: "200+", label: "авторлық нұсқа" },
  ],
  exam_countdown_title: "3 қаңтар ҰБТ-ға дейін қалды:",
  exam_date: "2027-01-03T09:00:00+05:00",
  instagram_url: "https://www.instagram.com/zhazira_turgumbay/",
  telegram_url: null,
  whatsapp_phone: null,
  join_url: null,
};

/** select("*") + әдепкі мәндер: жаңа бағандар migration-ға дейін де бет бұзылмайды */
export const getPlatformSettings = cache(async (): Promise<PlatformSettings> => {
  if (!isSupabaseConfigured()) return DEFAULT_SETTINGS;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("platform_settings").select("*").eq("id", 1).maybeSingle();
    if (!data) return DEFAULT_SETTINGS;
    const merged = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    for (const [k, v] of Object.entries(data)) if (v !== null && v !== undefined && k in merged) merged[k] = v;
    // Байланыс өрістері бос болуы мүмкін (әкімші өшірсе)
    for (const k of ["contact_email", "contact_phone", "contact_address", "telegram_url", "whatsapp_phone", "instagram_url", "exam_date", "join_url"] as const) {
      if (k in data) merged[k] = (data as Record<string, unknown>)[k] ?? null;
    }
    return merged as unknown as PlatformSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
});

export { joinCta } from "./join-cta";
