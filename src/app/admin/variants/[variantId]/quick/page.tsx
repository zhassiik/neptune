import type { Metadata } from "next";
import { Eye, Settings2 } from "lucide-react";
import { loadVariantForEditor } from "@/lib/admin/editor-data";
import { QuickEntry } from "@/components/admin/editor/QuickEntry";
import { VariantRowActions } from "@/components/admin/VariantRowActions";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { hasVideo, variantHeading } from "@/lib/video";

export const metadata: Metadata = { title: "Жылдам енгізу" };

export default async function QuickEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ variantId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ variantId }, { created }] = await Promise.all([params, searchParams]);
  const { variant, questions } = await loadVariantForEditor(variantId);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={variant.status === "published" ? "green" : "amber"}>{variant.status === "published" ? "Жарияланған" : "Draft"}</Badge>
            {hasVideo(variant) ? <Badge tone="navy">{variant.video_provider === "cloudflare" ? "Cloudflare видео" : "Видео бар"}</Badge> : <Badge>Видео жоқ</Badge>}
          </div>
          <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{variantHeading(variant)}</h1>
          <p className="mt-1 text-slate-500">Жылдам енгізу: скриндер + жауап кілті</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href={`/admin/variants/${variant.id}`} variant="outline" size="sm">
            <Settings2 className="size-4" /> Баптаулар және толық редактор
          </ButtonLink>
          <VariantRowActions id={variant.id} title={variantHeading(variant)} status={variant.status} compact />
        </div>
      </div>

      {created && (
        <Alert tone="success" className="mb-6">
          Нұсқа құрылды! Енді 40 скринді жүктеп, әр сұраққа дұрыс жауапты белгілеңіз. Барлығы дайын болғанда <b>«Жариялау»</b> батырмасын басыңыз —
          нұсқаны алдымен <Eye className="inline size-4" /> Preview арқылы тексеріп алуға болады.
        </Alert>
      )}

      <QuickEntry variantId={variant.id} questions={questions} />
    </>
  );
}
