import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { HudPanel } from "../ui/hud-panel";
import { ExercicioAutocomplete } from "./exercicio-autocomplete";
import { useExercises } from "../../hooks/use-exercises";
import { useAddSet, useUltimaVez } from "../../hooks/use-workouts";
import { formatarData } from "../../lib/date";
import { resumirSets, rotuloRir } from "../../domain/treino";
import type { Exercise, TipoSerie, WorkoutSet } from "../../domain/types";

const TIPOS: { k: TipoSerie; label: string }[] = [
  { k: "aquecimento", label: "Aquec." },
  { k: "valida", label: "Válida" },
  { k: "drop", label: "Drop" },
  { k: "falha", label: "Falha" },
];

const RIRS = [0, 1, 2, 3, 4];

const chip =
  "rounded-md px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] transition-colors";
const chipOn = "bg-primary font-semibold text-primary-foreground";
const chipOff = "text-muted-foreground hover:text-foreground";

function PainelAnterior({ exercicioId, data }: { exercicioId: number; data: string }) {
  const { data: ultima, isPending } = useUltimaVez(exercicioId, data);
  if (isPending) return null;

  // O RIR que importa pro painel é o da ÚLTIMA série efetiva (a mais próxima
  // da falha) — é ela que diz se dá pra subir carga hoje, não a primeira.
  const rirUltimaSerie = ultima?.sets[ultima.sets.length - 1]?.rir ?? null;
  const corpo = !ultima
    ? "sem histórico"
    : `${formatarData(ultima.data)} · ${resumirSets(ultima.sets)}${
        rirUltimaSerie != null ? ` · RIR ${rotuloRir(rirUltimaSerie)}` : ""
      }`;

  return (
    <p className="rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 font-mono text-[0.68rem] tabular-nums text-muted-foreground">
      <span className="uppercase tracking-[0.14em] text-primary/70">anterior</span> · {corpo}
    </p>
  );
}

export function NovaSerieForm({
  sessionId, data, sets,
}: {
  sessionId: number;
  data: string;
  sets: WorkoutSet[];
}) {
  const { data: exercicios = [] } = useExercises();
  const addSet = useAddSet(sessionId);

  const [exercicio, setExercicio] = useState<Exercise | null>(null);
  const [reps, setReps] = useState("10");
  const [peso, setPeso] = useState("");
  const [tipo, setTipo] = useState<TipoSerie>("valida");
  const [rir, setRir] = useState<number | null>(null);
  const [nota, setNota] = useState("");
  const [mostrarNota, setMostrarNota] = useState(false);

  async function adicionar() {
    if (!exercicio || Number(reps) <= 0) return;
    // MAX(ordem)+1, não length+1: apagar uma série do meio e adicionar outra
    // deixa um buraco na sequência (ex.: 1, 3) — length+1 repetiria um ordem
    // já usado, e `ultimaVezExercicio` (ORDER BY ordem) ficaria indefinido.
    const ordensDoExercicio = sets.filter((s) => s.exercise_id === exercicio.id).map((s) => s.ordem);
    const ordem = ordensDoExercicio.length > 0 ? Math.max(...ordensDoExercicio) + 1 : 1;
    await addSet.mutateAsync({
      session_id: sessionId,
      exercise_id: exercicio.id,
      ordem,
      reps: Number(reps),
      peso_kg: Number(peso) || 0,
      tipo,
      rir,
      nota: nota.trim() || null,
    });
    // Mantém exercício, reps, peso e tipo — a próxima série costuma ser parecida.
    setNota("");
    setMostrarNota(false);
  }

  return (
    <HudPanel label="Nova série" bodyClassName="space-y-2">
      <div>
        <Label htmlFor="ex">Exercício</Label>
        <ExercicioAutocomplete
          id="ex"
          exercicios={exercicios}
          selecionado={exercicio}
          onSelecionar={setExercicio}
        />
      </div>

      {exercicio && <PainelAnterior exercicioId={exercicio.id} data={data} />}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="reps">Reps</Label>
          <Input id="reps" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="peso">Peso (kg)</Label>
          <Input id="peso" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Tipo</Label>
        <div className="grid grid-cols-4 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
          {TIPOS.map((t) => (
            <button
              key={t.k}
              type="button"
              aria-pressed={tipo === t.k}
              className={`${chip} ${tipo === t.k ? chipOn : chipOff}`}
              onClick={() => setTipo(t.k)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>RIR (opcional)</Label>
        <div className="grid grid-cols-5 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
          {RIRS.map((r) => (
            <button
              key={r}
              type="button"
              aria-label={`RIR ${rotuloRir(r)}`}
              aria-pressed={rir === r}
              className={`${chip} ${rir === r ? chipOn : chipOff}`}
              onClick={() => setRir(rir === r ? null : r)}
            >
              {rotuloRir(r)}
            </button>
          ))}
        </div>
      </div>

      {mostrarNota ? (
        <div>
          <Label htmlFor="nota-serie">Nota</Label>
          <Input id="nota-serie" value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>
      ) : (
        <button
          type="button"
          className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
          onClick={() => setMostrarNota(true)}
        >
          + nota
        </button>
      )}

      <Button className="w-full" onClick={adicionar} disabled={!exercicio || addSet.isPending}>
        + série
      </Button>
    </HudPanel>
  );
}
