import { Skeleton } from "@/components/ui/States";

export default function Loading() {
  return (
    <div className="container-page py-12" aria-busy="true" aria-label="Жүктелуде">
      <Skeleton className="h-56 rounded-3xl" />
      <div className="mt-8 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-18 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
