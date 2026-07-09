import { useState } from "react";
import { Link } from "react-router-dom";
import { Bot } from "lucide-react";
import { CalorieRing } from "../components/calorie-ring";
import { MacroBars } from "../components/macro-bars";
import { WaterCounter } from "../components/water-counter";
import { MealSection } from "../components/meal-section";
import { AddFoodSheet } from "../components/add-food-sheet";
import { HudPanel } from "../components/ui/hud-panel";
import { useProfile } from "../hooks/use-profile";
import { useMeals } from "../hooks/use-meals";
import {
  useTodayEntries, useFoodsForEntries, useDeleteEntry,
} from "../hooks/use-today-entries";
import { useAiConfig } from "../hooks/use-ai-config";
import { totaisDoDia } from "../domain/nutrition";
import { hoje, formatarData } from "../lib/date";
import type { Macros } from "../domain/types";

export function Dashboard() {
  const data = hoje();
  const { data: perfil, isLoading } = useProfile();
  const { data: entries = [] } = useTodayEntries(data);
  const { data: foods } = useFoodsForEntries(entries);
  const { data: meals = [] } = useMeals();
  const del = useDeleteEntry(data);
  const { data: aiConfig } = useAiConfig();
  const [sheetMeal, setSheetMeal] = useState<number | null | "fechado">("fechado");

  if (isLoading) return <div className="p-4">Carregando…</div>;

  if (!perfil) {
    return (
      <div className="p-4 space-y-3 text-center">
        <p>Você ainda não definiu suas metas.</p>
        <Link to="/metas" className="text-primary underline">Definir metas</Link>
      </div>
    );
  }

  const consumido: Macros = foods
    ? totaisDoDia(entries, foods)
    : { kcal: 0, prot_g: 0, carb_g: 0, gord_g: 0 };
  const meta: Macros = {
    kcal: perfil.meta_kcal, prot_g: perfil.meta_prot_g,
    carb_g: perfil.meta_carb_g, gord_g: perfil.meta_gord_g,
  };

  const entriesDe = (mealId: number | null) => entries.filter((e) => e.meal_id === mealId);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const pctKcal = meta.kcal > 0 ? Math.round((consumido.kcal / meta.kcal) * 100) : 0;

  return (
    <div className="space-y-6 p-4">
      <header className="space-y-1 pt-1">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-primary/70">
          {saudacao} · painel diário
        </p>
        <h1 className="text-2xl font-semibold capitalize tracking-tight">{formatarData(data)}</h1>
        {aiConfig && (aiConfig.aloy_enabled || aiConfig.gemini_enabled) && (
          <Link
            to="/ia"
            className="mt-2 inline-flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-primary/80 hover:text-primary"
          >
            <Bot className="size-3.5" /> Falar com a IA
          </Link>
        )}
      </header>

      <HudPanel
        label="Métricas · Hoje"
        aside={`[ ${pctKcal}% ]`}
        glow
        scanlines
        bodyClassName="space-y-5 p-5"
      >
        <CalorieRing consumido={consumido.kcal} meta={meta.kcal} />
        <div className="h-px bg-border/50" />
        <MacroBars consumido={consumido} meta={meta} />
      </HudPanel>

      <WaterCounter data={data} />

      <div className="space-y-2">
        <h2 className="px-1 font-mono text-[0.62rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Refeições
        </h2>
        <div className="space-y-3">
          {meals.map((m) => (
            <MealSection key={m.id} meal={m} entries={entriesDe(m.id)} foods={foods}
              onAdd={() => setSheetMeal(m.id)} onDelete={(id) => del.mutate(id)} />
          ))}
          <MealSection meal={null} entries={entriesDe(null)} foods={foods}
            onAdd={() => setSheetMeal(null)} onDelete={(id) => del.mutate(id)} />
        </div>
      </div>

      {sheetMeal !== "fechado" && (
        <AddFoodSheet data={data} mealId={sheetMeal} open
          onClose={() => setSheetMeal("fechado")} />
      )}
    </div>
  );
}
