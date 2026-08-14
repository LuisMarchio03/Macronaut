import { ChevronLeft, ChevronRight } from "lucide-react";
import { Segmented } from "./ui/segmented";
import {
  type Granularidade,
  type Periodo,
  rangeDoPeriodo,
  navegar,
  rotuloPeriodo,
} from "../domain/periodo";

const OPCOES = [
  { valor: "semana" as const, label: "Semana" },
  { valor: "mes" as const, label: "Mês" },
  { valor: "ano" as const, label: "Ano" },
  { valor: "personalizado" as const, label: "Escolher" },
];

export function SeletorPeriodo({
  gran,
  periodo,
  onChange,
}: {
  gran: Granularidade;
  periodo: Periodo;
  onChange: (gran: Granularidade, periodo: Periodo) => void;
}) {
  function trocarGran(g: Granularidade) {
    if (g === "personalizado") onChange(g, periodo);
    else onChange(g, rangeDoPeriodo(g, periodo.inicio));
  }
  function passo(dir: -1 | 1) {
    onChange(gran, rangeDoPeriodo(gran, navegar(gran, periodo.inicio, dir)));
  }
  function setLimite(qual: "inicio" | "fim", valor: string) {
    const p = { ...periodo, [qual]: valor };
    onChange("personalizado", p.inicio <= p.fim ? p : { inicio: p.fim, fim: p.inicio });
  }

  return (
    <div className="space-y-2">
      <Segmented opcoes={OPCOES} valor={gran} onChange={trocarGran} rotulo="Período" />

      {gran === "personalizado" ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="data inicial"
            value={periodo.inicio}
            onChange={(e) => setLimite("inicio", e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-base"
          />
          <span aria-hidden className="text-muted-foreground">
            –
          </span>
          <input
            type="date"
            aria-label="data final"
            value={periodo.fim}
            onChange={(e) => setLimite("fim", e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-base"
          />
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-1">
          <button
            type="button"
            aria-label="período anterior"
            onClick={() => passo(-1)}
            className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="min-w-0 truncate px-2 text-sm font-medium tabular-nums">
            {rotuloPeriodo(gran, periodo)}
          </span>
          <button
            type="button"
            aria-label="próximo período"
            onClick={() => passo(1)}
            className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}
