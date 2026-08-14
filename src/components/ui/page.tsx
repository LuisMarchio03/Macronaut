import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Casca da página: gutter, ritmo vertical e folga para a barra inferior. */
export function Page({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("space-y-4 px-4 pt-3 pb-6", className)}>{children}</div>;
}

/**
 * Cabeçalho de tela.
 *
 * `title` é a identidade da tela e `eyebrow` o contexto acima dela. A data do
 * dia é contexto, não título — antes ela aparecia como `<h1>` e de novo logo
 * abaixo no seletor de data, duas vezes a mesma informação.
 */
export function PageHeader({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="t-caption">{eyebrow}</p>}
          <h1 className="t-title mt-0.5 truncate">{title}</h1>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </header>
  );
}

/** Rótulo de um agrupamento de cards, fora deles. */
export function SectionLabel({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-0.5", className)}>
      <h2 className="t-section">{children}</h2>
      {action}
    </div>
  );
}
