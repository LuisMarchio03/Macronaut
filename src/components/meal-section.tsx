import { Plus, X, RotateCcw } from "lucide-react";
import { Card } from "./ui/card";
import { FavoritarRefeicao } from "./favoritar-refeicao";
import {
  useTemplatesWithKcal,
  useAplicarTemplate,
  useDeleteTemplate,
} from "../hooks/use-meal-templates";
import { useFrequentes } from "../hooks/use-frequentes";
import { useAddEntry } from "../hooks/use-today-entries";
import { macrosDoEntry } from "../domain/nutrition";
import { formatarRegistro } from "../domain/medidas";
import { horaCurta } from "../lib/date";
import type { Food, FoodEntry, FoodMeasure, Meal } from "../domain/types";

export function MealSection({
  meal,
  entries,
  foods,
  measures,
  data,
  onAdd,
  onDelete,
  onEdit,
}: {
  meal: Meal | null;
  entries: FoodEntry[];
  foods: Map<number, Food> | undefined;
  measures?: Map<number, FoodMeasure[]>;
  data: string;
  onAdd: () => void;
  onDelete: (id: number) => void;
  onEdit: (e: FoodEntry) => void;
}) {
  const kcal = foods
    ? entries.reduce((s, e) => {
        const f = foods.get(e.food_id);
        return s + (f ? macrosDoEntry(f, e.qty_g).kcal : 0);
      }, 0)
    : 0;

  const nome = meal ? meal.nome : "Avulsas";
  const hora = meal?.horario ? horaCurta(meal.horario) : "";

  const { data: templates = [] } = useTemplatesWithKcal(meal?.id ?? null);
  const { ultima } = useFrequentes(meal?.id ?? null);
  const aplicarTemplate = useAplicarTemplate(data);
  const removerTemplate = useDeleteTemplate();
  const add = useAddEntry();

  async function repetirUltima() {
    if (!ultima) return;
    for (const i of ultima.itens) {
      await add.mutateAsync({
        data,
        meal_id: meal?.id ?? null,
        food_id: i.food_id,
        qty_g: i.qty_g,
        measure_id: i.measure_id,
        measure_count: i.measure_count,
        label: meal ? null : "Avulsa",
      });
    }
  }

  const temAtalhos = templates.length > 0 || ultima != null;

  return (
    <Card padded={false}>
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <h3 className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">
          {nome}
          {hora && <span className="t-caption ml-2 font-normal tabular-nums">{hora}</span>}
        </h3>
        <span className="t-caption shrink-0 tabular-nums">{Math.round(kcal)} kcal</span>
        {entries.length > 0 && (
          <FavoritarRefeicao
            mealId={meal?.id ?? null}
            entries={entries}
            sugestaoNome={meal ? `${meal.nome} padrão` : "Avulsa"}
          />
        )}
      </div>

      {entries.length > 0 ? (
        <ul className="mt-1">
          {entries.map((e) => {
            const f = foods?.get(e.food_id);
            return (
              <li key={e.id} className="flex items-center gap-1 px-2">
                <button
                  type="button"
                  onClick={() => onEdit(e)}
                  className="min-h-11 min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span className="block truncate">{f?.nome ?? "?"}</span>
                  <span className="t-caption block truncate tabular-nums">
                    {f
                      ? formatarRegistro(
                          e,
                          f,
                          measures?.get(e.food_id)?.find((m) => m.id === e.measure_id) ?? null,
                        )
                      : `${e.qty_g} g`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(e.id)}
                  aria-label={`Remover ${f?.nome ?? "item"}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="t-caption px-4 pt-1 pb-1">Nada registrado</p>
      )}

      {temAtalhos && (
        <div className="space-y-2 px-4 pt-3">
          {templates.length > 0 && (
            <div>
              <p className="t-caption mb-1.5">Favoritas</p>
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <span
                    key={t.id}
                    className="flex items-center overflow-hidden rounded-md border border-border"
                  >
                    <button
                      type="button"
                      aria-label={`aplicar template ${t.nome}`}
                      disabled={aplicarTemplate.isPending}
                      onClick={() =>
                        aplicarTemplate.mutate({ templateId: t.id, mealId: meal?.id ?? null })
                      }
                      className="min-h-10 px-3 py-1.5 text-left transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      <span className="block text-[0.8125rem] font-medium">{t.nome}</span>
                      <span className="t-caption block tabular-nums">{t.total_kcal} kcal</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`remover favorita ${t.nome}`}
                      disabled={removerTemplate.isPending}
                      onClick={() => removerTemplate.mutate(t.id)}
                      className="flex size-10 items-center justify-center border-l border-border text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {ultima && (
            <button
              type="button"
              onClick={repetirUltima}
              disabled={add.isPending}
              className="flex min-h-11 w-full items-center gap-2 rounded-md border border-border px-3 text-[0.8125rem] transition-colors hover:bg-muted disabled:opacity-50"
            >
              <RotateCcw className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="font-medium">Repetir</span>
              <span className="t-caption truncate tabular-nums">
                {ultima.data} · {ultima.itens.length}{" "}
                {ultima.itens.length === 1 ? "item" : "itens"}
              </span>
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onAdd}
        className="mt-2 flex min-h-12 w-full items-center gap-2 border-t border-border px-4 text-sm font-medium text-primary transition-colors hover:bg-muted"
      >
        <Plus className="size-4" aria-hidden />
        Adicionar alimento
      </button>
    </Card>
  );
}
