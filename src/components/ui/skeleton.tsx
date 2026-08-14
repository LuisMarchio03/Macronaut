import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

/**
 * Os esqueletos imitam a forma do conteúdo que vai chegar. Um bloco genérico
 * faz a página saltar quando o dado carrega; um com a mesma altura, não.
 */
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-28" />
      <Skeleton className="mt-3 h-2 w-full" />
    </div>
  );
}

export function SkeletonMeal() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-12" />
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="mt-2 h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonLineChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}
