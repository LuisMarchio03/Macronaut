import type { FoodEntry } from "./types";

export interface UsoFrequente {
  food_id: number;
  vezes: number;
  /** Medida/quantidade do uso MAIS RECENTE: é o que o [+] vai registrar. */
  measure_id: number | null;
  measure_count: number | null;
  qty_g: number;
}

function maisRecente(a: FoodEntry, b: FoodEntry): FoodEntry {
  if (a.data !== b.data) return a.data > b.data ? a : b;
  return a.created_at >= b.created_at ? a : b;
}

function agrupar(entries: FoodEntry[]): Map<number, { vezes: number; ultimo: FoodEntry }> {
  const mapa = new Map<number, { vezes: number; ultimo: FoodEntry }>();
  for (const e of entries) {
    const atual = mapa.get(e.food_id);
    if (atual) {
      atual.vezes++;
      atual.ultimo = maisRecente(atual.ultimo, e);
    } else {
      mapa.set(e.food_id, { vezes: 1, ultimo: e });
    }
  }
  return mapa;
}

function paraUso(food_id: number, vezes: number, ultimo: FoodEntry): UsoFrequente {
  return {
    food_id, vezes,
    measure_id: ultimo.measure_id,
    measure_count: ultimo.measure_count,
    qty_g: ultimo.qty_g,
  };
}

/**
 * Os alimentos que você mais registra nesta refeição, com a porção da última
 * vez — o que a sheet abre pré-carregado, sem você digitar nada.
 *
 * A porção vem do uso mais recente, não do mais frequente: se você mudou de
 * 1 para 3 fatias, o app segue você, não a média.
 */
export function frequentesDaRefeicao(
  entries: FoodEntry[],
  mealId: number | null,
  limite = 6,
): UsoFrequente[] {
  const mapa = agrupar(entries.filter((e) => e.meal_id === mealId));
  return [...mapa.entries()]
    .map(([food_id, { vezes, ultimo }]) => paraUso(food_id, vezes, ultimo))
    .sort((a, b) => b.vezes - a.vezes || a.food_id - b.food_id)
    .slice(0, limite);
}

/** Últimos alimentos registrados em qualquer refeição, sem repetir alimento. */
export function recentes(entries: FoodEntry[], limite = 6): UsoFrequente[] {
  const mapa = agrupar(entries);
  return [...mapa.entries()]
    .map(([food_id, { vezes, ultimo }]) => ({ uso: paraUso(food_id, vezes, ultimo), ultimo }))
    .sort((a, b) =>
      a.ultimo.data !== b.ultimo.data
        ? b.ultimo.data.localeCompare(a.ultimo.data)
        : b.ultimo.created_at.localeCompare(a.ultimo.created_at),
    )
    .slice(0, limite)
    .map((x) => x.uso);
}

/**
 * A última vez que esta refeição foi registrada — a fonte do botão "repetir".
 *
 * É "a última COM registro", não "ontem": se você pulou ontem, repetir ontem
 * registraria nada. Ver spec, decisão sobre repetir refeição.
 */
export function ultimaRefeicao(
  entries: FoodEntry[],
  mealId: number | null,
): { data: string; itens: FoodEntry[] } | null {
  const daRefeicao = entries.filter((e) => e.meal_id === mealId);
  if (daRefeicao.length === 0) return null;
  const data = daRefeicao.reduce((max, e) => (e.data > max ? e.data : max), daRefeicao[0].data);
  return { data, itens: daRefeicao.filter((e) => e.data === data) };
}
