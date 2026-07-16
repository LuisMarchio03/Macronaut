import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { HudPanel } from "../ui/hud-panel";
import { useDeleteSet, useUpdateSet } from "../../hooks/use-workouts";
import { seriesEfetivas, rotuloRir } from "../../domain/treino";
import type { WorkoutSet } from "../../domain/types";

export function ListaSeriesExercicio({
  nome, sets, sessionId,
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
    setEditId(s.id); setEReps(String(s.reps)); setEPeso(String(s.peso_kg));
  }
  async function confirmarEdicao(id: number) {
    if (Number(eReps) <= 0) return;
    await updSet.mutateAsync({ id, reps: Number(eReps), peso_kg: Number(ePeso) || 0 });
    setEditId(null);
  }

  // O aside conta só as efetivas — aquecimento não é série de treino.
  const nEfetivas = seriesEfetivas(sets).length;

  return (
    <HudPanel label={nome} aside={`${nEfetivas} séries`} bodyClassName="p-2">
      <ul>
        {sets.map((s) => {
          const aquec = s.tipo === "aquecimento";
          return (
            <li
              key={s.id}
              className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50 ${
                aquec ? "opacity-50" : ""
              }`}
            >
              {editId === s.id ? (
                <div className="flex flex-1 items-center gap-1">
                  <Input aria-label="reps" inputMode="numeric" value={eReps}
                    onChange={(e) => setEReps(e.target.value)} className="h-7 w-14" />
                  <span className="font-mono text-xs">×</span>
                  <Input aria-label="peso" inputMode="decimal" value={ePeso}
                    onChange={(e) => setEPeso(e.target.value)} className="h-7 w-16" />
                  <Button size="sm" className="h-7" onClick={() => confirmarEdicao(s.id)}
                    disabled={updSet.isPending}>confirmar</Button>
                  <Button size="sm" variant="secondary" className="h-7"
                    onClick={() => setEditId(null)}>cancelar</Button>
                </div>
              ) : (
                <button type="button" onClick={() => abrirEdicao(s)}
                  className="flex-1 text-left font-mono text-[0.8rem] tabular-nums hover:text-primary">
                  {s.ordem}ª · {s.reps} reps × {s.peso_kg} kg
                  {s.rir != null && <span className="text-muted-foreground"> · RIR {rotuloRir(s.rir)}</span>}
                  {aquec && <span className="text-muted-foreground"> · aquec.</span>}
                  {s.tipo === "drop" && <span className="text-muted-foreground"> · drop</span>}
                  {s.tipo === "falha" && <span className="text-muted-foreground"> · falha</span>}
                </button>
              )}
              <button
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                onClick={() => delSet.mutate(s.id)} aria-label="remover">
                <X className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </HudPanel>
  );
}
