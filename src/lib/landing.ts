import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Testimonial } from "@/lib/types";

export const SITE_MEDIA_BUCKET = "site-media";

export function siteMediaUrl(path: string | null) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${SITE_MEDIA_BUCKET}/${path}`;
}

export interface PublicTestimonial extends Omit<Testimonial, "photo_path" | "is_published" | "position"> {
  photoUrl: string | null;
}

/** Лендингтегі жарияланған пікірлер (кесте әлі жоқ болса — бос тізім) */
export async function getPublishedTestimonials(): Promise<PublicTestimonial[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("testimonials")
    .select("id, student_name, score, score_label, text, photo_path, video_url")
    .eq("is_published", true)
    .order("position")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data) return [];
  return data.map(({ photo_path, ...t }) => ({ ...t, photoUrl: siteMediaUrl(photo_path) }));
}
