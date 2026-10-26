"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import { setUserRole } from "@/lib/admin/actions";

export function RoleToggle({ userId, name, role }: { userId: string; name: string; role: "student" | "admin" }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const next = role === "admin" ? "student" : "admin";

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} title={role === "admin" ? "Әкімші құқығын алу" : "Әкімші ету"}>
        {role === "admin" ? <ShieldOff className="size-4" /> : <ShieldCheck className="size-4" />}
        <span className="hidden xl:inline">{role === "admin" ? "Құқықты алу" : "Әкімші ету"}</span>
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        loading={pending}
        danger={next === "admin"}
        title={next === "admin" ? "Әкімші құқығын беру керек пе?" : "Әкімші құқығын алу керек пе?"}
        confirmLabel="Растау"
        onConfirm={() =>
          start(async () => {
            const res = await setUserRole(userId, next);
            if (res.error) toast(res.error, "error");
            else {
              toast(res.message ?? "Сақталды");
              setOpen(false);
              router.refresh();
            }
          })
        }
      >
        {next === "admin" ? (
          <>
            <b className="text-navy-900">{name}</b> барлық нұсқаларды, дұрыс жауаптарды және оқушылардың нәтижелерін көріп, өзгерте алады.
          </>
        ) : (
          <>
            <b className="text-navy-900">{name}</b> қарапайым оқушыға айналады.
          </>
        )}
      </ConfirmDialog>
    </>
  );
}
