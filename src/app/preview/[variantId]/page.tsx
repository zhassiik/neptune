import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { loadVariantForEditor } from "@/lib/admin/editor-data";
import { TestRunner } from "@/components/test/TestRunner";
import type { PublicQuestion } from "@/lib/types";
import { variantHeading } from "@/lib/video";

export const metadata: Metadata = { title: "Preview" };
export const dynamic = "force-dynamic";

/** Оқушы интерфейсінің алдын ала көрінісі (дұрыс жауаптар клиентке берілмейді) */
export default async function PreviewPage({ params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params;
  await requireAdmin();
  const { variant, questions } = await loadVariantForEditor(variantId);

  const publicQuestions: PublicQuestion[] = questions.map((q) => ({
    id: q.id,
    position: q.position,
    type: q.type,
    prompt: q.prompt,
    imageUrl: q.imageUrl,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
    matchingItems: q.matchingItems.map((i, idx) => ({ id: `${q.id}-${i.label}-${idx}`, label: i.label, text: i.text })),
    matchingOptions: q.matchingOptions,
  }));

  return (
    <TestRunner
        mode="preview"
        attemptId={`preview-${variant.id}`}
        title={`${variantHeading(variant)} · Preview (${questions.length}/40)`}
        questions={publicQuestions}
        initialAnswers={{}}
        deadline={null}
        serverNow={new Date().toISOString()}
        exitHref={`/admin/variants/${variant.id}`}
    />
  );
}
