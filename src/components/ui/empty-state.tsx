import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Estado vazio. `action` não é opcional por acaso na maioria dos usos: uma tela
 * vazia sem saída deixa o usuário sem saber o que fazer — o texto explica, o
 * botão resolve.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="text-[0.9375rem] font-semibold">{title}</p>
      {description && <p className="t-caption mt-1 max-w-[32ch]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Falha de carregamento com saída. Sem isto, erro de rede vira tela em branco. */
export function ErrorState({
  title = "Não foi possível carregar",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <p className="text-[0.9375rem] font-semibold">{title}</p>
      {description && <p className="t-caption mt-1 max-w-[32ch]">{description}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex h-11 items-center rounded-lg border border-input px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          Tentar de novo
        </button>
      )}
    </div>
  );
}
