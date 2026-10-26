"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnswersMap, ClientAnswer } from "@/lib/types";
import { toPayload } from "./answers";

export type SyncStatus = "idle" | "saving" | "saved" | "pending" | "offline" | "error";

interface StoredState {
  v: 1;
  answers: AnswersMap;
  dirty: string[];
  current: number;
}

const storageKey = (attemptId: string) => `ubt:attempt:${attemptId}`;

function readStorage(key: string): StoredState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredState;
    return parsed?.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, state: StoredState) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Storage толы немесе жабық (private mode) — серверге сақтау жалғаса береді
  }
}

export function clearAttemptStorage(attemptId: string) {
  try {
    localStorage.removeItem(storageKey(attemptId));
  } catch {}
}

interface Options {
  attemptId: string;
  initialAnswers: AnswersMap;
  /** preview режимінде серверге жіберілмейді */
  enabled: boolean;
  onConflict: (code: "submitted" | "deadline") => void;
}

/**
 * Жауаптарды басқару:
 * - әр өзгеріс бірден localStorage-қа жазылады (бет жаңарса да, интернет өшсе де сақталады);
 * - серверге debounce арқылы жіберіледі; сәтсіз болса — кейін қайталанады.
 */
export function useAttemptSync({ attemptId, initialAnswers, enabled, onConflict }: Options) {
  const key = storageKey(attemptId);
  const [answers, setAnswers] = useState<AnswersMap>(initialAnswers);
  const [current, setCurrent] = useState(0);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [restored, setRestored] = useState(false);

  const answersRef = useRef(answers);
  const dirtyRef = useRef(new Set<string>());
  const inflightRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRef = useRef(0);
  const onConflictRef = useRef(onConflict);
  useEffect(() => {
    onConflictRef.current = onConflict;
  }, [onConflict]);

  const persist = useCallback(() => {
    if (!enabled) return;
    writeStorage(key, { v: 1, answers: answersRef.current, dirty: [...dirtyRef.current], current: currentRef.current });
  }, [enabled, key]);

  const flush = useCallback(async () => {
    if (!enabled || inflightRef.current || dirtyRef.current.size === 0) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }
    const ids = [...dirtyRef.current];
    const snapshot = new Map(ids.map((id) => [id, answersRef.current[id]]));
    inflightRef.current = true;
    setStatus("saving");
    try {
      const res = await fetch(`/api/attempts/${attemptId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: ids.map((id) => toPayload(id, snapshot.get(id))) }),
        keepalive: true,
      });
      if (res.ok) {
        // Жіберу кезінде қайта өзгерген жауаптар dirty болып қалады
        for (const id of ids) if (answersRef.current[id] === snapshot.get(id)) dirtyRef.current.delete(id);
        persist();
        setStatus(dirtyRef.current.size ? "pending" : "saved");
      } else if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        onConflictRef.current(body.code === "deadline" ? "deadline" : "submitted");
        setStatus("error");
      } else if (res.status === 401) {
        setStatus("error");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("offline");
    } finally {
      inflightRef.current = false;
      if (dirtyRef.current.size > 0 && navigator.onLine) {
        timerRef.current = setTimeout(() => void flush(), 3000);
      }
    }
  }, [attemptId, enabled, persist]);

  const schedule = useCallback(
    (delay = 700) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), delay);
    },
    [flush],
  );

  // Бет ашылғанда: localStorage-тағы жіберілмеген жауаптарды қалпына келтіру
  useEffect(() => {
    if (!enabled) {
      setRestored(true);
      return;
    }
    const stored = readStorage(key);
    if (stored) {
      const merged = { ...initialAnswers };
      for (const id of stored.dirty) {
        if (stored.answers[id]) merged[id] = stored.answers[id];
      }
      stored.dirty.forEach((id) => dirtyRef.current.add(id));
      answersRef.current = merged;
      currentRef.current = stored.current ?? 0;
      setAnswers(merged);
      setCurrent(stored.current ?? 0);
      if (dirtyRef.current.size > 0) {
        setStatus("pending");
        schedule(300);
      }
    }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  // Интернет қайта қосылғанда және мерзімді қайталау
  useEffect(() => {
    if (!enabled) return;
    const onOnline = () => void flush();
    const onOffline = () => dirtyRef.current.size && setStatus("offline");
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onHide);
    const interval = setInterval(() => {
      if (dirtyRef.current.size > 0) void flush();
    }, 15_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onHide);
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, flush]);

  const setAnswer = useCallback(
    (questionId: string, answer: ClientAnswer) => {
      const next = { ...answersRef.current, [questionId]: answer };
      answersRef.current = next;
      setAnswers(next);
      if (!enabled) return;
      dirtyRef.current.add(questionId);
      persist();
      setStatus("pending");
      schedule();
    },
    [enabled, persist, schedule],
  );

  const goTo = useCallback(
    (index: number) => {
      currentRef.current = index;
      setCurrent(index);
      persist();
    },
    [persist],
  );

  return {
    answers,
    answersRef,
    current,
    goTo,
    setAnswer,
    status,
    restored,
    hasPending: () => dirtyRef.current.size > 0,
    flush,
  };
}
