import { resolverQtdBase } from "./medidas";
import type { Food, FoodMeasure } from "./types";

export interface Sugestao {
  measure: FoodMeasure | null;  // null = registrar direto na unidade base
  count: number;
  qty_g: number;                // sempre preenchido: é o que o cálculo usa
}

/**
 * A porção que o registro abre pré-preenchida. A regra que faz a tela dizer
 * "1 fatia" em vez de "100" — grama é detalhe de implementação, não o modelo
 * mental do usuário (ver spec, seção 1).
 *
 * Ordem: default_measure_id → menor `ordem` → unidade base.
 *
 * Base 'un' sem medida sugere 1 unidade (não 100): "100 ovos" seria absurdo.
 * Base 'g'/'ml' sem medida sugere `base_qty_g` (tipicamente 100), que é o
 * comportamento de hoje.
 */
export function sugerirPorcao(food: Food, measures: FoodMeasure[]): Sugestao {
  // Só medidas 'confirmada': uma 'candidata' escolhida por menor `ordem` seria
  // escolha pela ordem do CSV do IBGE — o erro silencioso que a chave composta
  // mata uma camada acima. A tela já desambigua antes de chamar isto (guard
  // `precisaDesambiguar`); este filtro é a garantia não depender do chamador.
  const usaveis = measures.filter((m) => m.status === "confirmada");

  const escolhida =
    usaveis.find((m) => m.id === food.default_measure_id) ??
    [...usaveis].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))[0];

  if (escolhida) {
    return { measure: escolhida, count: 1, qty_g: resolverQtdBase(escolhida.qty_base, 1) };
  }

  const qty_g = food.base_unit === "un" ? 1 : food.base_qty_g;
  return { measure: null, count: qty_g, qty_g };
}
