"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { ChevronDown, Settings2, Zap } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { SECTIONS } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { VariantForm, type CourseOption } from "@/components/admin/VariantForm";
import { VariantRowActions } from "@/components/admin/VariantRowActions";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { updateVariant } from "@/lib/admin/actions";
import type { TestVariant } from "@/lib/types";
import { hasVideo, variantHeading } from "@/lib/video";
import { QuestionEditor } from "./QuestionEditor";
import type { EditorQuestion } from "./types";

const SECTION_TITLES = {
  single: "Бір жауапты",
  matching: "Сәйкестендіру",
  multiple: "Бірнеше жауапты",
};

export function VariantEditor({
  variant,
  questions,
  courses,
  justCreated,
  videoPanel,
}: {
  variant: TestVariant;
  questions: EditorQuestion[];
  courses: CourseOption[];
  justCreated: boolean;
  /** Cloudflare видео панелі (серверде құрастырылады) */
  videoPanel?: React.ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const byPos = new Map(questions.map((q) => [q.position, q]));
  const qParam = Number(params.get("q"));
  const selected = Number.isInteger(qParam) && qParam >= 1 && qParam <= 40 ? qParam : firstIncomplete(byPos);

  const [settingsOpen, setSettingsOpen] = useState(justCreated);
  const [dirty, setDirty] = useState(false);
  const [pendingPos, setPendingPos] = useState<number | null>(null);

  const completeCount = questions.filter((q) => !q.issue).length;
  const updateAction = updateVariant.bind(null, variant.id);
  const onDirtyChange = useCallback((d: boolean) => setDirty(d), []);

  const select = (p: number) => {
    if (p === selected) return;
    if (dirty) setPendingPos(p);
    else go(p);
  };
  const go = (p: number) => {
    setDirty(false);
    setPendingPos(null);
    router.replace(`/admin/variants/${variant.id}?q=${p}`, { scroll: false });
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={variant.status === "published" ? "green" : "amber"}>{variant.status === "published" ? "Жарияланған" : "Draft"}</Badge>
            {hasVideo(variant) ? <Badge tone="navy">{variant.video_provider === "cloudflare" ? "Cloudflare видео" : "Видео бар"}</Badge> : <Badge>Видео жоқ</Badge>}
            <Badge tone={completeCount === 40 ? "green" : "gray"}>Дайын: {completeCount}/40</Badge>
          </div>
          <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{variantHeading(variant)}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href={`/admin/variants/${variant.id}/quick`} size="sm" variant="secondary">
            <Zap className="size-4" /> Жылдам енгізу
          </ButtonLink>
          <VariantRowActions id={variant.id} title={variantHeading(variant)} status={variant.status} compact />
        </div>
      </div>

      {justCreated && (
        <Alert tone="success" className="mb-5">
          Нұсқа құрылды! Енді төмендегі 1–40 ұяшықтарын басып, сұрақтарды қосыңыз. Барлық 40 сұрақ дайын болғанда нұсқаны жариялай аласыз.
        </Alert>
      )}
      {variant.status === "published" && (
        <Alert tone="warning" className="mb-5">
          Бұл нұсқа жарияланған. Өзгерістер оқушыларға бірден көрінеді — тест тапсырып жатқан оқушылар болуы мүмкін.
        </Alert>
      )}

      {/* Нұсқа баптаулары */}
      <div className="card mb-6 overflow-hidden">
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50 sm:px-7"
          aria-expanded={settingsOpen}
        >
          <span className="flex items-center gap-2 font-semibold text-navy-900">
            <Settings2 className="size-5 text-brand-500" /> Нұсқа баптаулары
          </span>
          <ChevronDown className={cn("size-5 text-slate-400 transition", settingsOpen && "rotate-180")} />
        </button>
        {settingsOpen && (
          <div className="border-t border-slate-100 px-5 py-6 sm:px-7">
            <VariantForm action={updateAction} initial={variant} submitLabel="Баптауларды сақтау" courses={courses} />
          </div>
        )}
      </div>

      {videoPanel}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* 40 ұяшық */}
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="card p-5">
            {SECTIONS.map((s) => (
              <div key={s.type} className="mb-5 last:mb-0">
                <div className="mb-2 flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-navy-900">
                    {s.from}–{s.to}: {SECTION_TITLES[s.type]}
                  </span>
                  <span className="text-xs text-slate-400">{s.pointsEach} балл</span>
                </div>
                <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 xl:grid-cols-6">
                  {Array.from({ length: s.to - s.from + 1 }, (_, i) => s.from + i).map((p) => {
                    const q = byPos.get(p);
                    const state = !q ? "empty" : q.issue ? "issue" : "done";
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => select(p)}
                        title={!q ? "Сұрақ қосылмаған" : q.issue ? `Толық емес: ${q.issue}` : "Дайын"}
                        aria-current={p === selected ? "step" : undefined}
                        className={cn(
                          "grid aspect-square place-items-center rounded-lg text-sm font-semibold transition active:scale-90",
                          state === "done" && "bg-brand-500 text-white hover:bg-brand-600",
                          state === "issue" && "bg-amber-100 text-amber-800 hover:bg-amber-200",
                          state === "empty" && "bg-slate-100 text-slate-500 hover:bg-slate-200",
                          p === selected && "ring-[2.5px] ring-navy-800 ring-offset-2",
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded bg-brand-500" /> Дайын
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded bg-amber-200" /> Толық емес
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded bg-slate-200" /> Бос
              </li>
            </ul>
          </div>
        </aside>

        <QuestionEditor
          key={`${selected}:${byPos.get(selected)?.updatedAt ?? "new"}`}
          variantId={variant.id}
          position={selected}
          question={byPos.get(selected)}
          occupiedPositions={new Set(byPos.keys())}
          onDirtyChange={onDirtyChange}
        />
      </div>

      <ConfirmDialog
        open={pendingPos !== null}
        onClose={() => setPendingPos(null)}
        onConfirm={() => pendingPos && go(pendingPos)}
        title="Сақталмаған өзгерістер бар"
        confirmLabel="Сақтамай өту"
        danger
      >
        {selected}-сұрақтағы өзгерістер сақталмаған. Басқа сұраққа өтсеңіз, олар жоғалады.
      </ConfirmDialog>
    </>
  );
}

function firstIncomplete(byPos: Map<number, EditorQuestion>) {
  for (let p = 1; p <= 40; p++) {
    const q = byPos.get(p);
    if (!q || q.issue) return p;
  }
  return 1;
}
