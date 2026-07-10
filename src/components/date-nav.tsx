import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useDataAtiva } from "../lib/data-context";
import { hoje } from "../lib/date";

export function DateNav() {
  const { data, setData, ehHoje, irHoje, passoDia } = useDataAtiva();
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border p-1.5 backdrop-blur-md transition-colors ${
        ehHoje ? "border-border/60 bg-card/50" : "border-primary/60 bg-primary/10"
      }`}
    >
      <button
        type="button" aria-label="dia anterior" onClick={() => passoDia(-1)}
        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
      </button>

      <input
        type="date" aria-label="data" value={data} max={hoje()}
        onChange={(e) => e.target.value && setData(e.target.value)}
        className="flex-1 bg-transparent text-center font-mono text-[0.8rem] tabular-nums outline-none"
      />

      <button
        type="button" aria-label="próximo dia" onClick={() => passoDia(1)} disabled={ehHoje}
        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-30"
      >
        <ChevronRight className="size-4" />
      </button>

      {!ehHoje && (
        <>
          <span className="flex items-center gap-1 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-primary">
            <Clock className="size-3" /> retroativo
          </span>
          <button
            type="button" onClick={irHoje}
            className="rounded-lg bg-primary px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-primary-foreground"
          >
            Hoje
          </button>
        </>
      )}
    </div>
  );
}
