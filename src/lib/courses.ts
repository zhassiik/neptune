import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Course } from "@/lib/types";

export const COVER_BUCKET = "course-covers";

/** '/covers/...' — сайттың статикалық файлы; басқасы — Storage-тағы файл */
export function isStaticCover(path: string | null | undefined): path is string {
  return !!path && path.startsWith("/");
}

export function coverUrl(path: string | null) {
  if (!path) return null;
  if (isStaticCover(path)) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${COVER_BUCKET}/${path}`;
}

/** Оқушыларға көрінетін курстар (draft-тан басқасы; admin барлығын көреді) */
export const getVisibleCourses = cache(async (): Promise<Course[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").select("*").neq("status", "draft").order("position");
  if (error) throw new Error("Курстарды жүктеу мүмкін болмады");
  return (data ?? []) as Course[];
});

export const getCourseBySlug = cache(async (slug: string): Promise<Course | null> => {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("*").eq("slug", slug).maybeSingle<Course>();
  return data ?? null;
});

export function formatPrice(price: number | null) {
  if (price == null) return null;
  if (price === 0) return "Тегін";
  return `${new Intl.NumberFormat("ru-RU").format(price).replace(/,/g, " ")} ₸`;
}
