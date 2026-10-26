"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeftRight, Save, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { deleteQuestion, moveQuestion, saveQuestion } from "@/lib/admin/actions";
import {
  OPTION_LIMITS,
  validateQuestion,
  type QuestionDraft,
  type QuestionErrors,
} from "@/lib/admin/question-schema";
import { questionTypeForPosition, SECTIONS } from "@/lib/scoring";
import { ImageUploader, type ImageValue } from "./ImageUploader";
import { OptionsEditor, newOption } from "./OptionsEditor";
import { MatchingEditor } from "./MatchingEditor";
import type { EditorQuestion } from "./types";

const TYPE_TITLES = {
  single: "Бір дұрыс жауабы бар сұрақ (single choice)",
  matching: "Сәйкестендіру тапсырмасы (matching)",
  multiple: "Бірнеше дұрыс жауабы бар сұрақ (multiple choice)",
};

const TYPE_HINTS = {
  single: "4 немесе 5 жауап нұсқасы. Дұрыс жауапты дөңгелекті басып белгілеңіз. Дұрыс жауап — 1 балл.",
  matching: "A және B элементтері үшін ортақ тізімнен дұрыс сәйкестікті бөлек белгілеңіз. Екеуі дұрыс — 2 балл, біреуі — 1 балл.",
  multiple: "5 немесе 6 жауап нұсқасы, оның 1–3-і дұрыс. Оқушы ең көбі 3 жауап таңдай алады. Максимум — 2 балл.",
};

function buildDraft(variantId: string, position: number, q: EditorQuestion | undefined): QuestionDraft {
  const type = questionTypeForPosition(position);
  if (q) {
    const keyById = new Map(q.matchingOptions.map((o) => [o.id, o.id]));
    return {
      variantId,
      position,
      prompt: q.prompt ?? "",
      imagePath: q.imagePath,
      explanation: q.explanation ?? "",
      options: q.options.map((o) => ({ id: o.id, key: o.id, text: o.text, isCorrect: o.isCorrect })),
      matchingOptions: q.matchingOptions.map((o) => ({ id: o.id, key: o.id, text: o.text, isCorrect: false })),
      matchingItems: (["A", "B"] as const).map((label) => {
        const item = q.matchingItems.find((i) => i.label === label);
        return { label, text: item?.text ?? "", correctKey: item?.correctOptionId ? (keyById.get(item.correctOptionId) ?? null) : null };
      }),
    };
  }
  const optionCount = type === "single" ? 4 : type === "multiple" ? 6 : 0;
  return {
    variantId,
    position,
    prompt: "",
    imagePath: null,
    explanation: "",
    options: Array.from({ length: optionCount }, () => newOption()),
    matchingOptions: type === "matching" ? Array.from({ length: 4 }, () => newOption()) : [],
    matchingItems:
      type === "matching"
        ? [
            { label: "A", text: "", correctKey: null },
            { label: "B", text: "", correctKey: null },
          ]
        : [],
  };
}

export { buildDraft };

export function QuestionEditor({
  variantId,
  position,
  question,
  occupiedPositions,
  onDirtyChange,
}: {
  variantId: string;
  position: number;
  question: EditorQuestion | undefined;
  occupiedPositions: Set<number>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const type = questionTypeForPosition(position);
  const initial = useMemo(() => buildDraft(variantId, position, question), [variantId, position, question]);

  const [draft, setDraft] = useState<QuestionDraft>(initial);
  const [image, setImage] = useState<ImageValue>({ path: question?.imagePath ?? null, url: question?.imageUrl ?? null });
  const [errors, setErrors] = useState<QuestionErrors>({});
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [moving, startMoving] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");

  const dirty = useMemo(() => JSON.stringify({ ...draft, imagePath: image.path }) !== JSON.stringify(initial), [draft, image.path, initial]);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  // Сақталмаған өзгерістер болса, бетті жабу алдында ескерту
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const patch = (p: Partial<QuestionDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
  };

  const save = () => {
    const full = { ...draft, imagePath: image.path };
    const local = validateQuestion(full);
    if (!local.ok) {
      setErrors(local.errors);
      toast("Формада қателер бар. Белгіленген өрістерді тексеріңіз.", "error");
      return;
    }
    setErrors({});
    startSaving(async () => {
      const res = await saveQuestion(full);
      if (!res.ok) {
        setErrors(res.errors);
        toast(res.errors.form ?? "Сақтау мүмкін болмады", "error");
        return;
      }
      toast(`${position}-сұрақ сақталды`);
      onDirtyChange(false);
      router.refresh();
    });
  };

  const remove = () =>
    startDeleting(async () => {
      if (!question) return;
      const res = await deleteQuestion(question.id);
      if (res.error) toast(res.error, "error");
      else {
        toast(res.message ?? "Өшірілді");
        setConfirmDelete(false);
        onDirtyChange(false);
        router.refresh();
      }
    });

  const section = SECTIONS.find((s) => s.type === type)!;
  const movePositions = Array.from({ length: section.to - section.from + 1 }, (_, i) => section.from + i).filter((p) => p !== position);

  const doMove = () =>
    startMoving(async () => {
      if (!question || !moveTarget) return;
      const target = Number(moveTarget);
      const res = await moveQuestion(question.id, target);
      if (res.error) toast(res.error, "error");
      else {
        toast(occupiedPositions.has(target) ? `${position} және ${target} сұрақтарының орны ауыстырылды` : `Сұрақ ${target}-позицияға жылжытылды`);
        setMoveTarget("");
        onDirtyChange(false);
        router.replace(`/admin/variants/${variantId}?q=${target}`, { scroll: false });
        router.refresh();
      }
    });

  return (
    <div className="card p-5 sm:p-7">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-extrabold">{position}-сұрақ</h2>
            {question ? (
              question.issue ? <Badge tone="amber">Толық емес: {question.issue}</Badge> : <Badge tone="green">Дайын</Badge>
            ) : (
              <Badge>Жаңа</Badge>
            )}
            {dirty && <Badge tone="blue">Сақталмаған өзгерістер</Badge>}
          </div>
          <p className="mt-1 text-sm font-medium text-brand-700">{TYPE_TITLES[type]}</p>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{TYPE_HINTS[type]}</p>
        </div>
      </div>

      {errors.form && (
        <Alert tone="error" className="mb-5">
          {errors.form}
        </Alert>
      )}

      <div className="space-y-6">
        <section>
          <h3 className="mb-2 font-semibold text-navy-900">Сұрақ суреті</h3>
          <ImageUploader
            variantId={variantId}
            position={position}
            value={image}
            savedPath={question?.imagePath ?? null}
            onChange={(v) => {
              setImage(v);
              setErrors((e) => ({ ...e, content: undefined }));
            }}
            invalid={!!errors.content}
          />
        </section>

        <Field id="prompt" label="Сұрақ мәтіні (қосымша)" error={errors.prompt ?? errors.content} hint="Суретке қосымша мәтін жазуға болады. Сурет болмаса — міндетті.">
          <Textarea
            id="prompt"
            value={draft.prompt}
            onChange={(e) => patch({ prompt: e.target.value })}
            rows={3}
            maxLength={4000}
            placeholder="Мысалы: Суретте көрсетілген органоидтың қызметін анықтаңыз."
            invalid={!!errors.content}
          />
        </Field>

        <section>
          <h3 className="mb-3 font-semibold text-navy-900">{type === "matching" ? "Сәйкестендіру" : "Жауап нұсқалары"}</h3>
          {type === "matching" ? (
            <MatchingEditor
              items={draft.matchingItems}
              options={draft.matchingOptions}
              onItemsChange={(matchingItems) => patch({ matchingItems })}
              onOptionsChange={(matchingOptions) => patch({ matchingOptions })}
              errors={errors}
            />
          ) : (
            <>
              <OptionsEditor
                mode={type}
                options={draft.options}
                onChange={(options) => patch({ options })}
                min={OPTION_LIMITS[type].min}
                max={OPTION_LIMITS[type].max}
                textErrors={errors.optionTexts}
              />
              {(errors.options || errors.correct) && (
                <div className="mt-2 space-y-1">
                  {errors.options && <p className="field-error">{errors.options}</p>}
                  {errors.correct && <p className="field-error">{errors.correct}</p>}
                </div>
              )}
              <p className="mt-3 text-sm text-slate-500">
                Белгіленген дұрыс жауап: <b className="text-emerald-700">{draft.options.filter((o) => o.isCorrect).length}</b>
                {type === "multiple" && " (1–3)"}
              </p>
            </>
          )}
        </section>

        <Field id="explanation" label="Түсіндірме (міндетті емес)" error={errors.explanation} hint="Тест аяқталғаннан кейін оқушыға нәтиже бетінде көрсетіледі.">
          <Textarea
            id="explanation"
            value={draft.explanation}
            onChange={(e) => patch({ explanation: e.target.value })}
            rows={3}
            maxLength={4000}
            placeholder="Неліктен бұл жауап дұрыс екенін қысқаша түсіндіріңіз."
          />
        </Field>
      </div>

      <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} loading={saving} disabled={deleting || moving}>
            <Save className="size-4" /> {saving ? "Сақталуда..." : "Сақтау"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(initial);
              setImage({ path: question?.imagePath ?? null, url: question?.imageUrl ?? null });
              setErrors({});
            }}
            disabled={!dirty || saving}
          >
            <Undo2 className="size-4" /> Болдырмау
          </Button>
        </div>

        {question && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Select
                value={moveTarget}
                onChange={(e) => setMoveTarget(e.target.value)}
                className="h-9 w-40 py-1.5 text-sm"
                aria-label="Жаңа нөмірді таңдау"
                disabled={dirty}
                title={dirty ? "Алдымен өзгерістерді сақтаңыз" : undefined}
              >
                <option value="">Нөмірін өзгерту</option>
                {movePositions.map((p) => (
                  <option key={p} value={p}>
                    → {p} {occupiedPositions.has(p) ? "(ауыстыру)" : "(бос)"}
                  </option>
                ))}
              </Select>
              <Button size="sm" variant="outline" onClick={doMove} disabled={!moveTarget || dirty} loading={moving} aria-label="Орнын ауыстыру">
                <ArrowLeftRight className="size-4" />
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)} disabled={saving}>
              <Trash2 className="size-4" /> Өшіру
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={deleting}
        danger
        title={`${position}-сұрақты өшіру керек пе?`}
        confirmLabel="Иә, өшіру"
      >
        Сұрақ, оның суреті және жауап нұсқалары өшіріледі. Жарияланған нұсқадан сұрақ өшірілсе, жаңа оқушылар оны бастай алмайды.
      </ConfirmDialog>
    </div>
  );
}
