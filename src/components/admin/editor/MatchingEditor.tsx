"use client";

import { Field, Input, Select } from "@/components/ui/Field";
import { MATCHING_OPTION_LIMITS, type MatchingItemDraft, type OptionDraft, type QuestionErrors } from "@/lib/admin/question-schema";
import { OptionsEditor } from "./OptionsEditor";

export function MatchingEditor({
  items,
  options,
  onItemsChange,
  onOptionsChange,
  errors,
}: {
  items: MatchingItemDraft[];
  options: OptionDraft[];
  onItemsChange: (items: MatchingItemDraft[]) => void;
  onOptionsChange: (options: OptionDraft[]) => void;
  errors: QuestionErrors;
}) {
  const updateItem = (label: "A" | "B", patch: Partial<MatchingItemDraft>) =>
    onItemsChange(items.map((i) => (i.label === label ? { ...i, ...patch } : i)));

  // Өшірілген опцияға сілтейтін дұрыс жауапты тазалау
  const handleOptions = (next: OptionDraft[]) => {
    const keys = new Set(next.map((o) => o.key));
    if (items.some((i) => i.correctKey && !keys.has(i.correctKey))) {
      onItemsChange(items.map((i) => (i.correctKey && !keys.has(i.correctKey) ? { ...i, correctKey: null } : i)));
    }
    onOptionsChange(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-1 font-semibold text-navy-900">Ортақ жауап нұсқалары (dropdown ішінде)</h4>
        <p className="mb-3 text-sm text-slate-500">
          Оқушы A және B элементтері үшін осы тізімнен таңдайды. {MATCHING_OPTION_LIMITS.min}–{MATCHING_OPTION_LIMITS.max} нұсқа.
        </p>
        <OptionsEditor mode="plain" options={options} onChange={handleOptions} min={MATCHING_OPTION_LIMITS.min} max={MATCHING_OPTION_LIMITS.max} textErrors={errors.optionTexts} />
        {errors.matchingOptions && <p className="field-error">{errors.matchingOptions}</p>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="hidden grid-cols-[1fr_minmax(200px,1fr)] bg-slate-50 px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:grid">
          <span>Элемент</span>
          <span>Дұрыс сәйкестік</span>
        </div>
        {items.map((item, idx) => {
          const err = item.label === "A" ? errors.matchingA : errors.matchingB;
          return (
            <div key={item.label} className={idx > 0 ? "border-t border-slate-100" : ""}>
              <div className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_minmax(200px,1fr)] sm:items-start">
                <Field id={`item-${item.label}`} label={<span className="font-bold text-navy-900">{item.label}) элементі <span className="font-normal text-slate-400">(міндетті емес)</span></span>}>
                  <Input
                    id={`item-${item.label}`}
                    value={item.text}
                    onChange={(e) => updateItem(item.label, { text: e.target.value })}
                    placeholder={item.label === "A" ? "Мысалы: Митохондрия" : "Мысалы: Рибосома"}
                    invalid={false}
                    maxLength={500}
                  />
                </Field>
                <Field id={`correct-${item.label}`} label={`${item.label} үшін дұрыс жауап`}>
                  <Select
                    id={`correct-${item.label}`}
                    value={item.correctKey ?? ""}
                    onChange={(e) => updateItem(item.label, { correctKey: e.target.value || null })}
                    invalid={!!err}
                    className={item.correctKey ? "border-emerald-300 bg-emerald-50/50" : undefined}
                  >
                    <option value="">— Таңдаңыз —</option>
                    {options.map((o, i) => (
                      <option key={o.key} value={o.key}>
                        {o.text ? `${i + 1}) ${o.text}` : `${i + 1}`}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              {err && <p className="field-error px-4 pb-3">{err}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
