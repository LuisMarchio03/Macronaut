import { useState } from "react";
import { Label } from "../ui/label";
import { HudPanel } from "../ui/hud-panel";
import { LineChart } from "../line-chart";
import { useExercises } from "../../hooks/use-exercises";
import { useSetsForExercise } from "../../hooks/use-workouts";
import { serieDeProgressao } from "../../domain/treino";
import { formatarData } from "../../lib/date";

type Metrica = "e1RM" | "topPeso";

export function ProgressaoTab() {
  const { data: exercicios = [] } = useExercises();
  const [exId, setExId] = useState<number | undefined>(undefined);
  const [metrica, setMetrica] = useState<Metrica>("e1RM");
  const { data: sets = [] } = useSetsForExercise(exId);

  const pontos = serieDeProgressao(sets).map((p) => ({
    x: formatarData(p.data),
    y: metrica === "e1RM" ? p.e1RM : p.topPeso,
  }));

  return (
    <HudPanel label="Progressão" bodyClassName="space-y-3">
      <div>
        <Label htmlFor="prog-ex">Exercício</Label>
        <select id="prog-ex" className="hud-select"
          value={exId ?? ""} onChange={(e) => setExId(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Selecione…</option>
          {exercicios.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {exId != null && (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
            {([
              { k: "e1RM", label: "1RM estimado" },
              { k: "topPeso", label: "Carga máx." },
            ] as const).map((m) => (
              <button
                key={m.k}
                className={`rounded-md px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] transition-colors ${
                  metrica === m.k
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setMetrica(m.k)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <LineChart pontos={pontos} unidade="kg" />
        </>
      )}
    </HudPanel>
  );
}
