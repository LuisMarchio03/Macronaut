import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDataAtiva } from "../lib/data-context";
import { hoje, dataRelativa } from "../lib/date";
import { cn } from "@/lib/utils";

/**
 * Navegação de dia. O rótulo já diz que data está sendo vista ("Hoje",
 * "Ontem", "Quinta, 14 de agosto"), então a tela não precisa repetir a data
 * num título logo acima — era a mesma informação duas vezes.
 *
 * O `<input type=date>` fica invisível por cima do rótulo: mantém o seletor
 * nativo do sistema (bom no celular) sem o campo cinza de fábrica.
 */
export function DateNav() {
  const { data, setData, ehHoje, irHoje, passoDia } = useDataAtiva();

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-xl border p-1",
        ehHoje ? "border-border bg-card" : "border-primary/40 bg-tint-primary",
      )}
    >
      <button
        type="button"
        aria-label="Dia anterior"
        onClick={() => passoDia(-1)}
        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="size-5" />
      </button>

      <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none block truncate px-1 text-center text-sm font-medium">
          {dataRelativa(data)}
        </span>
        <input
          type="date"
          aria-label="Escolher data"
          value={data}
          max={hoje()}
          onChange={(e) => e.target.value && setData(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>

      <button
        type="button"
        aria-label="Próximo dia"
        onClick={() => passoDia(1)}
        disabled={ehHoje}
        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight className="size-5" />
      </button>

      {!ehHoje && (
        <button
          type="button"
          onClick={irHoje}
          className="mr-0.5 h-9 shrink-0 rounded-lg bg-primary px-3 text-[0.8125rem] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Hoje
        </button>
      )}
    </div>
  );
}
