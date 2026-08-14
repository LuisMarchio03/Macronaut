import { describe, it, expect } from "vitest";
import { refeicaoAtual } from "./refeicao-atual";
import type { Meal } from "./types";

const meal = (id: number, nome: string, horario: string | null): Meal => ({
  id,
  nome,
  horario,
  ordem: id,
});

const PADRAO: Meal[] = [
  meal(1, "Café da manhã", "07:00"),
  meal(2, "Almoço", "12:00"),
  meal(3, "Café da tarde", "16:00"),
  meal(4, "Jantar", "20:00"),
  meal(5, "Ceia", "22:00"),
];

const as = (h: number, m = 0) => h * 60 + m;

describe("refeicaoAtual", () => {
  it("escolhe a refeição do horário mais próximo", () => {
    expect(refeicaoAtual(PADRAO, as(7, 10))?.nome).toBe("Café da manhã");
    expect(refeicaoAtual(PADRAO, as(12, 30))?.nome).toBe("Almoço");
    expect(refeicaoAtual(PADRAO, as(19, 45))?.nome).toBe("Jantar");
  });

  it("olha para frente, não só para trás", () => {
    // Às 11h50 ninguém está registrando o café da manhã.
    expect(refeicaoAtual(PADRAO, as(11, 50))?.nome).toBe("Almoço");
  });

  it("trata a virada da meia-noite como distância circular", () => {
    // 00h10 está a 130 minutos da ceia (22h), não a 1310.
    expect(refeicaoAtual(PADRAO, as(0, 10))?.nome).toBe("Ceia");
  });

  it("antes da primeira refeição do dia, aponta para ela", () => {
    expect(refeicaoAtual(PADRAO, as(5, 0))?.nome).toBe("Café da manhã");
  });

  it("ignora refeições sem horário", () => {
    const comSemHora = [meal(9, "Avulsa", null), ...PADRAO];
    expect(refeicaoAtual(comSemHora, as(12, 0))?.nome).toBe("Almoço");
  });

  it("devolve null quando nenhuma refeição tem horário", () => {
    expect(refeicaoAtual([meal(1, "A", null), meal(2, "B", null)], as(12))).toBeNull();
  });

  it("devolve null para lista vazia", () => {
    expect(refeicaoAtual([], as(12))).toBeNull();
  });

  it("ignora horário malformado em vez de escolhê-lo", () => {
    const sujo = [meal(1, "Quebrada", "25:99"), meal(2, "Almoço", "12:00")];
    expect(refeicaoAtual(sujo, as(12))?.nome).toBe("Almoço");
  });

  it("no empate, mantém a primeira da lista", () => {
    const empate = [meal(1, "A", "11:00"), meal(2, "B", "13:00")];
    expect(refeicaoAtual(empate, as(12))?.nome).toBe("A");
  });
});
