import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getPlatformSettings } from "@/lib/settings";
import { AdminShell } from "@/components/admin/AdminShell";
import { Alert } from "@/components/ui/Alert";
import { serviceKeyProblem } from "@/lib/env";

export const metadata: Metadata = { title: { default: "Админ-панель", template: "%s · Админ-панель" } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const settings = await getPlatformSettings();
  const keyProblem = serviceKeyProblem(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return (
    <AdminShell userName={user.profile?.full_name || user.email || "Әкімші"} platformName={settings.platform_name}>
      {keyProblem && (
        <Alert tone="error" className="mb-6">
          <b>Сервер баптауы толық емес — оқушылар тест бастай алмайды.</b>
          <p className="mt-0.5">{keyProblem}</p>
        </Alert>
      )}
      {children}
    </AdminShell>
  );
}
