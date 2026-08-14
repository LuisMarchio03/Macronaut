import { horaParaMinutos } from "../lib/date";
import type { Meal } from "./types";

/**
 * Qual refeição o botão de registro rápido deve assumir agora.
 *
 * Regra: a refeição do horário mais próximo do momento atual, à frente ou
 * atrás. "A última que já passou" erraria o alvo às 11h50 — nesse horário
 * quase ninguém está registrando o café da manhã, está registrando o almoço
 * que vem em dez minutos.
 *
 * Refeição sem horário não é candidata (não há como saber quando é), e uma
 * lista inteiramente sem horário devolve `null` — o registro cai em "avulsas",
 * que é o comportamento honesto quando não dá para inferir.
 */
export function refeicaoAtual(meals: Meal[], minutosAgora: number): Meal | null {
  let melhor: Meal | null = null;
  let menorDistancia = Infinity;

  for (const m of meals) {
    const min = horaParaMinutos(m.horario);
    if (min === null) continue;

    // Distância circular: 23h30 está a 40 minutos de 00h10, não a 1390.
    const bruta = Math.abs(min - minutosAgora);
    const distancia = Math.min(bruta, 24 * 60 - bruta);

    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      melhor = m;
    }
  }

  return melhor;
}
