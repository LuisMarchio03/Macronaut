import { cn } from "@/lib/utils";

export interface OpcaoChip<T> {
  valor: T;
  label: string;
  /** Rótulo para leitor de tela quando o visível é abreviado. */
  descricao?: string;
}

/**
 * Grupo de escolha única entre poucas opções curtas.
 *
 * Difere do `Segmented` em dois pontos: as opções não são visões de tela (por
 * isso `aria-pressed`, não `role="tab"`), e com `desmarcavel` tocar na opção
 * já escolhida a limpa — que é o que se espera de um campo opcional como o RIR.
 */
export function ChipGroup<T extends string | number>({
  opcoes,
  valor,
  onChange,
  rotulo,
  desmarcavel = false,
  colunas,
  className,
}: {
  opcoes: readonly OpcaoChip<T>[];
  valor: T | null;
  onChange: (v: T | null) => void;
  rotulo: string;
  desmarcavel?: boolean;
  colunas?: number;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={rotulo}
      className={cn("grid gap-1 rounded-lg bg-muted p-1", className)}
      style={colunas ? { gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` } : undefined}
    >
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={String(o.valor)}
            type="button"
            aria-pressed={ativo}
            aria-label={o.descricao}
            onClick={() => onChange(ativo && desmarcavel ? null : o.valor)}
            className={cn(
              "min-h-9 rounded-md px-2 text-[0.8125rem] font-medium transition-colors",
              ativo
                ? "bg-card text-foreground shadow-[var(--shadow-1)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
