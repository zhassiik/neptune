"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import { adminRevokeAllSessions, adminSetBlocked } from "@/lib/devices/actions";

export function UserSecurityActions({ userId, name, blocked, isSelf }: { userId: string; name: string; blocked: boolean; isSelf: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<"all" | "block" | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok?: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.error) toast(r.error, "error");
      else {
        toast(r.message ?? "Сақталды");
        setDialog(null);
        router.refresh();
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setDialog("all")}>
        <LogOut className="size-4" /> Барлық сессиясын тоқтату
      </Button>
      {!isSelf &&
        (blocked ? (
          <Button variant="secondary" loading={pending} onClick={() => run(() => adminSetBlocked(userId, false))}>
            <ShieldCheck className="size-4" /> Бұғаттан шығару
          </Button>
        ) : (
          <Button variant="danger" onClick={() => setDialog("block")}>
            <Ban className="size-4" /> Аккаунтты бұғаттау
          </Button>
        ))}

      <ConfirmDialog
        open={dialog === "all"}
        onClose={() => setDialog(null)}
        loading={pending}
        danger
        title="Барлық сессияны тоқтату керек пе?"
        confirmLabel="Иә, тоқтату"
        onConfirm={() => run(() => adminRevokeAllSessions(userId))}
      >
        <b className="text-navy-900">{name}</b> барлық құрылғыдан шығарылады
        {isSelf ? " (осы құрылғыдан басқа)" : ""}. Қайта кіргенде құрылғылар жаңадан тіркеледі.
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === "block"}
        onClose={() => setDialog(null)}
        loading={pending}
        danger
        title="Аккаунтты бұғаттау керек пе?"
        confirmLabel="Иә, бұғаттау"
        onConfirm={() => run(() => adminSetBlocked(userId, true))}
      >
        <b className="text-navy-900">{name}</b> барлық құрылғыдан шығарылады және бұғаттан шығарғанша кіре алмайды. Нәтижелері сақталады.
      </ConfirmDialog>
    </div>
  );
}
