import { describe, it, expect } from "vitest";
import { ordemComNova } from "./refeicoes";
import type { Meal } from "./types";

const m = (id: number, nome: string, horario: string | null, ordem: number): Meal => ({
  id, nome, horario, ordem,
});

describe("ordemComNova", () => {
  // É o pedido: cadastrei o almoço primeiro, o café depois, e o café tem que
  // abrir o dia — não terminar a lista.
  it("põe a refeição nova na posição do horário dela", () => {
    const almoco = m(1, "Almoço", "12:00", 1);
    const cafe = m(2, "Café da manhã", "07:00", 2);

    expect(ordemComNova([almoco, cafe], cafe)).toEqual([2, 1]);
  });

  it("entre duas, entra no meio", () => {
    const cafe = m(1, "Café", "07:00", 1);
    const jantar = m(2, "Jantar", "20:00", 2);
    const almoco = m(3, "Almoço", "12:00", 3);

    expect(ordemComNova([cafe, jantar, almoco], almoco)).toEqual([1, 3, 2]);
  });

  it("a mais tardia continua no fim", () => {
    const cafe = m(1, "Café", "07:00", 1);
    const ceia = m(2, "Ceia", "22:00", 2);

    expect(ordemComNova([cafe, ceia], ceia)).toEqual([1, 2]);
  });

  // Sem horário não há onde encaixar; o fim é o único lugar honesto.
  it("refeição nova sem horário vai para o fim", () => {
    const cafe = m(1, "Café", "07:00", 1);
    const avulsa = m(2, "Avulsa", null, 2);

    expect(ordemComNova([cafe, avulsa], avulsa)).toEqual([1, 2]);
  });

  // A ordem manual das outras é decisão do usuário. Inserir uma refeição não
  // pode reordenar a lista inteira por horário e desfazer o que ele arrumou.
  it("não reordena as refeições que já estavam lá", () => {
    const jantar = m(1, "Jantar", "20:00", 1);
    const cafe = m(2, "Café", "07:00", 2);
    const almoco = m(3, "Almoço", "12:00", 3);

    expect(ordemComNova([jantar, cafe, almoco], almoco)).toEqual([3, 1, 2]);
  });

  // Uma refeição sem horário no meio da lista não é barreira: ela não tem
  // horário para comparar, então a nova passa por cima dela até achar quem tem.
  it("ignora as sem horário ao procurar a posição", () => {
    const cafe = m(1, "Café", "07:00", 1);
    const avulsa = m(2, "Avulsa", null, 2);
    const jantar = m(3, "Jantar", "20:00", 3);
    const almoco = m(4, "Almoço", "12:00", 4);

    expect(ordemComNova([cafe, avulsa, jantar, almoco], almoco)).toEqual([1, 2, 4, 3]);
  });
});
