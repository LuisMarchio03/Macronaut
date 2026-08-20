import { Pencil, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "./ui/sheet";
import { useMeasures } from "../hooks/use-food-measures";
import { macrosDoEntry } from "../domain/nutrition";
import { formatarNumero, rotuloUnidade } from "../domain/medidas";
import type { Food } from "../domain/types";

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="t-caption">{rotulo}</span>
      <span className="text-sm font-medium tabular-nums">{valor}</span>
    </div>
  );
}

/**
 * A ficha de um alimento.
 *
 * Junta o que já estava no banco e não estava em tela nenhuma: fibra, sódio,
 * categoria, e — o mais importante — as medidas caseiras com o peso e a
 * caloria de CADA uma. "Quanto tem uma unidade" é a pergunta que decide a
 * porção; ela só aparecia dentro do fluxo de registrar, quando já era tarde
 * para consultar.
 */
export function SheetAlimento({
  aberto,
  onFechar,
  food,
  onEditar,
  onExcluir,
}: {
  aberto: boolean;
  onFechar: () => void;
  food: Food | null;
  onEditar: (f: Food) => void;
  onExcluir: (f: Food) => void;
}) {
  const { data: medidas = [] } = useMeasures(food?.id ?? null);
  if (!food) return null;

  const unidade = rotuloUnidade(food.base_unit);
  const porBase = `por ${formatarNumero(food.base_qty_g)} ${unidade}`;

  return (
    <Sheet open={aberto} onOpenChange={(v: boolean) => !v && onFechar()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{food.nome}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          <p className="t-caption">
            {[food.marca, food.categoria, food.source === "taco" ? "tabela TACO" : "seu alimento"]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <div>
            <h3 className="t-section">Nutrientes {porBase}</h3>
            <div className="mt-1 divide-y divide-border">
              <Linha rotulo="Calorias" valor={`${Math.round(food.kcal)} kcal`} />
              <Linha rotulo="Proteína" valor={`${formatarNumero(food.prot_g)} g`} />
              <Linha rotulo="Carboidrato" valor={`${formatarNumero(food.carb_g)} g`} />
              <Linha rotulo="Gordura" valor={`${formatarNumero(food.gord_g)} g`} />
              {food.fibra_g !== null && (
                <Linha rotulo="Fibra" valor={`${formatarNumero(food.fibra_g)} g`} />
              )}
              {food.sodio_mg !== null && (
                <Linha rotulo="Sódio" valor={`${Math.round(food.sodio_mg)} mg`} />
              )}
            </div>
          </div>

          <div>
            <h3 className="t-section">Medidas caseiras</h3>
            {medidas.length > 0 ? (
              <ul className="mt-1 divide-y divide-border">
                {medidas.map((m) => (
                  <li key={m.id} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate text-sm">1 {m.nome}</span>
                    <span className="t-caption shrink-0 tabular-nums">
                      {formatarNumero(m.qty_base)} {unidade} ·{" "}
                      {Math.round(macrosDoEntry(food, m.qty_base).kcal)} kcal
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-caption mt-1">
                Nenhuma medida caseira cadastrada — o registro vai pela unidade base.
              </p>
            )}
          </div>
        </div>

        {food.source === "custom" && (
          <SheetFooter>
            <Button variant="outline" block onClick={() => onEditar(food)}>
              <Pencil className="size-4" />
              Editar
            </Button>
            <Button variant="destructive-ghost" block onClick={() => onExcluir(food)}>
              <Trash2 className="size-4" />
              Excluir
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
