"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Cloud, CloudOff, Eye, Flag, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/utils";
import type { AnswersMap, PublicQuestion } from "@/lib/types";
import { QuestionView } from "./QuestionView";
import { QuestionNav } from "./QuestionNav";
import { Timer } from "./Timer";
import { isAnswered, toPayload } from "./answers";
import { clearAttemptStorage, useAttemptSync, type SyncStatus } from "./useAttemptSync";
import { SessionGuard } from "@/components/devices/SessionGuard";

interface TestRunnerProps {
  mode: "attempt" | "preview";
  attemptId: string;
  title: string;
  questions: PublicQuestion[];
  initialAnswers: AnswersMap;
  deadline: string | null;
  serverNow: string;
  exitHref: string;
}

export function TestRunner({ mode, attemptId, title, questions, initialAnswers, deadline, serverNow, exitHref }: TestRunnerProps) {
  const router = useRouter();
  const isPreview = mode === "preview";
  const [finishOpen, setFinishOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const submittedRef = useRef(false);

  useEffect(() => {
    setClockOffset(new Date(serverNow).getTime() - Date.now());
  }, [serverNow]);

  const handleConflict = useCallback(
    (code: "submitted" | "deadline") => {
      if (code === "submitted") router.replace(`/results/${attemptId}`);
      else setTimeUp(true);
    },
    [attemptId, router],
  );

  const { answers, answersRef, current, goTo, setAnswer, status } = useAttemptSync({
    attemptId,
    initialAnswers,
    enabled: !isPreview,
    onConflict: handleConflict,
  });

  const index = Math.min(Math.max(current, 0), questions.length - 1);
  const question = questions[index];
  const unansweredCount = useMemo(() => questions.filter((q) => !isAnswered(q, answers[q.id])).length, [questions, answers]);

  const submit = useCallback(async () => {
    if (isPreview || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = questions
        .filter((q) => answersRef.current[q.id])
        .map((q) => toPayload(q.id, answersRef.current[q.id]));
      const res = await fetch(`/api/attempts/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Тестті аяқтау мүмкін болмады");
      clearAttemptStorage(attemptId);
      router.replace(body.redirect ?? `/results/${attemptId}`);
      router.refresh();
    } catch (err) {
      submittedRef.current = false;
      setSubmitting(false);
      setSubmitError(
        typeof navigator !== "undefined" && !navigator.onLine
          ? "Интернет байланысы жоқ. Жауаптарыңыз құрылғыда сақталды — байланыс қалпына келгенде қайта басыңыз."
          : err instanceof Error
            ? err.message
            : "Белгісіз қате",
      );
      setFinishOpen(true);
    }
  }, [answersRef, attemptId, isPreview, questions, router]);

  const onExpire = useCallback(() => {
    setTimeUp(true);
  }, []);

  // Уақыт біткенде автоматты түрде аяқтау
  useEffect(() => {
    if (timeUp && !isPreview) void submit();
  }, [timeUp, isPreview, submit]);

  // Пернетақта: ← → арқылы ауысу
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (finishOpen || ["SELECT", "INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.key === "ArrowRight" && index < questions.length - 1) goTo(index + 1);
      if (e.key === "ArrowLeft" && index > 0) goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finishOpen, goTo, index, questions.length]);

  const go = (i: number) => {
    goTo(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!question) {
    return (
      <div className="container-page py-20">
        <Alert tone="error">Бұл нұсқада сұрақтар табылмады.</Alert>
      </div>
    );
  }

  const isLast = index === questions.length - 1;

  return (
    <div className="min-h-dvh bg-slate-50/70 pb-24 lg:pb-10">
      {!isPreview && <SessionGuard />}
      {/* Жоғарғы бөлік: атау + таймер */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link
            href={exitHref}
            className="-ml-2 rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 active:scale-95"
            aria-label={isPreview ? "Редакторға қайту" : "Шығу (жауаптар сақталады)"}
            title={isPreview ? "Редакторға қайту" : "Шығу — жауаптар сақталады, кейін жалғастыруға болады"}
          >
            <X className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-sm font-bold text-navy-900 sm:text-lg">{title}</h1>
            {!isPreview && <SaveIndicator status={status} />}
            {isPreview && (
              <span className="flex min-w-0 items-center gap-1 text-xs font-medium text-amber-700">
                <Eye className="size-3.5 shrink-0" /> <span className="truncate">Preview режимі — жауаптар сақталмайды</span>
              </span>
            )}
          </div>
          {deadline && !isPreview && <Timer deadline={deadline} clockOffset={clockOffset} onExpire={onExpire} />}
          <div className="hidden sm:block">
            <Button size="sm" variant="navy" onClick={() => setFinishOpen(true)} disabled={submitting}>
              <Flag className="size-4" /> Тестті аяқтау
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:pt-8">
        <main className="min-w-0">
          <div className="card p-5 sm:p-8">
            <QuestionView
              question={question}
              answer={answers[question.id]}
              onAnswer={(a) => setAnswer(question.id, a)}
              disabled={submitting || timeUp}
            />
          </div>

          {/* Десктоп: алдыңғы / келесі */}
          <div className="mt-5 hidden items-center justify-between gap-3 lg:flex">
            <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0}>
              <ArrowLeft className="size-4" /> Алдыңғы
            </Button>
            {isLast ? (
              <Button variant="navy" onClick={() => setFinishOpen(true)}>
                <Flag className="size-4" /> Тестті аяқтау
              </Button>
            ) : (
              <Button onClick={() => go(index + 1)}>
                Келесі <ArrowRight className="size-4" />
              </Button>
            )}
          </div>

          {/* Мобильді/планшет: навигация төменде */}
          <div className="card mt-5 p-5 lg:hidden">
            <QuestionNav questions={questions} answers={answers} current={index} onSelect={go} />
            <Button variant="navy" className="mt-5 w-full sm:hidden" onClick={() => setFinishOpen(true)} disabled={submitting}>
              <Flag className="size-4" /> Тестті аяқтау
            </Button>
          </div>
        </main>

        {/* Десктоп: оң жақтағы навигация */}
        <aside className="hidden lg:block">
          <div className="card sticky top-24 p-5">
            <QuestionNav questions={questions} answers={answers} current={index} onSelect={go} />
          </div>
        </aside>
      </div>

      {/* Мобильді төменгі панель */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Button variant="outline" className="flex-1" onClick={() => go(index - 1)} disabled={index === 0}>
            <ArrowLeft className="size-4" /> Алдыңғы
          </Button>
          <span className="w-14 text-center text-sm font-semibold text-slate-600 tabular-nums">
            {index + 1}/{questions.length}
          </span>
          {isLast ? (
            <Button variant="navy" className="flex-1" onClick={() => setFinishOpen(true)}>
              Аяқтау
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => go(index + 1)}>
              Келесі <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <FinishModal
        open={finishOpen || (timeUp && !isPreview)}
        onClose={() => setFinishOpen(false)}
        unanswered={unansweredCount}
        submitting={submitting}
        error={submitError}
        timeUp={timeUp}
        isPreview={isPreview}
        onConfirm={() => void submit()}
        onJumpToUnanswered={() => {
          const i = questions.findIndex((q) => !isAnswered(q, answers[q.id]));
          setFinishOpen(false);
          if (i >= 0) go(i);
        }}
      />
    </div>
  );
}

function SaveIndicator({ status }: { status: SyncStatus }) {
  const map: Record<SyncStatus, { icon: React.ReactNode; text: string; className: string }> = {
    idle: { icon: <Cloud className="size-3.5" />, text: "Жауаптар автоматты сақталады", className: "text-slate-400" },
    pending: { icon: <Cloud className="size-3.5" />, text: "Сақталуда...", className: "text-slate-500" },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: "Сақталуда...", className: "text-slate-500" },
    saved: { icon: <CheckCircle2 className="size-3.5" />, text: "Сақталды", className: "text-emerald-600" },
    offline: { icon: <CloudOff className="size-3.5" />, text: "Офлайн: жауаптар құрылғыда сақталды", className: "text-amber-700" },
    error: { icon: <AlertTriangle className="size-3.5" />, text: "Сақтау қатесі — қайталанады", className: "text-red-600" },
  };
  const s = map[status];
  return (
    <span className={cn("flex min-w-0 items-center gap-1 text-xs font-medium", s.className)} aria-live="polite">
      <span className="shrink-0">{s.icon}</span> <span className="truncate">{s.text}</span>
    </span>
  );
}

function FinishModal({
  open,
  onClose,
  unanswered,
  submitting,
  error,
  timeUp,
  isPreview,
  onConfirm,
  onJumpToUnanswered,
}: {
  open: boolean;
  onClose: () => void;
  unanswered: number;
  submitting: boolean;
  error: string | null;
  timeUp: boolean;
  isPreview: boolean;
  onConfirm: () => void;
  onJumpToUnanswered: () => void;
}) {
  if (isPreview) {
    return (
      <Modal open={open} onClose={onClose} title="Preview режимі" footer={<Button onClick={onClose}>Түсінікті</Button>}>
        <p className="text-slate-600">
          Бұл — оқушы көретін интерфейстің алдын ала көрінісі. Preview режимінде тест аяқталмайды және нәтиже сақталмайды.
          Жауап берілмеген сұрақтар: <b>{unanswered}</b>.
        </p>
      </Modal>
    );
  }

  if (timeUp) {
    return (
      <Modal open={open} onClose={() => {}} locked title="Уақыт аяқталды">
        <div className="flex flex-col items-center py-4 text-center">
          {error ? (
            <>
              <Alert tone="error" className="mb-4 w-full text-left">
                {error}
              </Alert>
              <Button onClick={onConfirm} loading={submitting}>
                Қайта жіберу
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="size-8 animate-spin text-brand-500" />
              <p className="mt-4 text-slate-600">Жауаптарыңыз жіберіліп, нәтиже есептелуде...</p>
            </>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={submitting}
      title="Тестті аяқтау керек пе?"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Тестке қайту
          </Button>
          <Button variant="navy" onClick={onConfirm} loading={submitting}>
            {submitting ? "Тексерілуде..." : "Иә, аяқтау"}
          </Button>
        </>
      }
    >
      {error && (
        <Alert tone="error" className="mb-4">
          {error}
        </Alert>
      )}
      {unanswered > 0 ? (
        <div className="rounded-2xl bg-amber-50 p-4 text-amber-900">
          <p className="font-semibold">
            Жауап берілмеген сұрақтар: <span className="text-2xl">{unanswered}</span>
          </p>
          <button type="button" onClick={onJumpToUnanswered} className="mt-1 text-sm font-medium underline-offset-2 hover:underline" disabled={submitting}>
            Бірінші жауапсыз сұраққа өту →
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 font-medium text-emerald-800">
          <CheckCircle2 className="size-5" /> Барлық 40 сұраққа жауап берілді
        </div>
      )}
      <p className="mt-4 text-sm text-slate-500">Растағаннан кейін жауаптарды өзгертуге болмайды. Нәтиже бірден есептеледі.</p>
    </Modal>
  );
}
