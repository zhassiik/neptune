"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import { deleteTestimonial } from "@/lib/admin/actions";

export function DeleteTestimonialButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 active:scale-90" aria-label="Пікірді өшіру">
        <Trash2 className="size-4" />
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        loading={pending}
        danger
        title="Пікірді өшіру керек пе?"
        confirmLabel="Иә, өшіру"
        onConfirm={() =>
          start(async () => {
            const r = await deleteTestimonial(id);
            if (r.error) toast(r.error, "error");
            else {
              toast(r.message ?? "Өшірілді");
              setOpen(false);
              router.refresh();
            }
          })
        }
      >
        <b className="text-navy-900">{name}</b> пікірі мен фотосы біржола өшіріледі.
      </ConfirmDialog>
    </>
  );
}
