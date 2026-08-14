import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Stat } from "./stat";

/**
 * ADAPTADOR — mantido enquanto as telas migram para `<Card>` + `<Stat>`.
 *
 * `sub` era renderizado em mono/caixa-alta e quebrava linha em telas estreitas
 * ("META 1850" virava duas linhas); agora vai como `hint` do `Stat`, que trunca.
 */
export function StatCard({
  icon,
  value,
  label,
  sub,
  trend,
  className,
  children,
  onClick,
}: {
  variant?: "elevated" | "outlined" | "gradient" | "flush";
  icon?: ReactNode;
  value?: ReactNode;
  label?: ReactNode;
  sub?: ReactNode;
  trend?: { value: number; positive?: "up" | "down" | "neutral" };
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      onClick={onClick}
      className={cn(
        "min-w-0 rounded-xl border border-border bg-card p-3.5",
        onClick && "w-full cursor-pointer text-left transition-colors hover:bg-muted",
        className,
      )}
    >
      {icon && (
        <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-tint-primary text-primary">
          {icon}
        </div>
      )}
      {value !== undefined && (
        <Stat
          value={value}
          label={typeof label === "string" ? label : ""}
          hint={typeof sub === "string" ? sub : undefined}
        />
      )}
      {value === undefined && label && <div className="t-caption">{label}</div>}
      {trend && (
        <div className="mt-2 flex items-center gap-1.5 text-xs tabular-nums">
          <span
            className={cn(
              "size-1.5 rounded-full",
              trend.positive === "up" && "bg-success",
              trend.positive === "down" && "bg-destructive",
              trend.positive === "neutral" && "bg-muted-foreground",
            )}
          />
          {trend.value >= 0 ? "+" : ""}
          {trend.value}%
        </div>
      )}
      {children}
    </Comp>
  );
}
