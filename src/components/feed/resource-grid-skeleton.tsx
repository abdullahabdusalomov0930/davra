import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder cards with the same shape as ResourceCard, shown while a list loads. */
export function ResourceGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul aria-hidden className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="grid gap-3 rounded-[1.125rem] border-2 border-foreground/25 bg-card p-5">
          <div className="flex gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}
