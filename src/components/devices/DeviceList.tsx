"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LogOut, Monitor, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import type { DeviceActionResult } from "@/lib/devices/actions";
import { formatDateTime, timeAgo } from "@/lib/utils";

export interface DeviceRow {
  id: string;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  location: string | null;
  masked_ip: string;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
  revoked_at: string | null;
  revoked_reason: string | null;
  is_current: boolean;
}

const REASONS: Record<string, string> = {
  user: "Пайдаланушы шығарды",
  others: "«Басқа құрылғылардан шығу»",
  signout: "Шығу",
  admin: "Әкімші өшірді",
  admin_all: "Әкімші барлық сессияны тоқтатты",
  blocked: "Аккаунт бұғатталды",
};

function DeviceIcon({ name }: { name: string | null }) {
  const n = name ?? "";
  if (/iPad|планшет/i.test(n)) return <Tablet className="size-5" />;
  if (/iPhone|телефон/i.test(n)) return <Smartphone className="size-5" />;
  return <Monitor className="size-5" />;
}

/**
 * Құрылғылар тізімі (оқушыға және әкімшіге ортақ).
 * Барлық мәтін React арқылы мәтін ретінде шығады — User-Agent-тегі HTML орындалмайды.
 */
export function DeviceList({
  devices,
  onRevoke,
  onRevokeOthers,
  othersLabel = "Басқа барлық құрылғылардан шығу",
  showRevoked = false,
}: {
  devices: DeviceRow[];
  onRevoke: (id: string) => Promise<DeviceActionResult>;
  onRevokeOthers?: () => Promise<DeviceActionResult>;
  othersLabel?: string;
  showRevoked?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<{ kind: "one"; row: DeviceRow } | { kind: "others" } | null>(null);
  const [result, setResult] = useState<DeviceActionResult | null>(null);

  const active = devices.filter((d) => d.is_active);
  const revoked = devices.filter((d) => !d.is_active);
  const others = active.filter((d) => !d.is_current);

  const run = (fn: () => Promise<DeviceActionResult>) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      setConfirm(null);
      if (r.ok) router.refresh();
    });

  return (
    <div>
      {result?.error && <Alert tone="error" className="mb-4">{result.error}</Alert>}
      {result?.message && <Alert tone="success" className="mb-4">{result.message}</Alert>}

      <ul className="space-y-3">
        {active.map((d) => (
          <li key={d.id} className={`card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5 ${d.is_current ? "ring-2 ring-brand-300" : ""}`}>
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <DeviceIcon name={d.device_name} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-navy-900">{d.device_name || "Белгісіз құрылғы"}</span>
                {d.is_current && <Badge tone="green">Осы құрылғы</Badge>}
              </div>
              <div className="mt-0.5 text-sm text-slate-500">
                {d.browser || "Белгісіз браузер"} · {d.os || "Белгісіз ОЖ"}
                {d.location && <> · {d.location}</>} · IP {d.masked_ip}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                Алғаш кірген: {formatDateTime(d.first_seen_at)} · Соңғы белсенділік: {d.is_current ? "қазір" : timeAgo(d.last_seen_at)}
              </div>
            </div>
            {!d.is_current && (
              <Button size="sm" variant="outline" className="text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirm({ kind: "one", row: d })}>
                <LogOut className="size-4" /> Құрылғыдан шығару
              </Button>
            )}
          </li>
        ))}
        {active.length === 0 && <li className="card p-5 text-sm text-slate-500">Белсенді құрылғы жоқ.</li>}
      </ul>

      {onRevokeOthers && others.length > 0 && (
        <Button variant="outline" className="mt-5" onClick={() => setConfirm({ kind: "others" })}>
          <LogOut className="size-4" /> {othersLabel}
        </Button>
      )}

      {showRevoked && revoked.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-semibold text-slate-500 hover:text-slate-800">Бұрынғы құрылғылар ({revoked.length})</summary>
          <ul className="mt-3 space-y-2">
            {revoked.map((d) => (
              <li key={d.id} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                <b className="text-slate-700">{d.device_name || "Белгісіз құрылғы"}</b> · {d.browser} · IP {d.masked_ip} · шығарылды {formatDateTime(d.revoked_at)}
                {d.revoked_reason && <> ({REASONS[d.revoked_reason] ?? d.revoked_reason})</>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        locked={pending}
        size="sm"
        title={confirm?.kind === "others" ? othersLabel + "?" : "Құрылғыдан шығару керек пе?"}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={pending}>
              Болдырмау
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => confirm && run(() => (confirm.kind === "one" ? onRevoke(confirm.row.id) : onRevokeOthers!()))}
            >
              Иә, шығару
            </Button>
          </>
        }
      >
        <p className="text-slate-600">
          {confirm?.kind === "one" ? (
            <>
              <b className="text-navy-900">{confirm.row.device_name}</b> ({confirm.row.browser}) аккаунттан шығарылады. Ол құрылғыда ашық тұрған бет 1–2 минут ішінде жабылады.
            </>
          ) : (
            <>Осы құрылғыдан басқа барлық құрылғыда аккаунттан шығу орындалады.</>
          )}
        </p>
      </Modal>
    </div>
  );
}
