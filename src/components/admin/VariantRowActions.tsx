"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, EyeOff, Pencil, Send, Trash2, Zap } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import { deleteVariant, setVariantStatus } from "@/lib/admin/actions";
import type { VariantStatus } from "@/lib/types";

export function VariantRowActions({ id, title, status, compact }: { id: string; title: string; status: VariantStatus; compact?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingStatus, startStatus] = useTransition();
  const [pendingDelete, startDelete] = useTransition();
  const [problems, setProblems] = useState<{ position: number; issue: string }[] | null>(null);

  const toggleStatus = () =>
    startStatus(async () => {
      const res = await setVariantStatus(id, status === "published" ? "draft" : "published");
      if (res.error) {
        toast(res.error, "error");
        if (res.problems) setProblems(res.problems);
      } else {
        toast(res.message ?? "Сақталды");
        router.refresh();
      }
    });

  const remove = () =>
    startDelete(async () => {
      const res = await deleteVariant(id);
      if (res.error) toast(res.error, "error");
      else {
        toast(res.message ?? "Өшірілді");
        setConfirmDelete(false);
        router.push("/admin/variants");
        router.refresh();
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!compact && (
        <>
          <Link href={`/admin/variants/${id}/quick`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <Zap className="size-4" /> Скрин + жауаптар
          </Link>
          <Link href={`/admin/variants/${id}`} className={buttonClasses({ variant: "outline", size: "sm" })}>
            <Pencil className="size-4" /> Өзгерту
          </Link>
        </>
      )}
      <Link href={`/preview/${id}`} className={buttonClasses({ variant: "ghost", size: "sm" })} title="Preview">
        <Eye className="size-4" /> Preview
      </Link>
      <Button size="sm" variant={status === "published" ? "secondary" : "primary"} onClick={toggleStatus} loading={pendingStatus}>
        {status === "published" ? (
          <>
            <EyeOff className="size-4" /> Жобаға қайтару
          </>
        ) : (
          <>
            <Send className="size-4" /> Жариялау
          </>
        )}
      </Button>
      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmDelete(true)} aria-label="Өшіру">
        <Trash2 className="size-4" />
        {!compact && <span className="sr-only sm:not-sr-only">Өшіру</span>}
      </Button>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={pendingDelete}
        danger
        title="Нұсқаны өшіру керек пе?"
        confirmLabel="Иә, өшіру"
      >
        <p>
          <b className="text-navy-900">«{title}»</b> нұсқасы, оның барлық сұрақтары, суреттері және оқушылардың осы нұсқа бойынша
          нәтижелері біржола өшіріледі. Бұл әрекетті қайтару мүмкін емес.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!problems}
        onClose={() => setProblems(null)}
        onConfirm={() => router.push(`/admin/variants/${id}/quick`)}
        title="Нұсқа толық емес"
        confirmLabel="Редакторға өту"
      >
        <p className="mb-3">Жариялау үшін барлық 40 сұрақ толық болуы керек. Мәселелер:</p>
        <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
          {problems?.map((p) => (
            <li key={p.position}>
              <b className="text-navy-900">{p.position}-сұрақ:</b> {p.issue}
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </div>
  );
}
