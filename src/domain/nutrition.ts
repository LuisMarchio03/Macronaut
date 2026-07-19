import type { Food, FoodEntry, Macros, Objetivo, RitmoEmagrecimento, Sexo } from "./types";

const AJUSTE_OBJETIVO: Record<Objetivo, number> = {
  bulk: 1.15,
  cut: 0.8,
  manutencao: 1.0,
};

const PROT_G_POR_KG: Record<Objetivo, number> = {
  cut: 2.2,
  manutencao: 2.0,
  bulk: 1.8,
};

const FRACAO_GORDURA = 0.25;

const DEFICIT_POR_RITMO: Record<RitmoEmagrecimento, number> = {
  leve: 275,
  moderado: 550,
  intenso: 825,
  agressivo: 1100,
};

const PERDA_KG_POR_RITMO: Record<RitmoEmagrecimento, number> = {
  leve: 0.25,
  moderado: 0.5,
  intenso: 0.75,
  agressivo: 1.0,
};

export function idade(dataNascimento: string, hoje: Date): number {
  const [ano, mes, dia] = dataNascimento.split("-").map(Number);
  let anos = hoje.getUTCFullYear() - ano;
  const mesAtual = hoje.getUTCMonth() + 1;
  const diaAtual = hoje.getUTCDate();
  if (mesAtual < mes || (mesAtual === mes && diaAtual < dia)) anos--;
  return anos;
}

export function tmbMifflinStJeor(p: {
  sexo: Sexo;
  peso_kg: number;
  altura_cm: number;
  idade: number;
}): number {
  const base = 10 * p.peso_kg + 6.25 * p.altura_cm - 5 * p.idade;
  return p.sexo === "M" ? base + 5 : base - 161;
}

export function gastoEnergetico(tmb: number, fator: number): number {
  return tmb * fator;
}

export function ajustePorObjetivo(get: number, objetivo: Objetivo): number {
  return Math.round(get * AJUSTE_OBJETIVO[objetivo]);
}

export function splitMacros(kcal: number, peso_kg: number, objetivo: Objetivo): Macros {
  const prot_g = peso_kg * PROT_G_POR_KG[objetivo];
  const gord_g = (kcal * FRACAO_GORDURA) / 9;
  const carb_g = (kcal - prot_g * 4 - gord_g * 9) / 4;
  return {
    kcal,
    prot_g: Math.round(prot_g),
    carb_g: Math.round(carb_g),
    gord_g: Math.round(gord_g),
  };
}

export function macrosDoEntry(food: Food, qty_g: number): Macros {
  const f = qty_g / food.base_qty_g;
  return {
    kcal: food.kcal * f,
    prot_g: food.prot_g * f,
    carb_g: food.carb_g * f,
    gord_g: food.gord_g * f,
  };
}

export function totaisDoDia(entries: FoodEntry[], foodsById: Map<number, Food>): Macros {
  return entries.reduce<Macros>(
    (acc, e) => {
      const food = foodsById.get(e.food_id);
      if (!food) return acc;
      const m = macrosDoEntry(food, e.qty_g);
      return {
        kcal: acc.kcal + m.kcal,
        prot_g: acc.prot_g + m.prot_g,
        carb_g: acc.carb_g + m.carb_g,
        gord_g: acc.gord_g + m.gord_g,
      };
    },
    { kcal: 0, prot_g: 0, carb_g: 0, gord_g: 0 },
  );
}

export function restante(meta: Macros, consumido: Macros): Macros {
  return {
    kcal: meta.kcal - consumido.kcal,
    prot_g: meta.prot_g - consumido.prot_g,
    carb_g: meta.carb_g - consumido.carb_g,
    gord_g: meta.gord_g - consumido.gord_g,
  };
}

/* ── Emagrecimento / Weight Loss ── */

export function deficitDiario(ritmo: RitmoEmagrecimento): number {
  return DEFICIT_POR_RITMO[ritmo];
}

export function perdaSemanal(ritmo: RitmoEmagrecimento): number {
  return PERDA_KG_POR_RITMO[ritmo];
}

export function metaKcalCut(tdee: number, ritmo: RitmoEmagrecimento): number {
  return Math.max(tdee - DEFICIT_POR_RITMO[ritmo], 1200);
}

export function tempoParaObjetivo(
  pesoAtualKg: number,
  pesoMetaKg: number,
  ritmo: RitmoEmagrecimento,
): number {
  const diferenca = pesoAtualKg - pesoMetaKg;
  if (diferenca <= 0) return 0;
  return Math.ceil(diferenca / PERDA_KG_POR_RITMO[ritmo]);
}

export function splitMacrosCut(
  kcal: number,
  pesoKg: number,
  ritmo: RitmoEmagrecimento,
): Macros {
  const protPorKg = ritmo === "agressivo" ? 2.8 : ritmo === "intenso" ? 2.6 : 2.4;
  const prot_g = pesoKg * protPorKg;
  const gordMin_g = pesoKg * 0.8;
  const gord_g = Math.max(Math.round((kcal * FRACAO_GORDURA) / 9), Math.round(gordMin_g));
  const carb_g = (kcal - prot_g * 4 - gord_g * 9) / 4;
  return {
    kcal: Math.round(kcal),
    prot_g: Math.round(prot_g),
    carb_g: Math.round(Math.max(carb_g, 0)),
    gord_g: Math.round(gord_g),
  };
}
