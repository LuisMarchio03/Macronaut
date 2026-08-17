import { useState } from "react";
import { Label } from "../ui/label";
import { Card } from "../ui/card";
import { Segmented } from "../ui/segmented";
import { LineChart } from "../line-chart";
import { useExercises } from "../../hooks/use-exercises";
import { useSetsForExercise } from "../../hooks/use-workouts";
import { serieDeProgressao } from "../../domain/treino";
import { formatarData } from "../../lib/date";

type Metrica = "e1RM" | "topPeso";

const METRICAS = [
  { valor: "e1RM" as const, label: "1RM estimado" },
  { valor: "topPeso" as const, label: "Carga máxima" },
];

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
    <Card bodyClassName="space-y-3 px-4 pt-1 pb-4">
      <div>
        <Label htmlFor="prog-ex">Exercício</Label>
        <select id="prog-ex" className="select-field"
          value={exId ?? ""} onChange={(e) => setExId(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Selecione…</option>
          {exercicios.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {exId != null && (
        <>
          <Segmented
            opcoes={METRICAS}
            valor={metrica}
            onChange={setMetrica}
            rotulo="Métrica de progressão"
          />
          <LineChart pontos={pontos} unidade="kg" />
        </>
      )}
    </Card>
  );
}
