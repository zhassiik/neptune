import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { PlatformSettings } from "@/lib/types";

export const DEFAULT_SETTINGS: PlatformSettings = {
  platform_name: "Neptune UBT | Жазира Тұрғымбай",
  contact_email: "info@ubt-nusqa.kz",
  contact_phone: "+7 (700) 000-00-00",
  contact_address: "Қазақстан",
};

export const getPlatformSettings = cache(async (): Promise<PlatformSettings> => {
  if (!isSupabaseConfigured()) return DEFAULT_SETTINGS;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("platform_name, contact_email, contact_phone, contact_address")
      .eq("id", 1)
      .maybeSingle<PlatformSettings>();
    return data ?? DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
});
