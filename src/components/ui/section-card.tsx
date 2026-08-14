import type { ReactNode } from "react";
import { Card, type CardTone } from "./card";

/**
 * ADAPTADOR — mantido enquanto as telas migram para `<Card>`.
 *
 * As variantes antigas descreviam aparência (`gradient`, `outlined`); as novas
 * descrevem intenção (`tone`). O mapeamento colapsa `outlined` em `default`
 * porque a diferença entre elas era decorativa.
 */
const variantToTone: Record<string, CardTone> = {
  elevated: "default",
  outlined: "default",
  gradient: "primary",
};

export function SectionCard({
  variant = "elevated",
  header,
  aside,
  className,
  bodyClassName,
  children,
}: {
  variant?: "elevated" | "outlined" | "gradient";
  header?: ReactNode;
  aside?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card
      tone={variantToTone[variant] ?? "default"}
      header={header}
      aside={aside}
      className={className}
      bodyClassName={bodyClassName}
    >
      {children}
    </Card>
  );
}
