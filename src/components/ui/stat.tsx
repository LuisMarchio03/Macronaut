import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Leitura de um número: valor grande, unidade colada, rótulo abaixo.
 *
 * A unidade fica separada de `value` (em vez de embutida na string) para que o
 * número mantenha `tabular-nums` e alinhe em coluna com os vizinhos, e para que
 * a unidade possa ser tipograficamente menor sem virar parte do número.
 */
export function Stat({
  value,
  unit,
  label,
  hint,
  tone,
  size = "md",
  className,
}: {
  value: ReactNode;
  unit?: string;
  label: string;
  hint?: string;
  tone?: "prot" | "carb" | "gord" | "primary";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const valueSize = { sm: "text-lg", md: "text-2xl", lg: "t-display" }[size];
  const toneColor = tone
    ? { prot: "text-macro-prot", carb: "text-macro-carb", gord: "text-macro-gord", primary: "text-primary" }[tone]
    : undefined;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "font-bold leading-none tracking-tight tabular-nums",
            valueSize,
            toneColor,
          )}
        >
          {value}
        </span>
        {unit && <span className="t-caption shrink-0 font-medium">{unit}</span>}
      </div>
      <div className="t-caption mt-1 truncate">{label}</div>
      {hint && <div className="t-caption mt-0.5 truncate opacity-80 tabular-nums">{hint}</div>}
    </div>
  );
}
