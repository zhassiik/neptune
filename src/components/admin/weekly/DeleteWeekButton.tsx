"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { deleteWeek } from "@/lib/admin/weekly-actions";

export function DeleteWeekButton({ weekId, title }: { weekId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" /> Аптаны өшіру
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        loading={pending}
        danger
        title="Аптаны өшіру керек пе?"
        confirmLabel="Иә, өшіру"
        onConfirm={() =>
          start(async () => {
            const r = await deleteWeek(weekId);
            if (r.error) toast(r.error, "error");
            else {
              toast(r.message ?? "Өшірілді");
              router.push("/admin/weekly");
              router.refresh();
            }
          })
        }
      >
        <b className="text-navy-900">«{title}»</b> рейтингі өшіріледі. Нұсқалар мен оқушылардың нәтижелері сақталады, тек аптадан шығарылады.
      </ConfirmDialog>
    </>
  );
}
