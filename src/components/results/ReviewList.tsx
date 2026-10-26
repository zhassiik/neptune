"use client";

import { useMemo, useState } from "react";
import { Check, CircleDashed, Lightbulb, Minus, X } from "lucide-react";
import { QuestionImage } from "@/components/test/QuestionImage";
import { TYPE_LABELS } from "@/components/test/QuestionView";
import { EmptyState } from "@/components/ui/States";
import { cn, OPTION_LETTERS } from "@/lib/utils";
import type { AnswerResult } from "@/lib/scoring";
import type { ReviewQuestion } from "@/lib/types";

const RESULT_STYLES: Record<AnswerResult, { label: string; badge: string; icon: React.ReactNode; nav: string }> = {
  correct: { label: "Дұрыс", badge: "bg-emerald-50 text-emerald-700", icon: <Check className="size-3.5" />, nav: "bg-emerald-500 text-white" },
  partial: { label: "Жартылай дұрыс", badge: "bg-amber-50 text-amber-800", icon: <Minus className="size-3.5" />, nav: "bg-amber-400 text-white" },
  incorrect: { label: "Қате", badge: "bg-red-50 text-red-700", icon: <X className="size-3.5" />, nav: "bg-red-500 text-white" },
  unanswered: { label: "Жауапсыз", badge: "bg-slate-100 text-slate-600", icon: <CircleDashed className="size-3.5" />, nav: "bg-slate-200 text-slate-600" },
};

export type ReviewFilter = "all" | "mistakes" | AnswerResult;

const FILTERS: { key: ReviewFilter; label: string }[] = [
  { key: "all", label: "Барлығы" },
  { key: "mistakes", label: "Барлық қателер" },
  { key: "incorrect", label: "Қате" },
  { key: "partial", label: "Жартылай" },
  { key: "unanswered", label: "Жауапсыз" },
  { key: "correct", label: "Дұрыс" },
];

function matches(q: ReviewQuestion, filter: ReviewFilter) {
  if (filter === "all") return true;
  if (filter === "mistakes") return q.result !== "correct";
  return q.result === filter;
}

export function ReviewList({
  questions,
  showAnswers,
  initialFilter = "all",
}: {
  questions: ReviewQuestion[];
  showAnswers: boolean;
  initialFilter?: ReviewFilter;
}) {
  const [filter, setFilter] = useState<ReviewFilter>(initialFilter);
  const visible = useMemo(() => questions.filter((q) => matches(q, filter)), [questions, filter]);

  return (
    <div>
      {/* Жылдам навигация */}
      <div className="card mb-6 p-5">
        <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-20">
          {questions.map((q) => (
            <a
              key={q.id}
              href={`#q-${q.position}`}
              onClick={() => setFilter("all")}
              className={cn("grid aspect-square place-items-center rounded-lg text-xs font-bold transition hover:opacity-80 active:scale-90", RESULT_STYLES[q.result].nav)}
              title={`${q.position}-сұрақ: ${RESULT_STYLES[q.result].label}`}
            >
              {q.position}
            </a>
          ))}
        </div>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Сүзгі">
        {FILTERS.map((f) => {
          const count = questions.filter((q) => matches(q, f.key)).length;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-95",
                filter === f.key ? "bg-navy-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {f.label} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState title={filter === "mistakes" ? "Қате жоқ — барлық сұраққа дұрыс жауап бердіңіз!" : "Бұл санатта сұрақ жоқ"} />
      ) : (
        <div className="space-y-5">
          {visible.map((q) => (
            <ReviewCard key={q.id} q={q} showAnswers={showAnswers} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ q, showAnswers }: { q: ReviewQuestion; showAnswers: boolean }) {
  const style = RESULT_STYLES[q.result];
  return (
    <article id={`q-${q.position}`} className="card scroll-mt-24 p-5 sm:p-7">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-extrabold">{q.position}-сұрақ</h3>
          <p className="text-xs text-slate-500">{TYPE_LABELS[q.type]}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", style.badge)}>
            {style.icon} {style.label}
          </span>
          <span className="rounded-full bg-navy-800 px-2.5 py-1 text-xs font-bold text-white">
            {q.points}/{q.maxPoints} балл
          </span>
        </div>
      </header>

      {q.imageUrl && (
        <div className="mb-4">
          <QuestionImage src={q.imageUrl} alt={`${q.position}-сұрақтың суреті`} />
        </div>
      )}
      {q.prompt && <p className="mb-4 leading-relaxed whitespace-pre-line text-slate-800">{q.prompt}</p>}

      {q.type === "matching" ? <MatchingReview q={q} showAnswers={showAnswers} /> : <OptionsReview q={q} showAnswers={showAnswers} />}

      {q.explanation && (
        <div className="mt-5 flex gap-3 rounded-2xl bg-brand-50 p-4 text-sm text-navy-800">
          <Lightbulb className="mt-0.5 size-4.5 shrink-0 text-brand-500" />
          <div>
            <div className="mb-1 font-semibold">Түсіндірме</div>
            <p className="leading-relaxed whitespace-pre-line">{q.explanation}</p>
          </div>
        </div>
      )}
    </article>
  );
}

function OptionsReview({ q, showAnswers }: { q: ReviewQuestion; showAnswers: boolean }) {
  const correct = new Set(q.correctOptionIds ?? []);
  return (
    <ul className="space-y-2">
      {q.options.map((o, i) => {
        const picked = q.studentSelected.includes(o.id);
        const isCorrect = showAnswers && correct.has(o.id);
        const wrongPick = showAnswers && picked && !correct.has(o.id);
        return (
          <li
            key={o.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border-2 px-3.5 py-3 text-[15px]",
              isCorrect ? "border-emerald-300 bg-emerald-50/60" : wrongPick ? "border-red-300 bg-red-50/60" : picked ? "border-brand-300 bg-brand-50" : "border-slate-100",
            )}
          >
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold",
                isCorrect ? "bg-emerald-500 text-white" : wrongPick ? "bg-red-500 text-white" : picked ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500",
              )}
            >
              {OPTION_LETTERS[i]}
            </span>
            <span className="flex-1 leading-relaxed">{o.text || <span className="text-slate-400">{OPTION_LETTERS[i]} нұсқасы</span>}</span>
            <span className="flex shrink-0 flex-col items-end gap-1 text-xs font-semibold">
              {picked && <span className={wrongPick ? "text-red-600" : "text-brand-700"}>Сіздің жауабыңыз</span>}
              {isCorrect && <span className="text-emerald-700">Дұрыс жауап</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function MatchingReview({ q, showAnswers }: { q: ReviewQuestion; showAnswers: boolean }) {
  const optText = (id: string | null | undefined) => {
    if (!id) return null;
    const idx = q.matchingOptions.findIndex((o) => o.id === id);
    return idx >= 0 ? (q.matchingOptions[idx].text ? `${idx + 1}) ${q.matchingOptions[idx].text}` : `${idx + 1}`) : null;
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      {q.matchingItems.map((item, idx) => {
        const mine = q.studentMatching[item.id];
        const right = q.correctMatching?.[item.id];
        const ok = showAnswers && mine && mine === right;
        return (
          <div key={item.id} className={cn("grid gap-3 p-4 sm:grid-cols-[1fr_1fr_1fr]", idx > 0 && "border-t border-slate-100")}>
            <div className="flex items-start gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-navy-800 text-sm font-bold text-white">{item.label}</span>
              <span className="pt-0.5 leading-relaxed">{item.text}</span>
            </div>
            <div className="text-sm">
              <div className="text-xs font-semibold text-slate-500">Сіздің жауабыңыз</div>
              <div className={cn("mt-0.5 font-medium", !mine ? "text-slate-400" : !showAnswers ? "text-navy-900" : ok ? "text-emerald-700" : "text-red-600")}>
                {optText(mine) ?? "Жауап берілмеген"}
              </div>
            </div>
            {showAnswers && (
              <div className="text-sm">
                <div className="text-xs font-semibold text-slate-500">Дұрыс жауап</div>
                <div className="mt-0.5 font-medium text-emerald-700">{optText(right) ?? "—"}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
