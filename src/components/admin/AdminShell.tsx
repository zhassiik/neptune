"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, FilePlus2, Files, Home, LayoutDashboard, LogOut, Settings, Users } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { ToastProvider } from "./Toast";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/courses", label: "Курстар", icon: BookOpen, exact: false },
  { href: "/admin/variants", label: "Нұсқалар", icon: Files, exact: false, exclude: "/admin/variants/new" },
  { href: "/admin/variants/new", label: "Жаңа нұсқа қосу", icon: FilePlus2, exact: true },
  { href: "/admin/students", label: "Оқушылар", icon: Users, exact: false },
  { href: "/admin/results", label: "Нәтижелер", icon: BarChart3, exact: false },
  { href: "/admin/settings", label: "Баптаулар", icon: Settings, exact: false },
];

export function AdminShell({ children, userName, platformName }: { children: React.ReactNode; userName: string; platformName: string }) {
  const pathname = usePathname();
  const active = (n: (typeof NAV)[number]) =>
    n.exact ? pathname === n.href : pathname.startsWith(n.href) && !(n.exclude && pathname.startsWith(n.exclude));

  return (
    <div className="min-h-dvh bg-slate-50/70 lg:grid lg:grid-cols-[260px_1fr]">
      {/* Десктоп sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-slate-100 bg-white p-5 lg:flex">
        <Logo name={platformName} compact />
        <p className="mt-2 text-xs font-semibold tracking-wide text-brand-600 uppercase">Админ-панель</p>
        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Админ мәзірі">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition active:scale-[0.98]",
                active(n) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <n.icon className="size-5" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-100 pt-4">
          <div className="truncate px-3 text-sm font-semibold text-navy-900">{userName}</div>
          <Link href="/" className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
            <Home className="size-4" /> Сайтқа өту
          </Link>
          <form action={signOut}>
            <SubmitButton variant="ghost" size="sm" className="w-full justify-start px-3 font-medium">
              <LogOut className="size-4" /> Шығу
            </SubmitButton>
          </form>
        </div>
      </aside>

      {/* Мобильді жоғарғы мәзір */}
      <div className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Logo name={platformName} />
          <form action={signOut}>
            <SubmitButton variant="ghost" size="sm" aria-label="Шығу">
              <LogOut className="size-4" />
            </SubmitButton>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Админ мәзірі">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition",
                active(n) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50",
              )}
            >
              <n.icon className="size-4" /> {n.label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <ToastProvider>{children}</ToastProvider>
      </main>
    </div>
  );
}
