import { cn } from "@/lib/utils"

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />
}

export function SkeletonCard({ bodyClassName }: { bodyClassName?: string }) {
  return (
    <div className="card-elevated overflow-hidden">
      <div className="border-b border-border/50 px-4 py-2.5">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className={cn("space-y-3 p-4", bodyClassName)}>
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  )
}

export function SkeletonMeal() {
  return (
    <div className="card-elevated overflow-hidden">
      <div className="border-b border-border/50 px-4 py-2.5">
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}

export function SkeletonLineChart() {
  return (
    <div className="card-elevated overflow-hidden">
      <div className="p-4">
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    </div>
  )
}