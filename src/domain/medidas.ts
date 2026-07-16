import type { Food, FoodEntry, FoodMeasure, FoodUnit } from "./types";

export function resolverQtdBase(qtyBasePorMedida: number, count: number): number {
  return qtyBasePorMedida * count;
}

export function rotuloUnidade(u: FoodUnit): string {
  return u; // "g" | "ml" | "un" já são os rótulos curtos
}

export function formatarNumero(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

export function pluralizar(nome: string, count: number): string {
  if (count === 1) return nome;
  if (nome.includes(" ")) return nome; // evita "colher de sopas"
  return nome.endsWith("s") ? nome : `${nome}s`;
}

export function formatarRegistro(
  entry: FoodEntry,
  food: Food,
  measure?: FoodMeasure | null,
): string {
  const unidade = rotuloUnidade(food.base_unit);
  const qtd = `${formatarNumero(entry.qty_g)} ${unidade}`;
  if (measure && entry.measure_count != null) {
    const n = formatarNumero(entry.measure_count);
    return `${n} ${pluralizar(measure.nome, entry.measure_count)} (${qtd})`;
  }
  return qtd;
}
