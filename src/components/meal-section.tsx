import { Plus, X } from "lucide-react";
import { Button } from "./ui/button";
import { HudPanel } from "./ui/hud-panel";
import { FavoritarRefeicao } from "./favoritar-refeicao";
import { useTemplates, useAplicarTemplate, useDeleteTemplate } from "../hooks/use-meal-templates";
import { useFrequentes } from "../hooks/use-frequentes";
import { useAddEntry } from "../hooks/use-today-entries";
import { macrosDoEntry } from "../domain/nutrition";
import { formatarRegistro } from "../domain/medidas";
import type { Food, FoodEntry, FoodMeasure, Meal } from "../domain/types";

export function MealSection({
  meal, entries, foods, measures, data, onAdd, onDelete, onEdit,
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
  const label = meal?.horario ? `${nome} · ${meal.horario}` : nome;

  const { data: templates = [] } = useTemplates(meal?.id ?? null);
  const { ultima } = useFrequentes(meal?.id ?? null);
  const aplicarTemplate = useAplicarTemplate(data);
  const removerTemplate = useDeleteTemplate();
  const add = useAddEntry();
  const vazia = entries.length === 0;

  async function repetirUltima() {
    if (!ultima) return;
    for (const i of ultima.itens) {
      await add.mutateAsync({
        data, meal_id: meal?.id ?? null, food_id: i.food_id, qty_g: i.qty_g,
        measure_id: i.measure_id, measure_count: i.measure_count,
        label: meal ? null : "Avulsa",
      });
    }
  }

  return (
    <HudPanel
      label={label}
      aside={
        <span className="flex items-center gap-2">
          {`${Math.round(kcal)} kcal`}
          {!vazia && (
            <FavoritarRefeicao
              mealId={meal?.id ?? null} entries={entries}
              sugestaoNome={meal ? `${meal.nome} padrão` : "Avulsa"}
            />
          )}
        </span>
      }
      bodyClassName="space-y-1"
    >
      <ul className="space-y-0.5">
        {entries.map((e) => {
          const f = foods?.get(e.food_id);
          return (
            <li
              key={e.id}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
            >
              <button
                type="button"
                onClick={() => onEdit(e)}
                className="flex-1 truncate text-left hover:text-primary"
              >
                {f?.nome ?? "?"}{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  ·{" "}
                  {f
                    ? formatarRegistro(
                        e, f,
                        measures?.get(e.food_id)?.find((m) => m.id === e.measure_id) ?? null,
                      )
                    : `${e.qty_g} g`}
                </span>
              </button>
              <button
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                onClick={() => onDelete(e.id)}
                aria-label="remover"
              >
                <X className="size-3.5" />
              </button>
            </li>
          );
        })}
        {entries.length === 0 && (
          <li className="px-2 py-1 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
            Nada registrado
          </li>
        )}
      </ul>
      {vazia && (templates.length > 0 || ultima) && (
        <div className="space-y-1 px-2 pb-1">
          {templates.length > 0 && (
            <>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-primary/70">Favoritas</p>
              <div className="flex flex-wrap gap-1.5">
                {templates.map((t) => (
                  <span
                    key={t.id}
                    className="flex items-center gap-1 rounded-md border border-border/60 pl-2 text-xs transition-colors hover:border-primary/60"
                  >
                    <button
                      type="button"
                      disabled={aplicarTemplate.isPending}
                      onClick={() => aplicarTemplate.mutate({ templateId: t.id, mealId: meal?.id ?? null })}
                      className="py-1 hover:text-primary"
                    >
                      {t.nome}
                    </button>
                    <button
                      type="button"
                      aria-label={`remover favorita ${t.nome}`}
                      disabled={removerTemplate.isPending}
                      onClick={() => removerTemplate.mutate(t.id)}
                      className="flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            </>
          )}
          {ultima && (
            <button
              type="button" onClick={repetirUltima} disabled={add.isPending}
              className="w-full rounded-md border border-border/60 px-2 py-1.5 text-left text-xs transition-colors hover:border-primary/60 hover:bg-primary/10"
            >
              repetir{" "}
              <span className="font-mono text-muted-foreground">
                {ultima.data} · {ultima.itens.length} {ultima.itens.length === 1 ? "item" : "itens"}
              </span>
            </button>
          )}
        </div>
      )}
      <Button variant="ghost" size="sm" onClick={onAdd} className="w-full justify-start">
        <Plus className="size-4" /> adicionar alimento
      </Button>
    </HudPanel>
  );
}
