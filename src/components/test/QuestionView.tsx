"use client";

import type { ClientAnswer, PublicQuestion } from "@/lib/types";
import { QuestionImage } from "./QuestionImage";
import { SingleChoice } from "./SingleChoice";
import { MultipleChoice } from "./MultipleChoice";
import { MatchingQuestion } from "./MatchingQuestion";

export const TYPE_LABELS = {
  single: "Бір дұрыс жауап · 1 балл",
  matching: "Сәйкестендіру · 2 балл",
  multiple: "Бірнеше дұрыс жауап · 2 балл",
} as const;

export function QuestionView({
  question,
  answer,
  onAnswer,
  disabled,
}: {
  question: PublicQuestion;
  answer: ClientAnswer | undefined;
  onAnswer: (a: ClientAnswer) => void;
  disabled?: boolean;
}) {
  return (
    <div key={question.id} className="animate-fade-in">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-xl font-extrabold sm:text-2xl">{question.position}-сұрақ</h2>
        <span className="text-sm font-medium text-slate-500">{TYPE_LABELS[question.type]}</span>
      </div>

      {question.imageUrl && (
        <div className="mb-4">
          <QuestionImage src={question.imageUrl} alt={`${question.position}-сұрақтың суреті`} priority />
        </div>
      )}
      {question.prompt && (
        <p className="mb-5 text-base leading-relaxed whitespace-pre-line text-slate-800 sm:text-[17px]">{question.prompt}</p>
      )}

      {question.type === "single" && (
        <SingleChoice
          name={`q-${question.id}`}
          options={question.options}
          value={answer?.selected?.[0]}
          onChange={(id) => onAnswer({ selected: [id] })}
          disabled={disabled}
        />
      )}
      {question.type === "multiple" && (
        <MultipleChoice options={question.options} value={answer?.selected ?? []} onChange={(ids) => onAnswer({ selected: ids })} disabled={disabled} />
      )}
      {question.type === "matching" && (
        <MatchingQuestion
          questionId={question.id}
          items={question.matchingItems}
          options={question.matchingOptions}
          value={answer?.matching ?? {}}
          onChange={(m) => onAnswer({ matching: m })}
          disabled={disabled}
        />
      )}
    </div>
  );
}
