"use client";

import { useActionState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { startAttempt, type StartState } from "@/lib/attempts/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function StartAttemptButton({
  variantId,
  mode,
  className,
  size = "md",
  returnTo,
}: {
  variantId: string;
  mode: "start" | "retake" | "continue";
  className?: string;
  size?: "sm" | "md" | "lg";
  returnTo?: string;
}) {
  const [state, action] = useActionState<StartState, FormData>(startAttempt, {});
  const label = mode === "start" ? "Бастау" : mode === "retake" ? "Қайта тапсыру" : "Жалғастыру";
  const Icon = mode === "retake" ? RotateCcw : Play;

  return (
    <form action={action} className={className}>
      <input type="hidden" name="variantId" value={variantId} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <SubmitButton size={size} className="w-full" variant={mode === "retake" ? "outline" : "primary"} pendingText="Жүктелуде...">
        <Icon className="size-4" /> {label}
      </SubmitButton>
      {state.error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
