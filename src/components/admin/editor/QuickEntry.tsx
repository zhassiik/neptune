"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ImageOff, Images, Loader2, Pencil, RefreshCw, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { createClient } from "@/lib/supabase/client";
import { attachQuestionImage, saveQuestion } from "@/lib/admin/actions";
import { ACCEPTED_IMAGE_TYPES, optimizeImage, validateImageFile } from "@/lib/admin/image";
import { MAX_CORRECT_MULTIPLE, validateQuestion, type QuestionDraft } from "@/lib/admin/question-schema";
import { questionTypeForPosition, SECTIONS } from "@/lib/scoring";
import { cn, humanizeError, OPTION_LETTERS, uuid } from "@/lib/utils";
import { buildDraft } from "./QuestionEditor";
import type { EditorQuestion } from "./types";

const BUCKET = "question-images";
const POSITIONS = Array.from({ length: 40 }, (_, i) => i + 1);
const SECTION_TITLES = { single: "Бір дұрыс жауап · 1 балл", matching: "Сәйкестендіру · 2 балл", multiple: "Бірнеше дұрыс жауап (1–3) · 2 балл" };

type RowStatus = "saving" | "unsaved" | "error";

/* ---------- Жауап кілтін өзгерту көмекшілері ---------- */

function newKey() {
  return uuid();
}

function withOptionCount(d: QuestionDraft, n: number): QuestionDraft {
  if (questionTypeForPosition(d.position) === "matching") {
    const opts = d.matchingOptions.slice(0, n);
    while (opts.length < n) opts.push({ id: null, key: newKey(), text: "", isCorrect: false });
    const keys = new Set(opts.map((o) => o.key));
    return {
      ...d,
      matchingOptions: opts,
      matchingItems: d.matchingItems.map((i) => (i.correctKey && !keys.has(i.correctKey) ? { ...i, correctKey: null } : i)),
    };
  }
  const opts = d.options.slice(0, n);
  while (opts.length < n) opts.push({ id: null, key: newKey(), text: "", isCorrect: false });
  return { ...d, options: opts };
}

function withCorrect(d: QuestionDraft, index: number): QuestionDraft | string {
  const type = questionTypeForPosition(d.position);
  if (type === "single") return { ...d, options: d.options.map((o, i) => ({ ...o, isCorrect: i === index })) };
  const target = d.options[index];
  if (!target.isCorrect && d.options.filter((o) => o.isCorrect).length >= MAX_CORRECT_MULTIPLE) {
    return `Дұрыс жауаптар ${MAX_CORRECT_MULTIPLE}-тен аспауы керек`;
  }
  return { ...d, options: d.options.map((o, i) => (i === index ? { ...o, isCorrect: !o.isCorrect } : o)) };
}

function withMatching(d: QuestionDraft, label: "A" | "B", optionIndex: number | null): QuestionDraft {
  const key = optionIndex == null ? null : d.matchingOptions[optionIndex]?.key ?? null;
  return { ...d, matchingItems: d.matchingItems.map((i) => (i.label === label ? { ...i, correctKey: key } : i)) };
}

function naturalSort(files: File[]) {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

/* ---------- Негізгі компонент ---------- */

export function QuickEntry({ variantId, questions }: { variantId: string; questions: EditorQuestion[] }) {
  const router = useRouter();
  const toast = useToast();
  const byPos = useMemo(() => new Map(questions.map((q) => [q.position, q])), [questions]);

  const [pending, setPending] = useState<Record<number, QuestionDraft>>({});
  const [status, setStatus] = useState<Record<number, RowStatus>>({});
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [uploadingRows, setUploadingRows] = useState<Set<number>>(new Set());
  const [bulk, setBulk] = useState<{ files: File[]; start: number } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; errors: string[] } | null>(null);
  const [zoom, setZoom] = useState<{ url: string; position: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const queues = useRef(new Map<number, Promise<void>>());
  const inFlight = useRef(new Set<number>());
  const bulkInput = useRef<HTMLInputElement>(null);
  const rowInput = useRef<HTMLInputElement>(null);
  const rowTarget = useRef<number | null>(null);

  // Сервер деректері жаңарғанда — сақталған жолдардың уақытша күйін тазалау
  useEffect(() => {
    setPending((p) => {
      const next = { ...p };
      for (const pos of Object.keys(next).map(Number)) {
        if (!inFlight.current.has(pos) && status[pos] !== "unsaved" && status[pos] !== "error") delete next[pos];
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  const hasUnsaved = Object.values(status).some((s) => s === "unsaved" || s === "saving");
  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  const draftFor = useCallback(
    (pos: number): QuestionDraft => pending[pos] ?? buildDraft(variantId, pos, byPos.get(pos)),
    [pending, byPos, variantId],
  );

  /** Жолды өзгерту: толық болса — бірден сақталады, болмаса — «сақталмаған» болып қалады */
  const update = useCallback(
    (pos: number, next: QuestionDraft) => {
      const q = byPos.get(pos);
      const draft = { ...next, imagePath: q?.imagePath ?? next.imagePath };
      setPending((p) => ({ ...p, [pos]: draft }));
      const valid = validateQuestion(draft);
      if (!valid.ok) {
        setStatus((s) => ({ ...s, [pos]: "unsaved" }));
        return;
      }
      setStatus((s) => ({ ...s, [pos]: "saving" }));
      const prev = queues.current.get(pos) ?? Promise.resolve();
      const job = prev.then(async () => {
        inFlight.current.add(pos);
        try {
          const res = await saveQuestion(draft);
          if (!res.ok) {
            setStatus((s) => ({ ...s, [pos]: "error" }));
            toast(`${pos}-сұрақ: ${Object.values(res.errors).find((v) => typeof v === "string") ?? "сақтау қатесі"}`, "error");
          } else {
            setStatus((s) => {
              const n = { ...s };
              delete n[pos];
              return n;
            });
            router.refresh();
          }
        } catch (e) {
          setStatus((s) => ({ ...s, [pos]: "error" }));
          toast(`${pos}-сұрақ: ${humanizeError(e)}`, "error");
        } finally {
          inFlight.current.delete(pos);
        }
      });
      queues.current.set(pos, job);
    },
    [byPos, router, toast],
  );

  /* ---------- Скрин жүктеу ---------- */

  async function uploadOne(pos: number, file: File): Promise<string | null> {
    const invalid = validateImageFile(file);
    if (invalid) return `${file.name}: ${invalid}`;
    try {
      const optimized = await optimizeImage(file);
      const path = `variants/${variantId}/q${pos}-${uuid()}.${optimized.ext}`;
      const supabase = createClient();
      const { error } = await supabase.storage.from(BUCKET).upload(path, optimized.blob, { contentType: optimized.type, cacheControl: "31536000" });
      if (error) throw error;
      const res = await attachQuestionImage(variantId, pos, path);
      if (!res.ok) throw new Error(res.error);
      setPreviews((p) => ({ ...p, [pos]: URL.createObjectURL(file) }));
      return null;
    } catch (e) {
      return `${pos}-сұрақ (${file.name}): ${humanizeError(e)}`;
    }
  }

  async function runBulk(files: File[], start: number) {
    const targets = files.slice(0, 41 - start).map((file, i) => ({ file, pos: start + i }));
    setBulk(null);
    setProgress({ done: 0, total: targets.length, errors: [] });
    setUploadingRows(new Set(targets.map((t) => t.pos)));
    let cursor = 0;
    const worker = async () => {
      while (cursor < targets.length) {
        const { file, pos } = targets[cursor++];
        const err = await uploadOne(pos, file);
        setUploadingRows((s) => {
          const n = new Set(s);
          n.delete(pos);
          return n;
        });
        setProgress((p) => p && { ...p, done: p.done + 1, errors: err ? [...p.errors, err] : p.errors });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    router.refresh();
    toast(`${targets.length} скрин өңделді`);
  }

  function chooseBulk(list: FileList | null) {
    const files = naturalSort(Array.from(list ?? []).filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type as (typeof ACCEPTED_IMAGE_TYPES)[number])));
    if (!files.length) {
      toast("JPG, PNG немесе WebP суреттерін таңдаңыз", "error");
      return;
    }
    const firstEmpty = POSITIONS.find((p) => !byPos.get(p)?.imagePath) ?? 1;
    setBulk({ files, start: files.length >= 40 ? 1 : firstEmpty });
  }

  async function replaceRow(file: File | undefined) {
    const pos = rowTarget.current;
    if (!file || pos == null) return;
    setUploadingRows((s) => new Set(s).add(pos));
    const err = await uploadOne(pos, file);
    setUploadingRows((s) => {
      const n = new Set(s);
      n.delete(pos);
      return n;
    });
    if (err) toast(err, "error");
    else router.refresh();
    if (rowInput.current) rowInput.current.value = "";
  }

  const doneCount = POSITIONS.filter((p) => byPos.get(p) && !byPos.get(p)!.issue && !status[p]).length;
  const imagesCount = POSITIONS.filter((p) => byPos.get(p)?.imagePath || previews[p]).length;
  const bulkOverwrites = bulk ? bulk.files.slice(0, 41 - bulk.start).filter((_, i) => byPos.get(bulk.start + i)?.imagePath).length : 0;

  return (
    <div>
      <input ref={bulkInput} type="file" multiple accept={ACCEPTED_IMAGE_TYPES.join(",")} className="sr-only" onChange={(e) => { chooseBulk(e.target.files); e.target.value = ""; }} aria-label="Скриндерді таңдау" />
      <input ref={rowInput} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} className="sr-only" onChange={(e) => replaceRow(e.target.files?.[0])} aria-label="Скринді ауыстыру" />

      {/* Жаппай жүктеу */}
      <div
        className={cn(
          "card mb-6 flex flex-col gap-4 border-2 border-dashed p-5 transition sm:flex-row sm:items-center sm:p-6",
          dragOver ? "border-brand-500 bg-brand-50" : "border-brand-200",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          chooseBulk(e.dataTransfer.files);
        }}
      >
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-500">
          <Images className="size-7" />
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-bold">1-қадам: скриндерді жүктеу</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Барлық скринді бірден таңдаңыз немесе осында сүйреп әкеліңіз. Файлдар атауы бойынша ретке келтіріледі
            (<code className="rounded bg-slate-100 px-1">1.png, 2.png … 40.png</code>) және сұрақтарға кезекпен беріледі.
          </p>
          <p className="mt-1 text-sm font-medium text-navy-800">Жүктелген скрин: {imagesCount}/40</p>
        </div>
        <Button size="lg" onClick={() => bulkInput.current?.click()} disabled={!!progress && progress.done < progress.total}>
          <UploadCloud className="size-5" /> Скриндерді таңдау
        </Button>
      </div>

      {progress && (
        <div className="card mb-6 p-5">
          <div className="flex items-center justify-between text-sm font-medium">
            <span className="flex items-center gap-2">
              {progress.done < progress.total ? <Loader2 className="size-4 animate-spin text-brand-500" /> : <CheckCircle2 className="size-4 text-emerald-600" />}
              Жүктелді: {progress.done}/{progress.total}
            </span>
            {progress.done >= progress.total && (
              <button type="button" className="text-slate-500 hover:text-slate-800" onClick={() => setProgress(null)}>
                Жабу
              </button>
            )}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          {progress.errors.length > 0 && (
            <Alert tone="error" className="mt-3">
              <ul className="list-inside list-disc">
                {progress.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alert>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">2-қадам: дұрыс жауаптарды белгілеу</h2>
        <Badge tone={doneCount === 40 ? "green" : "blue"}>Дайын: {doneCount}/40</Badge>
      </div>
      <p className="-mt-2 mb-5 text-sm text-slate-500">Әріпті басқанда жауап бірден сақталады. Нұсқа саны скриндегімен бірдей болуы керек.</p>

      {SECTIONS.map((section) => (
        <section key={section.type} className="mb-8">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
            {section.from}–{section.to} · {SECTION_TITLES[section.type]}
          </h3>
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {POSITIONS.filter((p) => p >= section.from && p <= section.to).map((pos) => {
              const q = byPos.get(pos);
              const imageUrl = previews[pos] ?? q?.imageUrl ?? null;
              // Жауапты белгілеу тек скрин серверде сақталғаннан кейін ашылады
              const hasImage = !!q?.imagePath;
              return (
                <QuickRow
                  key={pos}
                  position={pos}
                  draft={draftFor(pos)}
                  imageUrl={imageUrl}
                  hasImage={hasImage}
                  uploading={uploadingRows.has(pos)}
                  status={status[pos]}
                  complete={!!q && !q.issue && !status[pos]}
                  variantId={variantId}
                  onChange={(d) => update(pos, d)}
                  onError={(m) => toast(m, "error")}
                  onZoom={() => imageUrl && setZoom({ url: imageUrl, position: pos })}
                  onReplace={() => {
                    rowTarget.current = pos;
                    rowInput.current?.click();
                  }}
                />
              );
            })}
          </div>
        </section>
      ))}

      <ConfirmDialog
        open={!!bulk}
        onClose={() => setBulk(null)}
        onConfirm={() => bulk && runBulk(bulk.files, bulk.start)}
        title={`${bulk?.files.length ?? 0} скрин таңдалды`}
        confirmLabel="Жүктеу"
      >
        {bulk && (
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <span className="text-sm">Қай сұрақтан бастап:</span>
              <Select value={bulk.start} onChange={(e) => setBulk({ ...bulk, start: Number(e.target.value) })} className="h-9 w-24 py-1.5">
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </label>
            <p className="text-sm">
              {bulk.files[0].name} → {bulk.start}-сұрақ
              {bulk.files.length > 1 && (
                <>
                  , …, {bulk.files[Math.min(bulk.files.length, 41 - bulk.start) - 1].name} → {Math.min(40, bulk.start + bulk.files.length - 1)}-сұрақ
                </>
              )}
            </p>
            {bulk.files.length > 41 - bulk.start && (
              <p className="text-sm text-amber-700">{bulk.files.length - (41 - bulk.start)} файл 40-сұрақтан асып кетеді — олар жүктелмейді.</p>
            )}
            {bulkOverwrites > 0 && <p className="text-sm text-amber-700">{bulkOverwrites} сұрақтың бұрынғы скрині ауыстырылады (жауаптары сақталады).</p>}
          </div>
        )}
      </ConfirmDialog>

      <Modal open={!!zoom} onClose={() => setZoom(null)} size="full" title={zoom ? `${zoom.position}-сұрақ` : ""}>
        {zoom && (
          // eslint-disable-next-line @next/next/no-img-element -- түпнұсқа сапада көрсету
          <img src={zoom.url} alt={`${zoom.position}-сұрақ`} className="mx-auto h-auto max-h-[78vh] w-auto max-w-full rounded-xl" />
        )}
      </Modal>
    </div>
  );
}

/* ---------- Бір сұрақтың жолы ---------- */

function QuickRow({
  position,
  draft,
  imageUrl,
  hasImage,
  uploading,
  status,
  complete,
  variantId,
  onChange,
  onError,
  onZoom,
  onReplace,
}: {
  position: number;
  draft: QuestionDraft;
  imageUrl: string | null;
  hasImage: boolean;
  uploading: boolean;
  status: RowStatus | undefined;
  complete: boolean;
  variantId: string;
  onChange: (d: QuestionDraft) => void;
  onError: (message: string) => void;
  onZoom: () => void;
  onReplace: () => void;
}) {
  const type = questionTypeForPosition(position);
  const disabled = !hasImage || uploading;

  return (
    <div className="grid gap-4 p-4 sm:grid-cols-[44px_180px_minmax(0,1fr)] sm:items-center sm:p-5">
      <div className="flex items-center justify-between sm:block">
        <span className="font-display text-xl font-extrabold text-navy-900">{position}</span>
        <span className="sm:hidden">
          <RowBadge status={status} complete={complete} hasImage={hasImage} />
        </span>
      </div>

      {/* Скрин */}
      <div className="relative">
        {imageUrl ? (
          <button type="button" onClick={onZoom} className="block w-full overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-brand-300 active:scale-[0.99]" aria-label={`${position}-сұрақтың скринін үлкейту`}>
            <Image src={imageUrl} alt={`${position}-сұрақ`} width={360} height={220} unoptimized className="h-28 w-full object-contain" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onReplace}
            className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400 transition hover:border-brand-300 hover:text-brand-600"
          >
            <ImageOff className="size-5" /> Скрин жүктеу
          </button>
        )}
        {uploading && (
          <div className="absolute inset-0 grid place-items-center rounded-xl bg-white/75">
            <Loader2 className="size-6 animate-spin text-brand-500" />
          </div>
        )}
        {imageUrl && !uploading && (
          <button type="button" onClick={onReplace} className="absolute top-1.5 right-1.5 rounded-lg bg-white/90 p-1.5 text-slate-500 shadow-sm transition hover:text-brand-600" aria-label="Скринді ауыстыру" title="Скринді ауыстыру">
            <RefreshCw className="size-3.5" />
          </button>
        )}
      </div>

      {/* Жауап кілті */}
      <div className={cn("min-w-0", disabled && "pointer-events-none opacity-45")} aria-disabled={disabled}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {type === "matching" ? (
            <MatchingKey draft={draft} onChange={onChange} />
          ) : (
            <ChoiceKey draft={draft} type={type} onChange={onChange} onError={onError} />
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="hidden sm:inline">
            <RowBadge status={status} complete={complete} hasImage={hasImage} />
          </span>
          <Link href={`/admin/variants/${variantId}?q=${position}`} className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-brand-600">
            <Pencil className="size-3" /> Мәтін/түсіндірме қосу
          </Link>
        </div>
      </div>
    </div>
  );
}

function RowBadge({ status, complete, hasImage }: { status: RowStatus | undefined; complete: boolean; hasImage: boolean }) {
  if (status === "saving")
    return (
      <Badge tone="blue">
        <Loader2 className="size-3 animate-spin" /> Сақталуда
      </Badge>
    );
  if (status === "error")
    return (
      <Badge tone="red">
        <AlertTriangle className="size-3" /> Қате — қайта басыңыз
      </Badge>
    );
  if (status === "unsaved") return <Badge tone="amber">Жауапты толық белгілеңіз</Badge>;
  if (!hasImage) return <Badge>Скрин жоқ</Badge>;
  if (complete)
    return (
      <Badge tone="green">
        <CheckCircle2 className="size-3" /> Сақталды
      </Badge>
    );
  return <Badge tone="amber">Дұрыс жауап белгіленбеген</Badge>;
}

function CountToggle({ value, choices, onChange }: { value: number; choices: number[]; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      Нұсқа саны:
      <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
        {choices.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn("rounded-md px-2.5 py-1 text-xs font-semibold transition", value === n ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChoiceKey({
  draft,
  type,
  onChange,
  onError,
}: {
  draft: QuestionDraft;
  type: "single" | "multiple";
  onChange: (d: QuestionDraft) => void;
  onError: (m: string) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-1.5" role={type === "single" ? "radiogroup" : "group"} aria-label="Дұрыс жауап">
        {draft.options.map((o, i) => (
          <button
            key={o.key}
            type="button"
            role={type === "single" ? "radio" : "checkbox"}
            aria-checked={o.isCorrect}
            onClick={() => {
              const next = withCorrect(draft, i);
              if (typeof next === "string") onError(next);
              else onChange(next);
            }}
            className={cn(
              "grid size-11 place-items-center border-2 text-base font-bold transition active:scale-90",
              type === "single" ? "rounded-full" : "rounded-xl",
              o.isCorrect ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-700",
            )}
            title={o.text || undefined}
          >
            {OPTION_LETTERS[i]}
          </button>
        ))}
      </div>
      <CountToggle value={draft.options.length} choices={type === "single" ? [4, 5] : [5, 6]} onChange={(n) => onChange(withOptionCount(draft, n))} />
    </>
  );
}

function MatchingKey({ draft, onChange }: { draft: QuestionDraft; onChange: (d: QuestionDraft) => void }) {
  return (
    <>
      {draft.matchingItems.map((item) => {
        const idx = draft.matchingOptions.findIndex((o) => o.key === item.correctKey);
        return (
          <label key={item.label} className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-navy-800 font-bold text-white">{item.label}</span>
            <span className="text-slate-400">→</span>
            <Select
              value={idx >= 0 ? idx : ""}
              onChange={(e) => onChange(withMatching(draft, item.label, e.target.value === "" ? null : Number(e.target.value)))}
              className={cn("h-11 w-24 py-2 text-base font-bold", idx >= 0 && "border-emerald-400 bg-emerald-50 text-emerald-800")}
              aria-label={`${item.label} үшін дұрыс жауап`}
            >
              <option value="">—</option>
              {draft.matchingOptions.map((o, i) => (
                <option key={o.key} value={i}>
                  {i + 1}
                </option>
              ))}
            </Select>
          </label>
        );
      })}
      <label className="flex items-center gap-2 text-xs text-slate-500">
        Жауап нұсқалары:
        <Select value={draft.matchingOptions.length} onChange={(e) => onChange(withOptionCount(draft, Number(e.target.value)))} className="h-8 w-16 py-1 text-xs">
          {[2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </label>
    </>
  );
}
