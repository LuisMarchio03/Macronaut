import type { ReactNode } from "react";
import { Card } from "./card";

/**
 * ADAPTADOR — mantido enquanto as telas migram para `<Card>`.
 *
 * `glow` e `scanlines` são aceitos e ignorados: eram decoração do tema
 * anterior. Manter os props evita tocar em dez telas de uma vez só para
 * remover dois booleanos.
 */
export function HudPanel({
  label,
  aside,
  bodyClassName,
  className,
  children,
}: {
  label?: ReactNode;
  aside?: ReactNode;
  glow?: boolean;
  scanlines?: boolean;
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card header={label} aside={aside} className={className} bodyClassName={bodyClassName}>
      {children}
    </Card>
  );
}
