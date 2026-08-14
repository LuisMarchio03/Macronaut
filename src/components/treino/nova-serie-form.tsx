import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card } from "../ui/card";
import { ChipGroup } from "../ui/chip-group";
import { ExercicioAutocomplete } from "./exercicio-autocomplete";
import { useExercises } from "../../hooks/use-exercises";
import { useAddSet, useUltimaVez } from "../../hooks/use-workouts";
import { dataPorExtenso } from "../../lib/date";
import { resumirSets, rotuloRir } from "../../domain/treino";
import type { Exercise, TipoSerie, WorkoutSet } from "../../domain/types";

const TIPOS: { valor: TipoSerie; label: string; descricao: string }[] = [
  { valor: "aquecimento", label: "Aquec.", descricao: "Aquecimento" },
  { valor: "valida", label: "Válida", descricao: "Série válida" },
  { valor: "drop", label: "Drop", descricao: "Drop set" },
  { valor: "falha", label: "Falha", descricao: "Até a falha" },
];

const RIRS = [0, 1, 2, 3, 4].map((r) => ({
  valor: r,
  label: rotuloRir(r),
  descricao: `RIR ${rotuloRir(r)}`,
}));

function PainelAnterior({ exercicioId, data }: { exercicioId: number; data: string }) {
  const { data: ultima, isPending } = useUltimaVez(exercicioId, data);
  if (isPending) return null;

  // O RIR que importa pro painel é o da ÚLTIMA série efetiva (a mais próxima
  // da falha) — é ela que diz se dá pra subir carga hoje, não a primeira.
  const rirUltimaSerie = ultima?.sets[ultima.sets.length - 1]?.rir ?? null;
  const corpo = !ultima
    ? "sem histórico deste exercício"
    : `${dataPorExtenso(ultima.data)} · ${resumirSets(ultima.sets)}${
        rirUltimaSerie != null ? ` · RIR ${rotuloRir(rirUltimaSerie)}` : ""
      }`;

  return (
    <p className="rounded-md bg-muted px-3 py-2 text-[0.8125rem] tabular-nums text-muted-foreground">
      <span className="font-medium text-foreground">Última vez</span> · {corpo}
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
    <Card header="Nova série" bodyClassName="space-y-3 px-4 pt-1 pb-4">
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
        <ChipGroup
          opcoes={TIPOS}
          valor={tipo}
          onChange={(v) => v && setTipo(v)}
          rotulo="Tipo da série"
          colunas={4}
        />
      </div>

      <div>
        <Label>RIR (opcional)</Label>
        <ChipGroup
          opcoes={RIRS}
          valor={rir}
          onChange={setRir}
          rotulo="Repetições em reserva"
          desmarcavel
          colunas={5}
        />
      </div>

      {mostrarNota ? (
        <div>
          <Label htmlFor="nota-serie">Nota</Label>
          <Input id="nota-serie" value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>
      ) : (
        <button
          type="button"
          className="min-h-9 self-start text-[0.8125rem] font-medium text-primary transition-colors hover:underline"
          onClick={() => setMostrarNota(true)}
        >
          + Adicionar nota
        </button>
      )}

      <Button block onClick={adicionar} disabled={!exercicio || addSet.isPending}>
        Adicionar série
      </Button>
    </Card>
  );
}
