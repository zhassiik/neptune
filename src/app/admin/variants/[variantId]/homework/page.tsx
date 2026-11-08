import type { Metadata } from "next";
import { VariantHomeworkView } from "@/components/homework/VariantHomeworkView";

export const metadata: Metadata = { title: "Черновик және конспект" };

/** Әкімші: нұсқа бойынша черновик/конспект белгілері (рұқсат — admin layout) */
export default async function VariantHomeworkPage({ params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params;
  return <VariantHomeworkView variantId={variantId} backHref={`/admin/variants/${variantId}`} backLabel="Нұсқа редакторы" settingsHint />;
}
