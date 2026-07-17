import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { useMeasures, useCreateMeasure, useDeleteMeasure } from "../hooks/use-food-measures";
import { formatarNumero } from "../domain/medidas";
import type { FoodUnit } from "../domain/types";

/**
 * CRUD de medidas caseiras de um alimento. Na maioria dos casos as medidas já
 * vêm da POF e o usuário só confere — este editor é o fallback de "caso ele
 * não encontre, aí sim eu faço na mão" (spec, seção 1).
 */
export function EditorMedidas({ foodId, baseUnit }: { foodId: number; baseUnit: FoodUnit }) {
  const [nome, setNome] = useState("");
  const [qtd, setQtd] = useState("");
  const { data: medidas = [] } = useMeasures(foodId);
  const criar = useCreateMeasure();
  const remover = useDeleteMeasure();

  const qtdN = Number(qtd);
  const valido = nome.trim().length > 0 && qtdN > 0;

  async function adicionar() {
    if (!valido) return;
    await criar.mutateAsync({
      food_id: foodId, nome: nome.trim().toLowerCase(), qty_base: qtdN,
      ordem: medidas.length, source: "manual", status: "confirmada", pof_codigo: null,
      pof_descricao: null,
    });
    setNome(""); setQtd("");
  }

  return (
    <div className="space-y-2">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-primary/70">
        Medidas caseiras
      </p>

      <ul className="space-y-0.5">
        {medidas.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm">
            <span className="flex-1 truncate">
              {m.nome}{" "}
              <span className="font-mono text-xs text-muted-foreground">
                · {formatarNumero(m.qty_base)} {baseUnit}
              </span>
              {m.source === "pof" && (
                <span className="ml-1 font-mono text-[0.6rem] uppercase text-primary/60">ibge</span>
              )}
            </span>
            {m.source === "manual" && (
              <button
                type="button"
                onClick={() => remover.mutate(m.id)}
                aria-label={`remover ${m.nome}`}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            )}
          </li>
        ))}
        {medidas.length === 0 && (
          <li className="px-2 py-1 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
            Nenhuma medida — registro será em {baseUnit}
          </li>
        )}
      </ul>

      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <div>
          <Label htmlFor="medida-nome">Nome da medida</Label>
          <Input
            id="medida-nome" value={nome} placeholder="fatia, colher, concha…"
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="medida-qtd">Equivale a ({baseUnit})</Label>
          <Input
            id="medida-qtd" inputMode="decimal" value={qtd} className="w-24"
            onChange={(e) => setQtd(e.target.value)}
          />
        </div>
      </div>
      <Button
        variant="secondary" size="sm" onClick={adicionar}
        disabled={!valido || criar.isPending}
      >
        Adicionar medida
      </Button>
    </div>
  );
}
