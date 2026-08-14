import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OpcaoSegmento<T extends string> {
  valor: T;
  label: string;
  icone?: LucideIcon;
}

/**
 * Controle segmentado — alterna entre visões da mesma tela.
 *
 * Usa `role="tablist"` porque é isso que ele é: navegação entre painéis, não
 * um grupo de botões independentes. Sem isso o leitor de tela anuncia N botões
 * soltos e não informa qual está selecionado nem quantos existem.
 */
export function Segmented<T extends string>({
  opcoes,
  valor,
  onChange,
  className,
  rotulo,
}: {
  opcoes: readonly OpcaoSegmento<T>[];
  valor: T;
  onChange: (v: T) => void;
  className?: string;
  rotulo: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={rotulo}
      className={cn("flex gap-1 rounded-lg bg-muted p-1", className)}
    >
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        const Icone = o.icone;
        return (
          <button
            key={o.valor}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => onChange(o.valor)}
            className={cn(
              "flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-[0.8125rem] font-medium transition-colors",
              ativo
                ? "bg-card text-foreground shadow-[var(--shadow-1)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icone && <Icone className="size-4 shrink-0" aria-hidden />}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
