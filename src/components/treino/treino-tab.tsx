import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { HudPanel } from "../ui/hud-panel";
import { X } from "lucide-react";
import { hoje, formatarData } from "../../lib/date";
import { useExercises } from "../../hooks/use-exercises";
import {
  useSessionByDate, useCreateSession, useSessionSets, useAddSet, useDeleteSet,
  useListSessions, useDeleteSession,
} from "../../hooks/use-workouts";

export function TreinoTab() {
  const data = hoje();
  const { data: sessao } = useSessionByDate(data);
  const criarSessao = useCreateSession();
  const { data: exercicios = [] } = useExercises();
  const { data: sets = [] } = useSessionSets(sessao?.id);
  const addSet = useAddSet(sessao?.id);
  const delSet = useDeleteSet(sessao?.id);
  const { data: recentes = [] } = useListSessions();
  const delSessao = useDeleteSession();

  const [exId, setExId] = useState("");
  const [reps, setReps] = useState("10");
  const [peso, setPeso] = useState("");

  // Mantém o <select> controlado sempre apontando para uma opção existente:
  // assim que os exercícios carregam, se ainda não há seleção, usa o primeiro.
  useEffect(() => {
    if (!exId && exercicios.length > 0) setExId(String(exercicios[0].id));
  }, [exId, exercicios]);

  async function iniciar() {
    await criarSessao.mutateAsync({ data, nome: null });
  }

  async function adicionarSerie() {
    const exercise_id = Number(exId || exercicios[0]?.id);
    if (!sessao || !exercise_id || Number(reps) <= 0) return;
    const ordemDoEx = sets.filter((s) => s.exercise_id === exercise_id).length + 1;
    await addSet.mutateAsync({
      session_id: sessao.id, exercise_id, ordem: ordemDoEx,
      reps: Number(reps), peso_kg: Number(peso) || 0,
    });
  }

  const nomeEx = (id: number) => exercicios.find((e) => e.id === id)?.nome ?? "?";
  const porExercicio = [...new Set(sets.map((s) => s.exercise_id))];

  return (
    <div className="space-y-4">
      <header className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
        {formatarData(data)}
      </header>

      {!sessao ? (
        <Button onClick={iniciar} disabled={criarSessao.isPending}>Iniciar treino de hoje</Button>
      ) : (
        <>
          <HudPanel label="Nova série" bodyClassName="space-y-2">
            <div>
              <Label htmlFor="ex">Exercício</Label>
              <select id="ex" className="hud-select"
                value={exId} onChange={(e) => setExId(e.target.value)}>
                {exercicios.length === 0 && <option value="">Cadastre um exercício</option>}
                {exercicios.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label htmlFor="reps">Reps</Label>
                <Input id="reps" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} /></div>
              <div><Label htmlFor="peso">Peso (kg)</Label>
                <Input id="peso" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} /></div>
            </div>
            <Button className="w-full" onClick={adicionarSerie}
              disabled={exercicios.length === 0 || addSet.isPending}>+ série</Button>
          </HudPanel>

          {porExercicio.map((id) => {
            const setsEx = sets.filter((s) => s.exercise_id === id);
            return (
              <HudPanel key={id} label={nomeEx(id)} aside={`${setsEx.length} séries`} bodyClassName="p-2">
                <ul>
                  {setsEx.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50">
                      <span className="font-mono text-[0.8rem] tabular-nums">{s.ordem}ª · {s.reps} reps × {s.peso_kg} kg</span>
                      <button
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                        onClick={() => delSet.mutate(s.id)} aria-label="remover">
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </HudPanel>
            );
          })}
        </>
      )}

      <HudPanel label="Treinos recentes" aside={`${recentes.length}`} bodyClassName="p-2">
        <ul className="divide-y divide-border/40">
          {recentes.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-2 py-2">
              <span className="font-mono text-[0.8rem]">{formatarData(r.data)}{r.nome && ` · ${r.nome}`}</span>
              <button
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                onClick={() => delSessao.mutate(r.id)} aria-label="excluir">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
          {recentes.length === 0 && (
            <li className="px-2 py-4 text-center font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">Nenhum treino ainda</li>
          )}
        </ul>
      </HudPanel>
    </div>
  );
}
