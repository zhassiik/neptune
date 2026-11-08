import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { loadCourseOptions, loadVariantForEditor } from "@/lib/admin/editor-data";
import { VariantEditor } from "@/components/admin/editor/VariantEditor";
import { CloudflareVideoPanel } from "@/components/admin/CloudflareVideoPanel";
import { LessonVideoManager } from "@/components/admin/LessonVideoManager";
import { PracticeEditor } from "@/components/admin/editor/PracticeEditor";
import { createClient } from "@/lib/supabase/server";
import { desiredAllowedOrigins, getStreamConfig } from "@/lib/cloudflare/stream";
import { loadLessonVideoState, type LessonVideoState } from "@/lib/stream-uploads/server";

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

  // Блоктағы еркін тест — өз редакторы (сұрақ саны еркін)
  if (variant.kind === "practice") {
    const { data: lesson } = await (await createClient()).from("module_lessons").select("title, course_id").eq("variant_id", variant.id).maybeSingle();
    return (
      <Suspense>
        <PracticeEditor
          variant={variant}
          questions={questions}
          backHref={`/admin/courses/${lesson?.course_id ?? variant.course_id}#structure`}
          lessonTitle={lesson?.title ?? variant.title}
        />
      </Suspense>
    );
  }

  const cfg = getStreamConfig();
  const watermark = { name: admin.profile?.full_name || "Әкімші", email: admin.email ?? "" };
  const videoState: LessonVideoState = await loadLessonVideoState(variant).catch((e) => {
    console.error("[variant-editor] video state:", e instanceof Error ? e.message : e);
    return { currentUid: null, currentStatus: null, hasOtherVideo: false, latest: null, notMigrated: false };
  });

  let videoPanel: React.ReactNode = null;
  if (variant.video_provider === "cloudflare" && variant.cloudflare_video_uid) {
    // Тек құпия емес ақпарат клиентке беріледі: жетіспейтін айнымалылардың аттары және домендер
    // key: серверден prop арқылы берілген элементке React 19 key талап етеді (әйтпесе «unique key» ескертуі)
    videoPanel = (
      <CloudflareVideoPanel
        key={`cf-${variant.id}`}
        variantId={variant.id}
        uid={variant.cloudflare_video_uid}
        status={variant.video_status}
        setup={{ missing: cfg.missing, apiConfigured: !!(cfg.accountId && cfg.apiToken), desiredOrigins: desiredAllowedOrigins() }}
        watermark={watermark}
      />
    );
  }
  // Видео жүктеу бөлімі (Cloudflare Stream-ға тікелей) + бұрынғы қорғау панелі
  const videoSection = (
    <div key={`video-${variant.id}`}>
      <LessonVideoManager variantId={variant.id} state={videoState} configured={!!(cfg.accountId && cfg.apiToken)} watermark={watermark} />
      {videoPanel}
    </div>
  );

  return (
    <Suspense>
      <VariantEditor variant={variant} questions={questions} courses={courses} justCreated={created === "1"} videoPanel={videoSection} />
    </Suspense>
  );
}
