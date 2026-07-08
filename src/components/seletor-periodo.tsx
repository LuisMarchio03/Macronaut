import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type Granularidade, type Periodo, rangeDoPeriodo, navegar, rotuloPeriodo,
} from "../domain/periodo";

const OPCOES: { g: Granularidade; label: string }[] = [
  { g: "semana", label: "Semana" },
  { g: "mes", label: "Mês" },
  { g: "ano", label: "Ano" },
  { g: "personalizado", label: "Personalizado" },
];

export function SeletorPeriodo({
  gran, periodo, onChange,
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
      <div className="flex flex-wrap gap-1">
        {OPCOES.map((o) => (
          <button
            key={o.g}
            type="button"
            onClick={() => trocarGran(o.g)}
            className={`rounded-md px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.12em] transition-colors ${
              gran === o.g ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {gran === "personalizado" ? (
        <div className="flex items-center gap-2">
          <input type="date" aria-label="data inicial" value={periodo.inicio}
            onChange={(e) => setLimite("inicio", e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm" />
          <span className="text-muted-foreground">–</span>
          <input type="date" aria-label="data final" value={periodo.fim}
            onChange={(e) => setLimite("fim", e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm" />
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <button type="button" aria-label="período anterior" onClick={() => passo(-1)}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60">
            <ChevronLeft className="size-4" />
          </button>
          <span className="font-mono text-sm tracking-wide">{rotuloPeriodo(gran, periodo)}</span>
          <button type="button" aria-label="próximo período" onClick={() => passo(1)}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60">
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
