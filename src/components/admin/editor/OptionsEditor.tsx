"use client";

import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { cn, OPTION_LETTERS, uuid } from "@/lib/utils";
import type { OptionDraft } from "@/lib/admin/question-schema";

export function newOption(text = ""): OptionDraft {
  return { id: null, key: uuid(), text, isCorrect: false };
}

function move<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Жауап нұсқалары редакторы: single (radio) немесе multiple (checkbox) */
export function OptionsEditor({
  mode,
  options,
  onChange,
  min,
  max,
  textErrors,
}: {
  mode: "single" | "multiple" | "plain";
  options: OptionDraft[];
  onChange: (next: OptionDraft[]) => void;
  min: number;
  max: number;
  textErrors?: Record<string, string>;
}) {
  const update = (key: string, patch: Partial<OptionDraft>) => onChange(options.map((o) => (o.key === key ? { ...o, ...patch } : o)));

  const toggleCorrect = (key: string) => {
    if (mode === "single") onChange(options.map((o) => ({ ...o, isCorrect: o.key === key })));
    else update(key, { isCorrect: !options.find((o) => o.key === key)?.isCorrect });
  };

  return (
    <div className="space-y-2.5">
      {options.map((o, i) => (
        <div key={o.key}>
          <div
            className={cn(
              "flex items-start gap-2 rounded-2xl border-2 p-2.5 transition sm:gap-3",
              o.isCorrect && mode !== "plain" ? "border-emerald-300 bg-emerald-50/50" : "border-slate-100 bg-white",
            )}
          >
            {mode !== "plain" ? (
              <button
                type="button"
                onClick={() => toggleCorrect(o.key)}
                className={cn(
                  "mt-1 grid size-8 shrink-0 place-items-center border-2 text-sm font-bold transition active:scale-90",
                  mode === "single" ? "rounded-full" : "rounded-lg",
                  o.isCorrect ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 text-slate-500 hover:border-emerald-400",
                )}
                aria-pressed={o.isCorrect}
                aria-label={`${OPTION_LETTERS[i]} нұсқасын дұрыс деп белгілеу`}
                title="Дұрыс жауап ретінде белгілеу"
              >
                {o.isCorrect ? <Check className="size-4" strokeWidth={3} /> : OPTION_LETTERS[i]}
              </button>
            ) : (
              <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">{i + 1}</span>
            )}
            <Textarea
              value={o.text}
              onChange={(e) => update(o.key, { text: e.target.value })}
              rows={1}
              className="min-h-10 flex-1 py-2"
              placeholder={`${mode === "plain" ? i + 1 : OPTION_LETTERS[i]} мәтіні (міндетті емес — скринде болса, бос қалдырыңыз)`}
              invalid={!!textErrors?.[o.key]}
              aria-label={`${i + 1}-нұсқа мәтіні`}
            />
            <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row">
              <button
                type="button"
                onClick={() => onChange(move(options, i, i - 1))}
                disabled={i === 0}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90 disabled:opacity-30"
                aria-label="Жоғары жылжыту"
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => onChange(move(options, i, i + 1))}
                disabled={i === options.length - 1}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90 disabled:opacity-30"
                aria-label="Төмен жылжыту"
              >
                <ArrowDown className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => onChange(options.filter((x) => x.key !== o.key))}
                disabled={options.length <= min}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 active:scale-90 disabled:opacity-30"
                aria-label="Нұсқаны өшіру"
                title={options.length <= min ? `Кемінде ${min} нұсқа болуы керек` : "Өшіру"}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
          {textErrors?.[o.key] && <p className="field-error ml-12">{textErrors[o.key]}</p>}
        </div>
      ))}
      <Button size="sm" variant="secondary" onClick={() => onChange([...options, newOption()])} disabled={options.length >= max}>
        <Plus className="size-4" /> Нұсқа қосу {options.length >= max && `(макс. ${max})`}
      </Button>
    </div>
  );
}
