import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getPlatformSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/PageHeader";
import { PasswordForm, PlatformSettingsForm, ProfileForm } from "@/components/admin/SettingsForms";

export const metadata: Metadata = { title: "Баптаулар" };

export default async function SettingsPage() {
  const [user, settings] = await Promise.all([requireAdmin(), getPlatformSettings()]);
  return (
    <>
      <PageHeader title="Баптаулар" description="Платформа ақпараты және жеке аккаунт" />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-6 sm:p-8">
          <h2 className="mb-1 text-lg font-bold">Платформа</h2>
          <p className="mb-5 text-sm text-slate-500">Атауы мен байланыс ақпараты сайттың header және footer бөлігінде көрсетіледі.</p>
          <PlatformSettingsForm initial={settings} />
        </section>
        <div className="space-y-6">
          <section className="card p-6 sm:p-8">
            <h2 className="mb-5 text-lg font-bold">Профиль</h2>
            <ProfileForm fullName={user.profile?.full_name ?? ""} email={user.email ?? ""} />
          </section>
          <section className="card p-6 sm:p-8">
            <h2 className="mb-5 text-lg font-bold">Құпиясөз</h2>
            <PasswordForm />
          </section>
        </div>
      </div>
    </>
  );
}
