import { macrosDoEntry } from "./nutrition";
import type { Food, FoodEntry, Macros } from "./types";

export function totaisPorDia(
  entries: FoodEntry[],
  foodsById: Map<number, Food>,
): Map<string, Macros> {
  const m = new Map<string, Macros>();
  for (const e of entries) {
    const food = foodsById.get(e.food_id);
    if (!food) continue;
    const dm = macrosDoEntry(food, e.qty_g);
    const acc = m.get(e.data) ?? { kcal: 0, prot_g: 0, carb_g: 0, gord_g: 0 };
    m.set(e.data, {
      kcal: acc.kcal + dm.kcal,
      prot_g: acc.prot_g + dm.prot_g,
      carb_g: acc.carb_g + dm.carb_g,
      gord_g: acc.gord_g + dm.gord_g,
    });
  }
  return m;
}

export type ResumoNutricional = {
  mediaKcal: number;
  mediaProt: number;
  mediaCarb: number;
  mediaGord: number;
  diasRegistrados: number;
  diasNoPeriodo: number;
  aderenciaKcalPct: number;
  diasDentroMeta: number;
};

export function resumoNutricional(
  totais: Map<string, Macros>,
  meta: Macros,
  diasNoPeriodo: number,
): ResumoNutricional {
  let sK = 0, sP = 0, sC = 0, sG = 0, diasDentroMeta = 0;
  for (const t of totais.values()) {
    sK += t.kcal; sP += t.prot_g; sC += t.carb_g; sG += t.gord_g;
    if (meta.kcal > 0 && t.kcal >= meta.kcal * 0.9 && t.kcal <= meta.kcal * 1.1) diasDentroMeta++;
  }
  const div = diasNoPeriodo > 0 ? diasNoPeriodo : 1;
  const mediaKcal = sK / div;
  return {
    mediaKcal,
    mediaProt: sP / div,
    mediaCarb: sC / div,
    mediaGord: sG / div,
    diasRegistrados: totais.size,
    diasNoPeriodo,
    aderenciaKcalPct: meta.kcal > 0 ? Math.round((mediaKcal / meta.kcal) * 100) : 0,
    diasDentroMeta,
  };
}
