import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getPlatformSettings } from "@/lib/settings";
import { getDeviceLimit } from "@/lib/devices/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { PasswordForm, PlatformSettingsForm, ProfileForm } from "@/components/admin/SettingsForms";
import { LandingSettingsForm } from "@/components/admin/LandingSettingsForm";

export const metadata: Metadata = { title: "Баптаулар" };

export default async function SettingsPage() {
  const [user, settings, deviceLimit] = await Promise.all([requireAdmin(), getPlatformSettings(), getDeviceLimit()]);
  return (
    <>
      <PageHeader title="Баптаулар" description="Платформа ақпараты және жеке аккаунт" />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-6 sm:p-8 xl:col-span-2">
          <h2 className="mb-1 text-lg font-bold">Басты бет (лендинг)</h2>
          <p className="mb-5 text-sm text-slate-500">Апай туралы блок, көрсеткіштер, ҰБТ кері санағы және әлеуметтік желілер.</p>
          <LandingSettingsForm initial={settings} />
        </section>
        <section className="card p-6 sm:p-8">
          <h2 className="mb-1 text-lg font-bold">Платформа</h2>
          <p className="mb-5 text-sm text-slate-500">Атауы, мекенжай мен телефон сайттың header және footer бөлігінде көрсетіледі.</p>
          <PlatformSettingsForm initial={settings} deviceLimit={deviceLimit} />
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
