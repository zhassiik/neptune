"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CircleAlert, ListPlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { VariantRowActions } from "@/components/admin/VariantRowActions";
import { cn } from "@/lib/utils";
import { maxPointsForType, type QuestionType } from "@/lib/scoring";
import type { TestVariant } from "@/lib/types";
import { QuestionEditor } from "./QuestionEditor";
import type { EditorQuestion } from "./types";

const TYPE_LABELS: Record<QuestionType, string> = {
  single: "Бір жауапты",
  matching: "Сәйкестендіру",
  multiple: "Көп жауапты",
};

/**
 * Блоктағы еркін тесттің редакторы: сұрақ саны еркін (1–200), әр сұрақтың түрін мұғалім таңдайды.
 * Сұрақтың өзі бұрынғы QuestionEditor-мен өңделеді.
 */
export function PracticeEditor({
  variant,
  questions,
  backHref,
  lessonTitle,
}: {
  variant: TestVariant;
  questions: EditorQuestion[];
  backHref: string;
  lessonTitle: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const byPos = new Map(questions.map((q) => [q.position, q]));
  const positions = questions.map((q) => q.position).sort((a, b) => a - b);
  const nextPos = (positions.at(-1) ?? 0) + 1;

  const qParam = Number(params.get("q"));
  const [newType, setNewType] = useState<QuestionType | null>(null);
  const selected = Number.isInteger(qParam) && qParam >= 1 && qParam <= 200 ? qParam : (positions[0] ?? (newType ? nextPos : null));
  const [dirty, setDirty] = useState(false);
  const onDirtyChange = useCallback((d: boolean) => setDirty(d), []);

  const select = (p: number) => {
    if (dirty && !window.confirm("Сақталмаған өзгерістер бар. Шығасыз ба?")) return;
    setDirty(false);
    router.replace(`/admin/variants/${variant.id}?q=${p}`, { scroll: false });
  };
  const addQuestion = (type: QuestionType) => {
    if (dirty && !window.confirm("Сақталмаған өзгерістер бар. Шығасыз ба?")) return;
    setDirty(false);
    setNewType(type);
    router.replace(`/admin/variants/${variant.id}?q=${nextPos}`, { scroll: false });
  };

  const current = selected ? byPos.get(selected) : undefined;
  const editingType = current ? current.type : newType;
  const maxScore = questions.reduce((s, q) => s + maxPointsForType(q.type), 0);
  const issues = questions.filter((q) => q.issue).length;

  return (
    <>
      <ButtonLink href={backHref} variant="ghost" size="sm" className="-ml-3 mb-2">
        <ArrowLeft className="size-4" /> Курс құрылымы
      </ButtonLink>
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={variant.status === "published" ? "green" : "amber"}>{variant.status === "published" ? "Жарияланған" : "Draft"}</Badge>
            <Badge tone="blue">Еркін тест</Badge>
            <Badge>
              {questions.length} сұрақ · {maxScore} балл
            </Badge>
          </div>
          <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{lessonTitle}</h1>
        </div>
        <VariantRowActions id={variant.id} title={lessonTitle} status={variant.status} compact practice afterDeleteHref={backHref} />
      </div>

      {issues > 0 && (
        <Alert tone="warning" className="mb-5">
          {issues} сұрақ толық емес. Жариялау үшін барлық сұрақ толық болуы керек.
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="card p-5">
            <div className="mb-3 text-sm font-semibold text-navy-900">Сұрақтар</div>
            {positions.length === 0 ? (
              <p className="mb-3 text-sm text-slate-500">Әзірге сұрақ жоқ. Төменнен түрін таңдап, бірінші сұрақты қосыңыз.</p>
            ) : (
              <div className="mb-4 grid grid-cols-6 gap-1.5">
                {positions.map((p) => {
                  const q = byPos.get(p)!;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => select(p)}
                      title={`${p}-сұрақ · ${TYPE_LABELS[q.type]}${q.issue ? ` · ${q.issue}` : ""}`}
                      className={cn(
                        "relative grid aspect-square place-items-center rounded-lg text-sm font-semibold transition",
                        p === selected ? "bg-brand-500 text-white ring-2 ring-brand-200" : q.issue ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                      )}
                    >
                      {p}
                      {q.issue && <CircleAlert className="absolute -top-1 -right-1 size-3.5 text-amber-500" />}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="text-xs font-semibold text-slate-500 uppercase">Сұрақ қосу</div>
            <div className="mt-2 grid gap-2">
              {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addQuestion(t)}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/50"
                >
                  <span className="flex items-center gap-2">
                    <ListPlus className="size-4 text-brand-500" /> {TYPE_LABELS[t]}
                  </span>
                  <span className="text-xs text-slate-400">{maxPointsForType(t)} балл</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          {selected && editingType ? (
            <QuestionEditor
              key={`${selected}-${editingType}`}
              variantId={variant.id}
              position={selected}
              question={current}
              occupiedPositions={new Set(positions)}
              onDirtyChange={onDirtyChange}
              practiceType={editingType}
              positions={positions}
            />
          ) : (
            <div className="card grid place-items-center p-10 text-center text-slate-500">Сол жақтан сұрақты таңдаңыз немесе жаңасын қосыңыз.</div>
          )}
        </main>
      </div>
    </>
  );
}
