import { Skeleton } from "@/components/ui/States";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Жүктелуде">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-5 w-80 max-w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-80 rounded-3xl" />
    </div>
  );
}
