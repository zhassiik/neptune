"use client";

import { Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function format(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Кері санақ. Сервер уақытымен синхрондалады (clockOffset). */
export function Timer({ deadline, clockOffset, onExpire }: { deadline: string; clockOffset: number; onExpire: () => void }) {
  const deadlineMs = new Date(deadline).getTime();
  const [remaining, setRemaining] = useState(() => deadlineMs - (Date.now() + clockOffset));
  const firedRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const left = deadlineMs - (Date.now() + clockOffset);
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineMs, clockOffset, onExpire]);

  const critical = remaining < 5 * 60_000;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-sm font-bold tabular-nums transition sm:text-base",
        critical ? "animate-pulse bg-red-50 text-red-700" : "bg-brand-50 text-brand-700",
      )}
      role="timer"
      aria-live={critical ? "polite" : "off"}
      title="Қалған уақыт"
    >
      <Clock className="size-4" /> {format(remaining)}
    </span>
  );
}
