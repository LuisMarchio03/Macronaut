import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type CardVariant = "elevated" | "outlined" | "gradient" | "flush"

const variantStyles: Record<CardVariant, string> = {
  elevated: "card-elevated",
  outlined: "card-outlined",
  gradient: "card-gradient",
  flush: "card-flush",
}

export function StatCard({
  variant = "elevated",
  icon,
  value,
  label,
  sub,
  trend,
  className,
  children,
  onClick,
}: {
  variant?: CardVariant
  icon?: ReactNode
  value?: ReactNode
  label?: ReactNode
  sub?: ReactNode
  trend?: { value: number; positive?: "up" | "down" | "neutral" }
  className?: string
  children?: ReactNode
  onClick?: () => void
}) {
  const Comp = onClick ? "button" : "div"

  return (
    <Comp
      onClick={onClick}
      className={cn(
        variantStyles[variant],
        "p-4",
        onClick && "w-full cursor-pointer text-left transition-all active:scale-[0.98]",
        className,
      )}
    >
      {icon && (
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
      )}
      {value !== undefined && (
        <div className="metric-value text-3xl">{value}</div>
      )}
      {label && (
        <div className="metric-label mt-0.5">{label}</div>
      )}
      {sub && (
        <div className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
          {sub}
        </div>
      )}
      {trend && (
        <div className="mt-2 flex items-center gap-1 font-mono text-xs tabular-nums">
          <span
            className={cn(
              "size-1.5 rounded-full",
              trend.positive === "up" && "bg-emerald-500",
              trend.positive === "down" && "bg-destructive",
              trend.positive === "neutral" && "bg-muted-foreground",
            )}
          />
          {trend.value >= 0 ? "+" : ""}{trend.value}%
        </div>
      )}
      {children}
    </Comp>
  )
}