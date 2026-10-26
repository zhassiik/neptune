import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const styles = {
  error: { box: "border-red-200 bg-red-50 text-red-800", Icon: AlertCircle },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-800", Icon: CheckCircle2 },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", Icon: TriangleAlert },
  info: { box: "border-brand-200 bg-brand-50 text-navy-800", Icon: Info },
};

export function Alert({ tone = "info", children, className }: { tone?: keyof typeof styles; children: ReactNode; className?: string }) {
  const { box, Icon } = styles[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm", box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
