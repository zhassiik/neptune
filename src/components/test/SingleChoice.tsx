"use client";

import { cn, OPTION_LETTERS } from "@/lib/utils";
import type { PublicOption } from "@/lib/types";

/** Мәтінсіз нұсқалар (тек скрин) болса — әріптер торы ретінде көрсетіледі */
export function isLettersOnly(options: PublicOption[]) {
  return options.length > 0 && options.every((o) => !o.text.trim());
}

export function SingleChoice({
  name,
  options,
  value,
  onChange,
  disabled,
}: {
  name: string;
  options: PublicOption[];
  value: string | undefined;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const lettersOnly = isLettersOnly(options);
  return (
    <fieldset className={cn(lettersOnly ? "grid grid-cols-4 gap-2.5 sm:grid-cols-6" : "space-y-2.5")} disabled={disabled}>
      <legend className="sr-only">Бір жауапты таңдаңыз</legend>
      {lettersOnly && <p className="col-span-full -mt-1 mb-1 text-sm text-slate-500">Суреттегі дұрыс жауаптың әрпін таңдаңыз:</p>}
      {options.map((o, i) => {
        const checked = value === o.id;
        return (
          <label
            key={o.id}
            className={cn(
              "rounded-2xl border-2 transition select-none hover:border-brand-300 hover:bg-brand-50/40 active:scale-[0.97]",
              lettersOnly ? "grid h-16 place-items-center" : "flex items-start gap-3 px-4 py-3.5",
              checked ? "border-brand-500 bg-brand-50" : "border-slate-100 bg-white",
              disabled && "pointer-events-none opacity-70",
            )}
          >
            <input type="radio" name={name} value={o.id} checked={checked} onChange={() => onChange(o.id)} className="peer sr-only" aria-label={`${OPTION_LETTERS[i]} нұсқасы`} />
            <span
              className={cn(
                "grid shrink-0 place-items-center rounded-full font-bold transition peer-focus-visible:ring-4 peer-focus-visible:ring-brand-200",
                lettersOnly ? "size-10 text-lg" : "size-7 text-sm",
                checked ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600",
              )}
            >
              {OPTION_LETTERS[i]}
            </span>
            {!lettersOnly && <span className="pt-0.5 text-[15px] leading-relaxed text-slate-800 sm:text-base">{o.text}</span>}
          </label>
        );
      })}
    </fieldset>
  );
}
