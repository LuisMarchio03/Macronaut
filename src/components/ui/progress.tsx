import { cn } from "@/lib/utils";

export type ProgressTone = "primary" | "prot" | "carb" | "gord" | "success" | "warning" | "danger";

const toneFill: Record<ProgressTone, string> = {
  primary: "bg-primary",
  prot: "bg-macro-prot",
  carb: "bg-macro-carb",
  gord: "bg-macro-gord",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

const sizeHeight = { sm: "h-1.5", md: "h-2", lg: "h-3" } as const;

/**
 * Barra de progresso.
 *
 * O preenchimento é limitado a 100% para não vazar do trilho, mas `value` além
 * de `max` é sinalizado por cor (`overflowTone`) em vez de silenciosamente
 * parecer "meta cumprida" — estourar a meta de gordura não é a mesma coisa que
 * atingi-la.
 */
export function Progress({
  value,
  max,
  tone = "primary",
  overflowTone,
  size = "md",
  className,
  label,
}: {
  value: number;
  max: number;
  tone?: ProgressTone;
  overflowTone?: ProgressTone;
  size?: keyof typeof sizeHeight;
  className?: string;
  label?: string;
}) {
  const safeMax = max > 0 ? max : 0;
  const pct = safeMax > 0 ? (value / safeMax) * 100 : 0;
  const estourou = safeMax > 0 && value > safeMax;
  const fillTone = estourou && overflowTone ? overflowTone : tone;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(safeMax)}
      aria-label={label}
      className={cn("track w-full", sizeHeight[size], className)}
    >
      <div
        className={cn("fill", toneFill[fillTone])}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}
