import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CardTone = "default" | "primary" | "success" | "warning" | "danger";

const toneSurface: Record<CardTone, string> = {
  default: "bg-card",
  primary: "bg-tint-primary",
  success: "bg-tint-success",
  warning: "bg-tint-warning",
  danger: "bg-tint-danger",
};

const toneBorder: Record<CardTone, string> = {
  default: "border-border",
  primary: "border-primary/25",
  success: "border-success/25",
  warning: "border-warning/25",
  danger: "border-destructive/25",
};

/**
 * A superfície do app. Um card = fundo + borda de 1px + raio.
 *
 * `header`/`aside` desenham a faixa de topo; sem nenhum dos dois o card é só
 * o corpo. `padded={false}` entrega o corpo cru para listas que precisam
 * sangrar até a borda.
 */
export function Card({
  tone = "default",
  header,
  aside,
  footer,
  padded = true,
  className,
  bodyClassName,
  children,
}: {
  tone?: CardTone;
  header?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  padded?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border",
        toneSurface[tone],
        toneBorder[tone],
        className,
      )}
    >
      {(header || aside) && (
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          {header && <h2 className="t-section min-w-0 truncate">{header}</h2>}
          {aside && (
            <span className="t-caption shrink-0 tabular-nums">{aside}</span>
          )}
        </div>
      )}
      {children !== undefined && (
        <div className={cn(padded && "px-4 pt-1 pb-4", !header && !aside && padded && "pt-4", bodyClassName)}>
          {children}
        </div>
      )}
      {footer && <div className="border-t border-border/70">{footer}</div>}
    </section>
  );
}

/**
 * Linha de um card. Altura mínima de 44px porque toda linha aqui costuma ser
 * clicável, e um alvo menor que isso erra no polegar.
 */
export function CardRow({
  className,
  children,
  onClick,
  as: As,
  ...rest
}: {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  as?: React.ElementType;
} & Record<string, unknown>) {
  const Comp = As ?? (onClick ? "button" : "div");
  const interativo = Boolean(onClick || As);

  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left",
        interativo && "transition-colors hover:bg-muted active:bg-muted",
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}
