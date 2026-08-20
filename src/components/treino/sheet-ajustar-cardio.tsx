import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { estimativaKcal } from "@/domain/treino";
import type { PlanoSerie } from "@/repositories/sessao";

/**
 * O escape do cardio: quando você pedalou 22 dos 30 minutos prescritos.
 *
 * As séries de peso já tinham o seu (`SheetAjustarSerie`); a bike não tinha
 * nenhum, e registrava sempre o prescrito — mandando a kcal errada para o
 * balanço energético do dia, que é justamente o número que o cardio existe
 * para alimentar.
 *
 * A caloria não é um campo: ela sai do MET do exercício e do seu peso, a mesma
 * conta de sempre. Deixar digitar kcal à mão criaria dois números que podem
 * discordar sobre o mesmo treino.
 */
export function SheetAjustarCardio({
  aberto,
  onFechar,
  serie,
  peso_kg,
  onRegistrar,
}: {
  aberto: boolean;
  onFechar: () => void;
  serie: PlanoSerie | null;
  peso_kg: number | null;
  onRegistrar: (v: { duracao_min: number; kcal: number }) => void;
}) {
  const [duracao, setDuracao] = useState("");

  // Abrir para outro item precisa recarregar o campo; e o valor de partida é o
  // que já foi feito quando já foi, não o prescrito.
  useEffect(() => {
    if (!serie) return;
    setDuracao(String(serie.duracao_feita_min ?? serie.duracao_min ?? 0));
  }, [serie]);

  if (!serie) return null;

  const n = Number(duracao.replace(",", "."));
  const min = duracao.trim() === "" || Number.isNaN(n) ? (serie.duracao_min ?? 0) : n;
  const kcal =
    peso_kg !== null && serie.met !== null
      ? Math.round(estimativaKcal(serie.met, peso_kg, min))
      : 0;

  return (
    <Sheet open={aberto} onOpenChange={(v: boolean) => !v && onFechar()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{serie.nome}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div>
            <Label htmlFor="c-duracao">Duração (min)</Label>
            <Input
              id="c-duracao"
              inputMode="numeric"
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
            />
          </div>

          <p className="t-caption tabular-nums">
            {peso_kg === null
              ? "Defina seu peso nas metas para estimar as calorias."
              : serie.met === null
                ? "Este exercício não tem MET no catálogo, então não dá para estimar as calorias."
                : `≈ ${kcal} kcal · ${serie.met} MET × ${peso_kg} kg`}
          </p>
        </div>

        <SheetFooter>
          <Button
            block
            disabled={min <= 0}
            onClick={() => {
              onRegistrar({ duracao_min: min, kcal });
              onFechar();
            }}
          >
            Registrar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
