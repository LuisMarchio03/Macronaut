import { useState } from "react";
import { DateNav } from "@/components/date-nav";
import { SectionCard } from "@/components/ui/section-card";
import { SkeletonCard } from "@/components/ui/skeleton";
import { MacroBars } from "@/components/macro-bars";
import { MealSection } from "@/components/meal-section";
import { AddFoodSheet } from "@/components/add-food-sheet";
import { WaterCounter } from "@/components/water-counter";
import { useProfile } from "@/hooks/use-profile";
import { useMeals } from "@/hooks/use-meals";
import { useTodayEntries, useFoodsForEntries, useDeleteEntry } from "@/hooks/use-today-entries";
import { useMeasuresByFoodIds } from "@/hooks/use-food-measures";
import { totaisDoDia } from "@/domain/nutrition";
import { formatarData } from "@/lib/date";
import { useDataAtiva } from "@/lib/data-context";
import type { Food, FoodEntry, Macros } from "@/domain/types";

export function Nutricao() {
  const { data } = useDataAtiva();
  const perfil = useProfile();
  const { data: entries = [] } = useTodayEntries(data);
  const { data: foods } = useFoodsForEntries(entries);
  const { data: measures } = useMeasuresByFoodIds(entries.map((e) => e.food_id));
  const { data: meals = [] } = useMeals();
  const [sheetMeal, setSheetMeal] = useState<number | null | "fechado">("fechado");
  const [editando, setEditando] = useState<{ entry: FoodEntry; food: Food } | null>(null);
  const del = useDeleteEntry(data);

  const meta: Macros = perfil.data
    ? {
        kcal: perfil.data.meta_kcal,
        prot_g: perfil.data.meta_prot_g,
        carb_g: perfil.data.meta_carb_g,
        gord_g: perfil.data.meta_gord_g,
      }
    : { kcal: 0, prot_g: 0, carb_g: 0, gord_g: 0 };

  const consumido: Macros = foods
    ? totaisDoDia(entries, foods)
    : { kcal: 0, prot_g: 0, carb_g: 0, gord_g: 0 };

  const entriesDe = (mealId: number | null) =>
    entries.filter((e) => e.meal_id === mealId);

  const abrirEdicao = (e: FoodEntry) => {
    const f = foods?.get(e.food_id);
    if (f) setEditando({ entry: e, food: f });
  };

  if (perfil.isLoading) {
    return (
      <div className="space-y-4 p-4">
        <header className="space-y-1 pt-2">
          <p className="section-title">Nutrição</p>
          <h1 className="text-2xl font-semibold tracking-tight">Nutrição</h1>
        </header>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <header className="space-y-1 pt-2">
        <p className="section-title">Nutrição</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {formatarData(data)}
        </h1>
        <div className="pt-1">
          <DateNav />
        </div>
      </header>

      <SectionCard variant="gradient" header="Macros do dia" aside={`${Math.round(consumido.kcal)} / ${Math.round(meta.kcal)} kcal`}>
        <MacroBars consumido={consumido} meta={meta} />
      </SectionCard>

      <WaterCounter data={data} />

      <div className="space-y-3">
        <div className="section-header">
          <span className="section-title">Refeições</span>
        </div>
        {meals.map((m) => (
          <MealSection
            key={m.id}
            meal={m}
            entries={entriesDe(m.id)}
            foods={foods}
            measures={measures}
            data={data}
            onAdd={() => setSheetMeal(m.id)}
            onDelete={(id) => del.mutate(id)}
            onEdit={abrirEdicao}
          />
        ))}
        <MealSection
          meal={null}
          entries={entriesDe(null)}
          foods={foods}
          measures={measures}
          data={data}
          onAdd={() => setSheetMeal(null)}
          onDelete={(id) => del.mutate(id)}
          onEdit={abrirEdicao}
        />
      </div>

      {sheetMeal !== "fechado" && (
        <AddFoodSheet
          data={data}
          mealId={sheetMeal}
          open
          onClose={() => setSheetMeal("fechado")}
        />
      )}

      {editando && (
        <AddFoodSheet
          data={data}
          mealId={editando.entry.meal_id}
          open
          entryEdit={editando}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}