import { Plus, X } from "lucide-react";
import { Button } from "./ui/button";
import { HudPanel } from "./ui/hud-panel";
import { macrosDoEntry } from "../domain/nutrition";
import type { Food, FoodEntry, Meal } from "../domain/types";

export function MealSection({
  meal, entries, foods, onAdd, onDelete, onEdit,
}: {
  meal: Meal | null;
  entries: FoodEntry[];
  foods: Map<number, Food> | undefined;
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

  return (
    <HudPanel label={label} aside={`${Math.round(kcal)} kcal`} bodyClassName="space-y-1">
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
                <span className="font-mono text-xs text-muted-foreground">· {e.qty_g}g</span>
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
      <Button variant="ghost" size="sm" onClick={onAdd} className="w-full justify-start">
        <Plus className="size-4" /> adicionar alimento
      </Button>
    </HudPanel>
  );
}
