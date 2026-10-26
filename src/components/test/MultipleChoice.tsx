"use client";

import { Check, Info } from "lucide-react";
import { MAX_MULTIPLE_SELECTIONS } from "@/lib/scoring";
import { cn, OPTION_LETTERS } from "@/lib/utils";
import type { PublicOption } from "@/lib/types";
import { isLettersOnly } from "./SingleChoice";

export function MultipleChoice({
  options,
  value,
  onChange,
  disabled,
}: {
  options: PublicOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const limitReached = value.length >= MAX_MULTIPLE_SELECTIONS;
  const lettersOnly = isLettersOnly(options);

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else if (!limitReached) onChange([...value, id]);
  };

  return (
    <div>
      <p
        className={cn(
          "mb-3 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm transition",
          limitReached ? "bg-amber-50 text-amber-900" : "bg-brand-50 text-navy-800",
        )}
        role="status"
      >
        <Info className="size-4 shrink-0" />
        <span>
          Бір немесе бірнеше дұрыс жауап бар. <b>3 жауаптан артық таңдауға болмайды.</b>{" "}
          <span className="whitespace-nowrap">
            Таңдалды: {value.length}/{MAX_MULTIPLE_SELECTIONS}
          </span>
        </span>
      </p>
      <fieldset className={cn(lettersOnly ? "grid grid-cols-3 gap-2.5 sm:grid-cols-6" : "space-y-2.5")} disabled={disabled}>
        <legend className="sr-only">Бірнеше жауапты таңдаңыз</legend>
        {options.map((o, i) => {
          const checked = value.includes(o.id);
          const blocked = !checked && limitReached;
          return (
            <label
              key={o.id}
              className={cn(
                "rounded-2xl border-2 transition select-none",
                lettersOnly ? "grid h-16 place-items-center" : "flex items-start gap-3 px-4 py-3.5",
                checked ? "border-brand-500 bg-brand-50" : "border-slate-100 bg-white",
                blocked ? "cursor-not-allowed opacity-50" : "hover:border-brand-300 hover:bg-brand-50/40 active:scale-[0.97]",
                disabled && "pointer-events-none opacity-70",
              )}
              title={blocked ? "3 жауаптан артық таңдауға болмайды" : undefined}
            >
              <input type="checkbox" checked={checked} disabled={blocked} onChange={() => toggle(o.id)} className="peer sr-only" aria-label={`${OPTION_LETTERS[i]} нұсқасы`} />
              <span
                className={cn(
                  "grid shrink-0 place-items-center rounded-lg border-2 font-bold transition peer-focus-visible:ring-4 peer-focus-visible:ring-brand-200",
                  lettersOnly ? "size-10 text-lg" : "size-7 text-sm",
                  checked ? "border-brand-500 bg-brand-500 text-white" : "border-slate-200 bg-white text-slate-500",
                )}
              >
                {checked && !lettersOnly ? <Check className="size-4" strokeWidth={3} /> : OPTION_LETTERS[i]}
              </span>
              {!lettersOnly && <span className="pt-0.5 text-[15px] leading-relaxed text-slate-800 sm:text-base">{o.text}</span>}
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}
