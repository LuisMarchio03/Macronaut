import { cn } from "@/lib/utils";

/**
 * Escolha de VÁRIAS opções entre poucas e curtas.
 *
 * O `ChipGroup` é escolha única (`valor: T | null`); aqui o campo é um
 * conjunto — "que outros músculos este exercício também pega" não tem
 * resposta única, e forçá-la a ter faria o desenho mentir sobre o movimento.
 */
export function ChipsMultiplos<T extends string>({
  opcoes,
  valores,
  onChange,
  rotulo,
  rotuloDe,
  colunas = 3,
  className,
}: {
  opcoes: readonly { valor: T; label: string }[];
  valores: readonly T[];
  onChange: (v: T[]) => void;
  rotulo: string;
  /** Rótulo acessível de cada chip. Sem ele, "Bíceps" sozinho não diz o que faz. */
  rotuloDe?: (label: string) => string;
  colunas?: number;
  className?: string;
}) {
  const set = new Set(valores);

  return (
    <div
      role="group"
      aria-label={rotulo}
      className={cn("grid gap-1 rounded-lg bg-muted p-1", className)}
      style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}
    >
      {opcoes.map((o) => {
        const ativo = set.has(o.valor);
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={ativo}
            aria-label={rotuloDe?.(o.label)}
            onClick={() =>
              onChange(ativo ? valores.filter((v) => v !== o.valor) : [...valores, o.valor])
            }
            className={cn(
              "min-h-9 truncate rounded-md px-2 text-[0.8125rem] font-medium transition-colors",
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
