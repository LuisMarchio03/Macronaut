import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { rotuloRir } from "@/domain/treino";
import type { TipoSerie } from "@/domain/types";
import type { PlanoSerie } from "@/repositories/sessao";

const TIPOS = [
  { valor: "aquecimento" as const, label: "Aquec.", descricao: "Aquecimento" },
  { valor: "valida" as const, label: "Válida", descricao: "Série válida" },
  { valor: "drop" as const, label: "Drop", descricao: "Drop set" },
  { valor: "falha" as const, label: "Falha", descricao: "Até a falha" },
];

const RIRS = [0, 1, 2, 3, 4].map((r) => ({
  valor: r,
  label: rotuloRir(r),
  descricao: `RIR ${rotuloRir(r)}`,
}));

/**
 * O escape da tela da academia: quando hoje não foi como o plano dizia.
 *
 * Começa preenchido com o prescrito — quem abre para mudar uma coisa só não
 * deve ter que redigitar as outras duas.
 */
export function SheetAjustarSerie({
  aberto,
  onFechar,
  serie,
  onRegistrar,
}: {
  aberto: boolean;
  onFechar: () => void;
  serie: PlanoSerie | null;
  onRegistrar: (v: {
    reps: number; peso_kg: number; tipo: TipoSerie; rir: number | null; nota: string | null;
  }) => void;
}) {
  const [reps, setReps] = useState("");
  const [peso, setPeso] = useState("");
  const [tipo, setTipo] = useState<TipoSerie>("valida");
  const [rir, setRir] = useState<number | null>(null);
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (!serie) return;
    setReps(String(serie.reps_feitas ?? serie.reps_alvo));
    setPeso(String(serie.peso_feito_kg ?? serie.peso_kg));
    setTipo(serie.tipo);
    setRir(null);
    setNota("");
  }, [serie]);

  if (!serie) return null;

  const numero = (s: string, padrao: number) => {
    const n = Number(s.replace(",", "."));
    return s.trim() === "" || Number.isNaN(n) ? padrao : n;
  };

  return (
    <Sheet open={aberto} onOpenChange={(v: boolean) => !v && onFechar()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>
            {serie.nome} · série {serie.serie_ordem}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="a-reps">Reps</Label>
              <Input id="a-reps" inputMode="numeric" value={reps}
                onChange={(e) => setReps(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="a-peso">Peso (kg)</Label>
              <Input id="a-peso" inputMode="decimal" value={peso}
                onChange={(e) => setPeso(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Tipo</Label>
            <ChipGroup opcoes={TIPOS} valor={tipo} onChange={(v) => v && setTipo(v)}
              rotulo="Tipo da série" colunas={4} />
          </div>

          <div>
            <Label>RIR (opcional)</Label>
            <ChipGroup opcoes={RIRS} valor={rir} onChange={setRir}
              rotulo="Repetições em reserva" desmarcavel colunas={5} />
          </div>

          <div>
            <Label htmlFor="a-nota">Nota (opcional)</Label>
            <Input id="a-nota" value={nota} placeholder="ombro incomodou"
              onChange={(e) => setNota(e.target.value)} />
          </div>
        </div>

        <SheetFooter>
          <Button
            block
            onClick={() => {
              onRegistrar({
                reps: numero(reps, serie.reps_alvo),
                peso_kg: numero(peso, serie.peso_kg),
                tipo,
                rir,
                nota: nota.trim() || null,
              });
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
