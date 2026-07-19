import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type CardVariant = "elevated" | "outlined" | "gradient"

const variantStyles: Record<CardVariant, string> = {
  elevated: "card-elevated",
  outlined: "card-outlined",
  gradient: "card-gradient",
}

export function SectionCard({
  variant = "elevated",
  header,
  aside,
  className,
  bodyClassName,
  children,
}: {
  variant?: CardVariant
  header?: ReactNode
  aside?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}) {
  return (
    <section className={cn(variantStyles[variant], "overflow-hidden", className)}>
      {(header || aside) && (
        <div className="section-header border-b border-border/50 px-4 py-2.5">
          {header && <span className="section-title">{header}</span>}
          {aside && (
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-primary/80 tabular-nums">
              {aside}
            </span>
          )}
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  )
}