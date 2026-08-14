import { useState } from "react";
import { DateNav } from "@/components/date-nav";
import { Card } from "@/components/ui/card";
import { Page, PageHeader, SectionLabel } from "@/components/ui/page";
import { SkeletonCard, SkeletonMeal } from "@/components/ui/skeleton";
import { EnergySummary } from "@/components/energy-summary";
import { MealSection } from "@/components/meal-section";
import { AddFoodSheet } from "@/components/add-food-sheet";
import { WaterCounter, META_AGUA_ML } from "@/components/water-counter";
import { useProfile } from "@/hooks/use-profile";
import { useMeals } from "@/hooks/use-meals";
import { useTodayEntries, useFoodsForEntries, useDeleteEntry } from "@/hooks/use-today-entries";
import { useMeasuresByFoodIds } from "@/hooks/use-food-measures";
import { useBlocos, usePlanoAtivo } from "@/hooks/use-plano";
import { totaisDoDia } from "@/domain/nutrition";
import { metaDeAgua } from "@/domain/plano-dia";
import { useDataAtiva } from "@/lib/data-context";
import type { Food, FoodEntry, Macros } from "@/domain/types";

const ZERO: Macros = { kcal: 0, prot_g: 0, carb_g: 0, gord_g: 0 };

export function Nutricao() {
  const { data } = useDataAtiva();
  const perfil = useProfile();
  const { data: entries = [] } = useTodayEntries(data);
  const { data: foods } = useFoodsForEntries(entries);
  const { data: measures } = useMeasuresByFoodIds(entries.map((e) => e.food_id));
  const { data: meals = [] } = useMeals();
  const { data: plano } = usePlanoAtivo();
  const { data: blocos = [] } = useBlocos(plano?.id);

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
    : ZERO;

  const consumido: Macros = foods ? totaisDoDia(entries, foods) : ZERO;

  const faixaKcal =
    plano?.kcal_min != null && plano?.kcal_max != null && plano.kcal_min !== plano.kcal_max
      ? { min: plano.kcal_min, max: plano.kcal_max }
      : null;

  // A meta de água vem do plano quando existe; senão, do padrão do app.
  const alvoAgua = plano ? metaDeAgua(blocos, plano.agua_ml_alvo) : META_AGUA_ML;

  const entriesDe = (mealId: number | null) => entries.filter((e) => e.meal_id === mealId);

  const abrirEdicao = (e: FoodEntry) => {
    const f = foods?.get(e.food_id);
    if (f) setEditando({ entry: e, food: f });
  };

  if (perfil.isLoading) {
    return (
      <Page>
        <SkeletonCard />
        <SkeletonMeal />
        <SkeletonMeal />
      </Page>
    );
  }

  return (
    <Page>
      {/* O seletor abaixo já diz que dia é este; repetir a data no título era
          a mesma informação duas vezes na mesma dobra. */}
      <PageHeader title="Nutrição">
        <DateNav />
      </PageHeader>

      <Card tone="primary">
        <EnergySummary consumido={consumido} meta={meta} faixa={faixaKcal} />
      </Card>

      <WaterCounter data={data} meta={alvoAgua} />

      <div className="space-y-2">
        <SectionLabel>Refeições</SectionLabel>
        <div className="space-y-2">
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
    </Page>
  );
}
