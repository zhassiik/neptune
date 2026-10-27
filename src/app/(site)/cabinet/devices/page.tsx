import type { Metadata } from "next";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { currentDeviceId, getDeviceLimit } from "@/lib/devices/server";
import { DEVICE_COLUMNS, toDeviceRow, type DeviceDbRow } from "@/lib/devices/rows";
import { revokeMyDevice, revokeOtherDevices } from "@/lib/devices/actions";
import { DeviceList } from "@/components/devices/DeviceList";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Менің құрылғыларым" };
export const dynamic = "force-dynamic";

export default async function MyDevicesPage() {
  const user = await requireUser("/cabinet/devices");
  const supabase = await createClient();
  // RLS: тек өз құрылғылары және тек рұқсат етілген сессиядан
  const [{ data, error }, deviceId, { limit }] = await Promise.all([
    supabase.from("user_devices").select(DEVICE_COLUMNS).eq("user_id", user.id).order("is_active", { ascending: false }).order("last_seen_at", { ascending: false }).limit(30).returns<DeviceDbRow[]>(),
    currentDeviceId(),
    getDeviceLimit(),
  ]);
  if (error) throw new Error("Құрылғыларды жүктеу мүмкін болмады");

  const rows = (data ?? []).map((r) => toDeviceRow(r, deviceId)).sort((a, b) => Number(b.is_current) - Number(a.is_current));
  const activeCount = rows.filter((r) => r.is_active).length;
  const isAdmin = user.profile?.role === "admin";

  return (
    <div className="bg-slate-50/60">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <ButtonLink href="/cabinet" variant="ghost" size="sm" className="-ml-3">
          <ArrowLeft className="size-4" /> Менің нәтижелерім
        </ButtonLink>
        <h1 className="mt-3 flex items-center gap-2 text-3xl font-extrabold">
          <ShieldCheck className="size-8 text-brand-500" /> Менің құрылғыларым
        </h1>
        <p className="mt-2 text-slate-500">
          Аккаунтқа бір мезгілде ең көбі <b className="text-navy-900">{limit}</b> құрылғыдан кіруге болады.
          {!isAdmin && (
            <>
              {" "}
              Қазір белсенді: <b className="text-navy-900">{activeCount}/{limit}</b>.
            </>
          )}
        </p>
        {!isAdmin && activeCount >= limit && (
          <Alert tone="warning" className="mt-4">
            Құрылғылар лимиті толды. Жаңа құрылғыдан кіру үшін ескі құрылғылардың бірін шығарыңыз.
          </Alert>
        )}
        <div className="mt-6">
          <DeviceList devices={rows} onRevoke={revokeMyDevice} onRevokeOthers={revokeOtherDevices} showRevoked />
        </div>
        <p className="mt-6 text-xs text-slate-400">
          Инкогнито режимі, басқа браузер немесе cookie тазаланғаннан кейінгі кіру жаңа құрылғы ретінде есептеледі. IP адрестің соңғы бөлігі қауіпсіздік үшін жасырылған.
        </p>
      </div>
    </div>
  );
}
