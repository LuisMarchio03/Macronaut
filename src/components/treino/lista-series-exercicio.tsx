import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { useDeleteSet, useUpdateSet } from "../../hooks/use-workouts";
import { seriesEfetivas, rotuloRir } from "../../domain/treino";
import { cn } from "@/lib/utils";
import type { WorkoutSet } from "../../domain/types";

const ROTULO_TIPO: Record<string, string> = {
  aquecimento: "aquecimento",
  drop: "drop",
  falha: "falha",
};

export function ListaSeriesExercicio({
  nome,
  sets,
  sessionId,
}: {
  nome: string;
  sets: WorkoutSet[];
  sessionId: number;
}) {
  const delSet = useDeleteSet(sessionId);
  const updSet = useUpdateSet(sessionId);
  const [editId, setEditId] = useState<number | null>(null);
  const [eReps, setEReps] = useState("");
  const [ePeso, setEPeso] = useState("");

  function abrirEdicao(s: WorkoutSet) {
    setEditId(s.id);
    setEReps(String(s.reps));
    setEPeso(String(s.peso_kg));
  }
  async function confirmarEdicao(id: number) {
    if (Number(eReps) <= 0) return;
    await updSet.mutateAsync({ id, reps: Number(eReps), peso_kg: Number(ePeso) || 0 });
    setEditId(null);
  }

  // O aside conta só as efetivas — aquecimento não é série de treino.
  const nEfetivas = seriesEfetivas(sets).length;

  return (
    <Card
      header={nome}
      aside={nEfetivas === 1 ? "1 série" : `${nEfetivas} séries`}
      padded={false}
    >
      <ul className="divide-y divide-border">
        {sets.map((s) => {
          const aquec = s.tipo === "aquecimento";
          const marcador = ROTULO_TIPO[s.tipo];

          if (editId === s.id) {
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <Input
                  aria-label="reps"
                  inputMode="numeric"
                  value={eReps}
                  onChange={(e) => setEReps(e.target.value)}
                  className="w-16"
                />
                <span aria-hidden className="text-muted-foreground">
                  ×
                </span>
                <Input
                  aria-label="peso"
                  inputMode="decimal"
                  value={ePeso}
                  onChange={(e) => setEPeso(e.target.value)}
                  className="w-20"
                />
                <Button size="sm" onClick={() => confirmarEdicao(s.id)} disabled={updSet.isPending}>
                  Confirmar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                  Cancelar
                </Button>
              </li>
            );
          }

          return (
            <li key={s.id} className="flex items-center gap-1 px-2">
              <button
                type="button"
                onClick={() => abrirEdicao(s)}
                aria-label={`Editar ${s.ordem}ª série: ${s.reps} repetições com ${s.peso_kg} quilos`}
                className={cn(
                  "min-h-11 min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm tabular-nums transition-colors hover:bg-muted",
                  aquec && "text-muted-foreground",
                )}
              >
                <span className="font-medium">{s.ordem}ª</span> · {s.reps} reps × {s.peso_kg} kg
                {s.rir != null && (
                  <span className="t-caption"> · RIR {rotuloRir(s.rir)}</span>
                )}
                {marcador && <span className="t-caption"> · {marcador}</span>}
              </button>
              <button
                type="button"
                onClick={() => delSet.mutate(s.id)}
                aria-label={`Remover ${s.ordem}ª série`}
                className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
