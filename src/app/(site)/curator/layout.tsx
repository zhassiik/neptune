import { requireCuratorPage } from "@/lib/auth";
import { ToastProvider } from "@/components/admin/Toast";
import { CuratorTabs } from "@/components/curator/CuratorTabs";

export const dynamic = "force-dynamic";

/** Куратор бөлімі: куратор немесе әкімші. Қай курстардың деректері көрінетінін RLS шектейді */
export default async function CuratorLayout({ children }: { children: React.ReactNode }) {
  await requireCuratorPage();
  return (
    <div className="bg-slate-50/60">
      <div className="container-page py-8 sm:py-12">
        <CuratorTabs />
        <div className="mt-6">
          <ToastProvider>{children}</ToastProvider>
        </div>
      </div>
    </div>
  );
}
