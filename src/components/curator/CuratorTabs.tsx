"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/curator", label: "Нәтижелер", icon: BarChart3, exact: true },
  { href: "/curator/homework", label: "Черновик / Конспект", icon: NotebookPen, exact: false },
];

export function CuratorTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1.5 overflow-x-auto" aria-label="Куратор бөлімдері">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
              active ? "bg-navy-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
            )}
          >
            <t.icon className="size-4" /> {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
