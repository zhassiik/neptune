import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { loadCourseOptions, loadVariantForEditor } from "@/lib/admin/editor-data";
import { VariantEditor } from "@/components/admin/editor/VariantEditor";
import { CloudflareVideoPanel } from "@/components/admin/CloudflareVideoPanel";
import { desiredAllowedOrigins, getStreamConfig } from "@/lib/cloudflare/stream";

export const metadata: Metadata = { title: "Нұсқа редакторы" };

export default async function VariantEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ variantId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ variantId }, { created }] = await Promise.all([params, searchParams]);
  const [{ variant, questions }, { courses }, admin] = await Promise.all([loadVariantForEditor(variantId), loadCourseOptions(), requireAdmin()]);

  let videoPanel: React.ReactNode = null;
  if (variant.video_provider === "cloudflare" && variant.cloudflare_video_uid) {
    // Тек құпия емес ақпарат клиентке беріледі: жетіспейтін айнымалылардың аттары және домендер
    const cfg = getStreamConfig();
    // key: серверден prop арқылы берілген элементке React 19 key талап етеді (әйтпесе «unique key» ескертуі)
    videoPanel = (
      <CloudflareVideoPanel
        key={`cf-${variant.id}`}
        variantId={variant.id}
        uid={variant.cloudflare_video_uid}
        status={variant.video_status}
        setup={{ missing: cfg.missing, apiConfigured: !!(cfg.accountId && cfg.apiToken), desiredOrigins: desiredAllowedOrigins() }}
        watermark={{ name: admin.profile?.full_name || "Әкімші", email: admin.email ?? "" }}
      />
    );
  }

  return (
    <Suspense>
      <VariantEditor variant={variant} questions={questions} courses={courses} justCreated={created === "1"} videoPanel={videoPanel} />
    </Suspense>
  );
}
