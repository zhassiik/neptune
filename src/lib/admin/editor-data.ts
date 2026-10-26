import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IMAGE_BUCKET } from "@/lib/attempts/questions";
import { questionIssue, type StoredQuestion } from "./question-schema";
import type { EditorQuestion } from "@/components/admin/editor/types";
import type { TestVariant } from "@/lib/types";

/** Әкімші редакторы үшін нұсқа және сұрақтар (RLS: тек admin) */
export async function loadVariantForEditor(variantId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(variantId)) notFound();
  const supabase = await createClient();

  const [{ data: variant }, { data: rows, error }] = await Promise.all([
    supabase.from("test_variants").select("*").eq("id", variantId).maybeSingle<TestVariant>(),
    supabase
      .from("questions")
      .select(
        "id, position, type, prompt, image_path, explanation, updated_at, answer_options(id, position, text, is_correct), matching_items(id, label, text, correct_option_id), matching_options(id, position, text)",
      )
      .eq("variant_id", variantId)
      .order("position"),
  ]);
  if (!variant) notFound();
  if (error) throw new Error("Сұрақтарды жүктеу мүмкін болмады");

  const paths = (rows ?? []).map((r) => r.image_path).filter(Boolean) as string[];
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(paths, 60 * 60 * 2);
    for (const s of data ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
  }

  const questions: EditorQuestion[] = (rows ?? []).map((r) => {
    const options = [...r.answer_options].sort((a, b) => a.position - b.position);
    const mOptions = [...r.matching_options].sort((a, b) => a.position - b.position);
    return {
      id: r.id,
      position: r.position,
      type: r.type,
      prompt: r.prompt,
      imagePath: r.image_path,
      imageUrl: r.image_path ? (urls[r.image_path] ?? null) : null,
      explanation: r.explanation,
      updatedAt: r.updated_at,
      options: options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.is_correct })),
      matchingOptions: mOptions.map((o) => ({ id: o.id, text: o.text })),
      matchingItems: r.matching_items.map((i: { label: "A" | "B"; text: string; correct_option_id: string | null }) => ({
        label: i.label,
        text: i.text,
        correctOptionId: i.correct_option_id,
      })),
      issue: questionIssue(r as unknown as StoredQuestion),
    };
  });

  return { variant, questions, imageUrls: urls, rows: rows ?? [] };
}

/** Нұсқа формасы үшін курстар тізімі және әр курстағы келесі нөмір */
export async function loadCourseOptions() {
  const supabase = await createClient();
  const [{ data: courses }, { data: variants }] = await Promise.all([
    supabase.from("courses").select("id, title, status").order("position"),
    supabase.from("test_variants").select("course_id, position"),
  ]);
  const nextPositions: Record<string, number> = {};
  for (const c of courses ?? []) nextPositions[c.id] = 1;
  for (const v of variants ?? []) nextPositions[v.course_id] = Math.max(nextPositions[v.course_id] ?? 1, v.position + 1);
  return {
    courses: (courses ?? []).map((c) => ({ id: c.id as string, title: c.title as string, status: c.status as string })),
    nextPositions,
  };
}
