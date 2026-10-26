"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import { deleteAttempt } from "@/lib/admin/actions";

export function DeleteAttemptButton({ attemptId, label }: { attemptId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 active:scale-90"
        aria-label="Нәтижені өшіру"
      >
        <Trash2 className="size-4" />
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        loading={pending}
        danger
        title="Нәтижені өшіру керек пе?"
        confirmLabel="Иә, өшіру"
        onConfirm={() =>
          start(async () => {
            const res = await deleteAttempt(attemptId);
            if (res.error) toast(res.error, "error");
            else {
              toast(res.message ?? "Өшірілді");
              setOpen(false);
              router.refresh();
            }
          })
        }
      >
        {label} нәтижесі біржола өшіріледі.
      </ConfirmDialog>
    </>
  );
}
