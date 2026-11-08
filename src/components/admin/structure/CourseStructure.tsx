import type { ReactNode } from "react";
import { Orbit, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getStreamConfig } from "@/lib/cloudflare/stream";
import { loadLessonVideoState, type LessonVideoState } from "@/lib/stream-uploads/server";
import { LessonVideoManager } from "@/components/admin/LessonVideoManager";
import { Alert } from "@/components/ui/Alert";
import { defaultPlanet, isPlanetKey } from "@/lib/planets";
import { IntroCreateButton, ModuleCard, ModuleCreateForm, type StructureLesson, type StructureModule } from "./StructureForms";

interface LessonDbRow {
  id: string;
  module_id: string | null;
  kind: "intro" | "video" | "test";
  title: string;
  position: number;
  is_published: boolean;
  variant_id: string | null;
  duration_minutes: number | null;
  video_provider: "url" | "cloudflare";
  video_url: string | null;
  cloudflare_video_uid: string | null;
  video_status: string | null;
}

const EMPTY_STATE: LessonVideoState = { currentUid: null, currentStatus: null, hasOtherVideo: false, latest: null, notMigrated: false };

/**
 * Әкімші: курс құрылымы — кіріспе видео, ғаламшар-блоктар, сабақтар (видео / еркін тест).
 * Видео — компьютерден Cloudflare Stream-ға тікелей жүктеледі (LessonVideoManager, сабақ режимі).
 */
export async function CourseStructure({ courseId, watermark }: { courseId: string; watermark: { name: string; email: string } }) {
  const supabase = await createClient();
  const [{ data: modulesData, error: modErr }, { data: lessonsData, error: lesErr }] = await Promise.all([
    supabase.from("course_modules").select("id, title, planet, position, is_published").eq("course_id", courseId).order("position").order("created_at"),
    supabase
      .from("module_lessons")
      .select("id, module_id, kind, title, position, is_published, variant_id, duration_minutes, video_provider, video_url, cloudflare_video_uid, video_status")
      .eq("course_id", courseId)
      .order("position")
      .order("created_at"),
  ]);

  if (modErr || lesErr) {
    return (
      <section id="structure" className="mt-10 max-w-4xl scroll-mt-6">
        <h2 className="mb-3 text-xl font-extrabold">Курс құрылымы</h2>
        <Alert tone="warning">Деректер базасы жаңартылмаған: Supabase SQL Editor-да 20261111000001_course_modules.sql migration-ын іске қосыңыз.</Alert>
      </section>
    );
  }

  const modules: StructureModule[] = (modulesData ?? []).map((m) => ({ ...m, planet: isPlanetKey(m.planet) ? m.planet : "mercury" }));
  const lessons = (lessonsData ?? []) as LessonDbRow[];

  // Тесттердің күйі және сұрақ саны
  const variantIds = lessons.map((l) => l.variant_id).filter(Boolean) as string[];
  const tests = new Map<string, { status: "draft" | "published"; questions: number }>();
  if (variantIds.length) {
    const { data } = await supabase.from("test_variants").select("id, status, questions(count)").in("id", variantIds);
    for (const v of data ?? []) tests.set(v.id, { status: v.status as "draft" | "published", questions: (v.questions as { count: number }[])?.[0]?.count ?? 0 });
  }

  const cfg = getStreamConfig();
  const configured = !!(cfg.accountId && cfg.apiToken);
  const videoLessons = lessons.filter((l) => l.kind !== "test");
  const states = await Promise.all(videoLessons.map((l) => loadLessonVideoState(l, "lesson").catch(() => EMPTY_STATE)));
  const panels: Record<string, ReactNode> = {};
  videoLessons.forEach((l, i) => {
    panels[l.id] = <LessonVideoManager key={`lvm-${l.id}`} lessonId={l.id} state={states[i]} configured={configured} watermark={watermark} />;
  });

  const toLesson = (l: LessonDbRow): StructureLesson => ({
    id: l.id,
    module_id: l.module_id,
    kind: l.kind,
    title: l.title,
    position: l.position,
    is_published: l.is_published,
    variant_id: l.variant_id,
    duration_minutes: l.duration_minutes,
    hasVideo: (l.video_provider === "cloudflare" && !!l.cloudflare_video_uid) || !!l.video_url,
    test: l.variant_id ? (tests.get(l.variant_id) ?? null) : null,
  });

  const intro = lessons.find((l) => l.kind === "intro");

  return (
    <section id="structure" className="mt-10 max-w-4xl scroll-mt-6">
      <h2 className="flex items-center gap-2 text-xl font-extrabold">
        <Orbit className="size-6 text-brand-500" /> Курс құрылымы
      </h2>
      <p className="mt-1 mb-5 text-sm text-slate-500">
        Кіріспе видео, ғаламшар-блоктар және олардың ішіндегі видео сабақтар мен тесттер. Блоктар курс бетінде осы ретпен көрінеді.
      </p>

      <div className="card mb-6 p-5 sm:p-6">
        <h3 className="flex items-center gap-2 font-bold text-navy-900">
          <Video className="size-5 text-brand-500" /> Курсқа кіріспе видео
        </h3>
        <p className="mt-1 mb-4 text-sm text-slate-500">Курс бетінің жоғарғы жағында тұрады. Оны курсқа әлі жазылмаған келушілер де көре алады.</p>
        {intro ? panels[intro.id] : <IntroCreateButton courseId={courseId} />}
      </div>

      <div className="space-y-5">
        {modules.map((m) => (
          <ModuleCard key={m.id} module={m} lessons={lessons.filter((l) => l.module_id === m.id).map(toLesson)} videoPanels={panels} />
        ))}
      </div>
      <div className="mt-6">
        <ModuleCreateForm courseId={courseId} nextPlanet={defaultPlanet(modules.length + 1)} />
      </div>
    </section>
  );
}
