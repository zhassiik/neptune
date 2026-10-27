"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, LogOut, Menu, UserRound, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { SessionGuard } from "@/components/devices/SessionGuard";

const links = [
  { href: "/", label: "Басты бет" },
  { href: "/courses", label: "Курстар" },
];

/** Ғарыштық (күңгірт) header — Neptune стилі */
export function HeaderNav({ platformName, user }: { platformName: string; user: { name: string; isAdmin: boolean } | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const navLinks = user ? [...links, { href: "/cabinet", label: "Менің нәтижелерім" }] : links;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-space-950/85 text-white backdrop-blur-xl">
      {user && <SessionGuard />}
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo name={platformName} tone="light" />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Негізгі мәзір">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "relative rounded-xl px-4 py-2 text-[15px] font-medium transition hover:bg-white/10 hover:text-white active:bg-white/15",
                isActive(l.href) ? "text-neptune-300" : "text-white/75",
              )}
            >
              {l.label}
              {isActive(l.href) && <span className="absolute inset-x-4 -bottom-[13px] h-0.5 rounded-full bg-neptune-400 shadow-[0_0_12px_var(--color-neptune-400)]" />}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {user.isAdmin && (
                <Link href="/admin" className="inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white active:scale-[0.97]">
                  <LayoutDashboard className="size-4" /> Админ-панель
                </Link>
              )}
              <Link
                href="/cabinet"
                title="Менің нәтижелерім"
                className="inline-flex h-9 max-w-52 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 text-sm font-semibold text-white transition hover:border-neptune-400/60 hover:bg-white/15 active:scale-[0.97]"
              >
                <UserRound className="size-4 shrink-0 text-neptune-300" />
                <span className="truncate">{user.name}</span>
              </Link>
              <form action={signOut}>
                <SubmitButton variant="ghost" size="sm" aria-label="Шығу" title="Шығу" className="text-white/70 hover:bg-white/10 hover:text-white">
                  <LogOut className="size-4" />
                </SubmitButton>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-xl bg-gradient-to-r from-brand-500 to-neptune-500 px-5 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 active:scale-[0.97]"
            >
              Кіру
            </Link>
          )}
        </div>

        <button
          type="button"
          className="-mr-2 rounded-xl p-2 text-white transition hover:bg-white/10 active:scale-95 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Мәзірді жабу" : "Мәзірді ашу"}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {open && (
        <div className="animate-fade-in border-t border-white/10 bg-space-950 md:hidden">
          <nav className="container-page flex flex-col gap-1 py-3" aria-label="Мобильді мәзір">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn("rounded-xl px-3 py-3 font-medium transition hover:bg-white/10 active:bg-white/15", isActive(l.href) ? "text-neptune-300" : "text-white/85")}
              >
                {l.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-white/10" />
            {user ? (
              <>
                {user.isAdmin && (
                  <Link href="/admin" className="rounded-xl px-3 py-3 font-medium text-white/85 hover:bg-white/10">
                    Админ-панель
                  </Link>
                )}
                <form action={signOut}>
                  <SubmitButton variant="outline" className="mt-2 w-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
                    <LogOut className="size-4" /> Шығу
                  </SubmitButton>
                </form>
              </>
            ) : (
              <Link href="/login" className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-500 to-neptune-500 font-semibold text-white">
                Кіру
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
