import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { currentDeviceId, getDeviceLimit } from "@/lib/devices/server";
import { DEVICE_COLUMNS, toDeviceRow, type DeviceDbRow } from "@/lib/devices/rows";
import { adminRevokeDevice } from "@/lib/devices/actions";
import { DeviceList } from "@/components/devices/DeviceList";
import { UserSecurityActions } from "@/components/admin/UserSecurityActions";
import { PageHeader } from "@/components/admin/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Оқушының құрылғылары" };

export default async function StudentDevicesPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) notFound();
  const admin = await requireAdmin();
  const supabase = await createClient();

  const [{ data: profile }, { data: devices, error }, myDevice, { limit }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, created_at, blocked_at").eq("id", userId).maybeSingle(),
    supabase.from("user_devices").select(DEVICE_COLUMNS).eq("user_id", userId).order("is_active", { ascending: false }).order("last_seen_at", { ascending: false }).limit(50).returns<DeviceDbRow[]>(),
    currentDeviceId(),
    getDeviceLimit(),
  ]);
  if (!profile) notFound();
  if (error) throw new Error("Құрылғыларды жүктеу мүмкін болмады");

  const isSelf = userId === admin.id;
  const rows = (devices ?? []).map((d) => toDeviceRow(d, isSelf ? myDevice : null));
  const active = rows.filter((r) => r.is_active).length;
  const revokeOne = adminRevokeDevice.bind(null, userId);

  return (
    <>
      <ButtonLink href="/admin/students" variant="ghost" size="sm" className="-ml-3 mb-2">
        <ArrowLeft className="size-4" /> Оқушылар
      </ButtonLink>
      <PageHeader
        title={profile.full_name || profile.email || "Оқушы"}
        description={
          <>
            {profile.email} · Тіркелген: {formatDateTime(profile.created_at)} · Белсенді құрылғы:{" "}
            <b className="text-navy-900">
              {active}
              {profile.role === "admin" ? " (әкімші — лимитсіз)" : `/${limit}`}
            </b>
          </>
        }
        actions={<UserSecurityActions userId={userId} name={profile.full_name || profile.email || ""} blocked={!!profile.blocked_at} isSelf={isSelf} />}
      />
      {profile.blocked_at && (
        <Alert tone="error" className="mb-5">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Ban className="size-4" /> Аккаунт бұғатталған
          </span>{" "}
          ({formatDateTime(profile.blocked_at)}). Оқушы кіре алмайды.
        </Alert>
      )}
      {profile.role === "admin" && <Badge tone="navy" className="mb-4">Әкімші</Badge>}
      <div className="max-w-3xl">
        <DeviceList devices={rows} onRevoke={revokeOne} showRevoked />
      </div>
    </>
  );
}
