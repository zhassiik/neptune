import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="relative overflow-hidden py-12 sm:py-20">
      <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-80 max-w-3xl rounded-full bg-brand-100/60 blur-3xl" />
      <div className="container-page">
        <div className="card mx-auto w-full max-w-md animate-fade-in p-6 sm:p-9">
          <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
          <p className="mt-2 text-slate-500">{subtitle}</p>
          <div className="mt-7">{children}</div>
          <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">{footer}</div>
        </div>
      </div>
    </div>
  );
}
