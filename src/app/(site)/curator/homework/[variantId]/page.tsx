import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireCuratorPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { VariantHomeworkView } from "@/components/homework/VariantHomeworkView";

export const metadata: Metadata = { title: "Черновик және конспект" };

/** Куратор: бір нұсқаның черновик/конспект белгілері (тек өз курсы — дерекқор тексереді) */
export default async function CuratorVariantHomeworkPage({ params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(variantId)) notFound();
  await requireCuratorPage(`/curator/homework/${variantId}`);
  const supabase = await createClient();
  const { data: variant } = await supabase.from("test_variants").select("course_id").eq("id", variantId).maybeSingle();
  if (!variant) notFound();
  const { data: allowed } = await supabase.rpc("can_curate_course", { p_course_id: variant.course_id });
  if (allowed !== true) redirect("/curator/homework");
  return <VariantHomeworkView variantId={variantId} backHref="/curator/homework" backLabel="Нұсқалар" settingsHint={false} />;
}
