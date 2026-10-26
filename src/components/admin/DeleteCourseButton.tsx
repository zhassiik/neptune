"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import { deleteCourse } from "@/lib/admin/actions";

export function DeleteCourseButton({ courseId, title }: { courseId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" /> Курсты өшіру
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        loading={pending}
        danger
        title="Курсты өшіру керек пе?"
        confirmLabel="Иә, өшіру"
        onConfirm={() =>
          start(async () => {
            const res = await deleteCourse(courseId);
            if (res.error) {
              toast(res.error, "error");
              setOpen(false);
            } else {
              toast(res.message ?? "Өшірілді");
              router.push("/admin/courses");
              router.refresh();
            }
          })
        }
      >
        <b className="text-navy-900">«{title}»</b> курсы өшіріледі. Курста нұсқалар болса, алдымен оларды өшіру керек.
      </ConfirmDialog>
    </>
  );
}
