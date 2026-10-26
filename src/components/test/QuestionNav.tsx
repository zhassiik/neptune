"use client";

import { cn } from "@/lib/utils";
import type { AnswersMap, PublicQuestion } from "@/lib/types";
import { isAnswered } from "./answers";

export function QuestionNav({
  questions,
  answers,
  current,
  onSelect,
}: {
  questions: PublicQuestion[];
  answers: AnswersMap;
  current: number;
  onSelect: (index: number) => void;
}) {
  const answeredCount = questions.filter((q) => isAnswered(q, answers[q.id])).length;

  return (
    <nav aria-label="Сұрақтар навигациясы">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-semibold text-navy-900">Сұрақтар</span>
        <span className="text-slate-500">
          Жауап берілді: <b className="text-brand-600">{answeredCount}</b>/{questions.length}
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(answeredCount / Math.max(1, questions.length)) * 100}%` }} />
      </div>
      <ol className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-5">
        {questions.map((q, i) => {
          const answered = isAnswered(q, answers[q.id]);
          const isCurrent = i === current;
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`${q.position}-сұрақ${answered ? ", жауап берілді" : ", жауап берілмеген"}`}
                className={cn(
                  "grid aspect-square w-full place-items-center rounded-lg text-sm font-semibold transition active:scale-90",
                  answered ? "bg-brand-500 text-white hover:bg-brand-600" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                  isCurrent && "ring-[2.5px] ring-navy-800 ring-offset-2",
                )}
              >
                {q.position}
              </button>
            </li>
          );
        })}
      </ol>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-brand-500" /> Жауап берілді
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-slate-200" /> Жауап жоқ
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded ring-2 ring-navy-800" /> Ағымдағы
        </li>
      </ul>
    </nav>
  );
}
