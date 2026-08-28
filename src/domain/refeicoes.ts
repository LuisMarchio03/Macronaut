import { horaParaMinutos } from "../lib/date";
import type { Meal } from "./types";

/**
 * A ordem da lista depois de encaixar uma refeição nova pelo horário dela.
 *
 * Cadastrar o café da manhã depois do almoço punha o café no fim da lista, e
 * não havia como movê-lo: a `ordem` era um contador de criação disfarçado de
 * posição. Aqui o horário decide onde a refeição NOVA entra — e só ela.
 *
 * As outras mantêm a ordem que já tinham, de propósito: essa ordem é decisão
 * do usuário (as setas da tela), e reordenar tudo por horário a cada inserção
 * desfaria em silêncio o que ele arrumou à mão.
 *
 * Refeição sem horário não tem onde encaixar e vai para o fim. Uma sem horário
 * no meio da lista também não é barreira — a nova passa por ela até achar
 * alguém com horário mais tarde.
 */
export function ordemComNova(meals: Meal[], nova: Meal): number[] {
  const outras = meals.filter((m) => m.id !== nova.id).map((m) => m.id);
  const minutos = horaParaMinutos(nova.horario);
  if (minutos === null) return [...outras, nova.id];

  const posicao = meals
    .filter((m) => m.id !== nova.id)
    .findIndex((m) => {
      const dela = horaParaMinutos(m.horario);
      return dela !== null && dela > minutos;
    });

  if (posicao === -1) return [...outras, nova.id];
  return [...outras.slice(0, posicao), nova.id, ...outras.slice(posicao)];
}
