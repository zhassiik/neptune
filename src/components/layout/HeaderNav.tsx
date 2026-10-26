"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, LogOut, Menu, UserRound, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Басты бет" },
  { href: "/courses", label: "Курстар" },
];

export function HeaderNav({ platformName, user }: { platformName: string; user: { name: string; isAdmin: boolean } | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const navLinks = user ? [...links, { href: "/cabinet", label: "Менің нәтижелерім" }] : links;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo name={platformName} />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Негізгі мәзір">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-xl px-4 py-2 text-[15px] font-medium transition hover:bg-brand-50 hover:text-brand-700 active:bg-brand-100",
                isActive(l.href) ? "text-brand-600" : "text-slate-600",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {user.isAdmin && (
                <ButtonLink href="/admin" variant="ghost" size="sm">
                  <LayoutDashboard className="size-4" /> Админ-панель
                </ButtonLink>
              )}
              <ButtonLink href="/cabinet" variant="secondary" size="sm" className="max-w-52" title="Менің нәтижелерім">
                <UserRound className="size-4 shrink-0" />
                <span className="truncate">{user.name}</span>
              </ButtonLink>
              <form action={signOut}>
                <SubmitButton variant="ghost" size="sm" aria-label="Шығу" title="Шығу">
                  <LogOut className="size-4" />
                </SubmitButton>
              </form>
            </>
          ) : (
            <ButtonLink href="/login" size="sm" className="px-5">
              Кіру
            </ButtonLink>
          )}
        </div>

        <button
          type="button"
          className="-mr-2 rounded-xl p-2 text-slate-700 transition hover:bg-slate-100 active:scale-95 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Мәзірді жабу" : "Мәзірді ашу"}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {open && (
        <div className="animate-fade-in border-t border-slate-100 bg-white md:hidden">
          <nav className="container-page flex flex-col gap-1 py-3" aria-label="Мобильді мәзір">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-xl px-3 py-3 font-medium transition hover:bg-brand-50 active:bg-brand-100",
                  isActive(l.href) ? "text-brand-600" : "text-slate-700",
                )}
              >
                {l.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-slate-100" />
            {user ? (
              <>
                {user.isAdmin && (
                  <Link href="/admin" className="rounded-xl px-3 py-3 font-medium text-slate-700 hover:bg-brand-50">
                    Админ-панель
                  </Link>
                )}
                <form action={signOut}>
                  <SubmitButton variant="outline" className="mt-2 w-full">
                    <LogOut className="size-4" /> Шығу
                  </SubmitButton>
                </form>
              </>
            ) : (
              <ButtonLink href="/login" className="mt-1 w-full">
                Кіру
              </ButtonLink>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
