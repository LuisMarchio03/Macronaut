import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import type { TipoPrescricao } from "@/domain/prescricao";
import type { Parte } from "@/domain/531";
import type { ExercicioRotina, ExercicioRotinaInput } from "@/repositories/rotina";

const TIPOS = [
  { valor: "dupla" as const, label: "Dupla", descricao: "Dupla progressão" },
  { valor: "fixa" as const, label: "Fixa", descricao: "Carga fixa" },
  { valor: "531" as const, label: "5/3/1", descricao: "Método 5/3/1" },
];

const PARTES = [
  { valor: "superior" as const, label: "Superior", descricao: "Parte superior" },
  { valor: "inferior" as const, label: "Inferior", descricao: "Parte inferior" },
];

/** Campo numérico vazio vira o padrão, não NaN. */
const num = (s: string, padrao: number) => {
  const n = Number(s.replace(",", "."));
  return s.trim() === "" || Number.isNaN(n) ? padrao : n;
};

/**
 * A prescrição de um exercício da rotina.
 *
 * Os campos seguem o tipo escolhido de propósito: pedir Training Max a quem
 * escolheu dupla progressão seria pedir um número que não vai ser usado, e
 * pedir faixa de repetições a quem escolheu 5/3/1 seria pedir um número que o
 * método já define.
 */
export function SheetPrescricao({
  aberto,
  onFechar,
  exercicio,
  onSalvar,
}: {
  aberto: boolean;
  onFechar: () => void;
  exercicio: ExercicioRotina | null;
  onSalvar: (e: ExercicioRotinaInput) => void;
}) {
  const [tipo, setTipo] = useState<TipoPrescricao>("dupla");
  const [series, setSeries] = useState("3");
  const [repsMin, setRepsMin] = useState("8");
  const [repsMax, setRepsMax] = useState("12");
  const [peso, setPeso] = useState("");
  const [incremento, setIncremento] = useState("2.5");
  const [tm, setTm] = useState("");
  const [parte, setParte] = useState<Parte>("superior");
  const [descanso, setDescanso] = useState("90");

  // Abrir o sheet para outro exercício precisa recarregar os campos; sem isso o
  // segundo exercício aberto mostraria os números do primeiro.
  useEffect(() => {
    if (!exercicio) return;
    setTipo(exercicio.prescricao);
    setSeries(String(exercicio.series));
    setRepsMin(exercicio.reps_min == null ? "8" : String(exercicio.reps_min));
    setRepsMax(exercicio.reps_max == null ? "12" : String(exercicio.reps_max));
    setPeso(exercicio.peso_kg == null ? "" : String(exercicio.peso_kg));
    setIncremento(String(exercicio.incremento_kg));
    setTm(exercicio.tm_kg == null ? "" : String(exercicio.tm_kg));
    setParte(exercicio.parte ?? "superior");
    setDescanso(exercicio.descanso_s == null ? "90" : String(exercicio.descanso_s));
  }, [exercicio]);

  if (!exercicio) return null;

  function salvar() {
    onSalvar({
      exercise_id: exercicio!.exercise_id,
      prescricao: tipo,
      series: num(series, 3),
      reps_min: tipo === "dupla" ? num(repsMin, 8) : null,
      reps_max: tipo === "531" ? null : num(repsMax, 12),
      peso_kg: tipo === "531" ? null : num(peso, 0),
      incremento_kg: num(incremento, 2.5),
      tm_kg: tipo === "531" ? num(tm, 0) : null,
      parte: tipo === "531" ? parte : null,
      descanso_s: num(descanso, 90),
    });
    onFechar();
  }

  return (
    <Sheet open={aberto} onOpenChange={(v: boolean) => !v && onFechar()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{exercicio.nome}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div>
            <Label>Como a carga é decidida</Label>
            <ChipGroup
              opcoes={TIPOS}
              valor={tipo}
              onChange={(v) => v && setTipo(v)}
              rotulo="Tipo de prescrição"
              colunas={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-series">Séries</Label>
              <Input id="p-series" inputMode="numeric" value={series}
                onChange={(e) => setSeries(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-descanso">Descanso (s)</Label>
              <Input id="p-descanso" inputMode="numeric" value={descanso}
                onChange={(e) => setDescanso(e.target.value)} />
            </div>
          </div>

          {tipo === "dupla" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="p-min">Reps mínimas</Label>
                  <Input id="p-min" inputMode="numeric" value={repsMin}
                    onChange={(e) => setRepsMin(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="p-max">Reps máximas</Label>
                  <Input id="p-max" inputMode="numeric" value={repsMax}
                    onChange={(e) => setRepsMax(e.target.value)} />
                </div>
              </div>
              <p className="t-caption">
                Bateu o máximo em todas as séries, a carga sobe sozinha no próximo treino.
              </p>
            </>
          )}

          {tipo === "fixa" && (
            <div>
              <Label htmlFor="p-reps">Repetições</Label>
              <Input id="p-reps" inputMode="numeric" value={repsMax}
                onChange={(e) => setRepsMax(e.target.value)} />
            </div>
          )}

          {tipo !== "531" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="p-peso">
                  {tipo === "dupla" ? "Peso de partida (kg)" : "Peso (kg)"}
                </Label>
                <Input id="p-peso" inputMode="decimal" value={peso}
                  onChange={(e) => setPeso(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="p-inc">Incremento (kg)</Label>
                <Input id="p-inc" inputMode="decimal" value={incremento}
                  onChange={(e) => setIncremento(e.target.value)} />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="p-tm">Training Max (kg)</Label>
                  <Input id="p-tm" inputMode="decimal" value={tm}
                    onChange={(e) => setTm(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="p-inc">Incremento (kg)</Label>
                  <Input id="p-inc" inputMode="decimal" value={incremento}
                    onChange={(e) => setIncremento(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Parte do corpo</Label>
                <ChipGroup
                  opcoes={PARTES}
                  valor={parte}
                  onChange={(v) => v && setParte(v)}
                  rotulo="Parte do corpo"
                  colunas={2}
                />
                <p className="t-caption mt-1">
                  Define quanto o Training Max sobe por ciclo: 2,5 kg no superior, 5 kg no inferior.
                </p>
              </div>
            </>
          )}
        </div>

        <SheetFooter>
          <Button block onClick={salvar}>Salvar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
