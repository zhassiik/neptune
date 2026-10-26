"use client";

import { Select } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import type { PublicOption, PublicQuestion } from "@/lib/types";

/**
 * Сәйкестендіру: сол жақта A/B элементтері, оң жақта әрқайсысына dropdown.
 * Dropdown ішінде мұғалім енгізген ортақ жауап нұсқалары.
 */
export function MatchingQuestion({
  questionId,
  items,
  options,
  value,
  onChange,
  disabled,
}: {
  questionId: string;
  items: PublicQuestion["matchingItems"];
  options: PublicOption[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="hidden grid-cols-[1fr_minmax(220px,1fr)] bg-slate-50 px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:grid">
        <span>Элемент</span>
        <span>Сәйкес жауап</span>
      </div>
      {items.map((item, idx) => {
        const selected = value[item.id] ?? "";
        const id = `${questionId}-${item.label}`;
        return (
          <div
            key={item.id}
            className={cn(
              "grid gap-3 px-4 py-4 sm:grid-cols-[1fr_minmax(220px,1fr)] sm:items-center",
              idx > 0 && "border-t border-slate-100",
            )}
          >
            <label htmlFor={id} className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-navy-800 font-bold text-white">{item.label}</span>
              <span className="pt-1 text-[15px] leading-relaxed text-slate-800 sm:text-base">{item.text || <span className="text-slate-500">элементіне сәйкес жауап</span>}</span>
            </label>
            <Select
              id={id}
              value={selected}
              disabled={disabled}
              onChange={(e) => {
                const next = { ...value };
                if (e.target.value) next[item.id] = e.target.value;
                else delete next[item.id];
                onChange(next);
              }}
              className={cn(selected && "border-brand-400 bg-brand-50/50 font-medium text-navy-900")}
            >
              <option value="">— Жауапты таңдаңыз —</option>
              {options.map((o, i) => (
                <option key={o.id} value={o.id}>
                  {o.text ? `${i + 1}) ${o.text}` : `${i + 1}`}
                </option>
              ))}
            </Select>
          </div>
        );
      })}
    </div>
  );
}
