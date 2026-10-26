import { Skeleton } from "@/components/ui/States";

export default function Loading() {
  return (
    <div className="min-h-dvh bg-slate-50/70" aria-busy="true" aria-label="Тест жүктелуде">
      <div className="h-16 border-b border-slate-100 bg-white" />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-8 sm:px-6 lg:grid-cols-[1fr_300px]">
        <div className="card space-y-4 p-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-64 w-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
        <Skeleton className="hidden h-96 rounded-3xl lg:block" />
      </div>
    </div>
  );
}
