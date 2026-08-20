import { describe, it, expect } from "vitest";
import {
  diasEntre,
  estadoDosDias,
  treinosPorSemana,
  type DiaDaRotina,
  type SessaoFeita,
} from "./consistencia";

// 2026-08-17 é uma segunda-feira; o domingo que abre a semana é 2026-08-16.
const HOJE = "2026-08-17";

const DIAS: DiaDaRotina[] = [
  { id: 1, dia_semana: 1, nome: "Peito" },
  { id: 2, dia_semana: 3, nome: "Costas" },
  { id: 3, dia_semana: 5, nome: "Perna" },
];

describe("diasEntre", () => {
  it("conta dias inteiros", () => {
    expect(diasEntre("2026-08-10", "2026-08-17")).toBe(7);
    expect(diasEntre("2026-08-17", "2026-08-17")).toBe(0);
    expect(diasEntre("2026-08-18", "2026-08-17")).toBe(-1);
  });

  // Atravessar o horário de verão daria 6,96 ou 7,04 dias sem o arredondamento.
  it("não escorrega ao atravessar mudança de fuso", () => {
    expect(diasEntre("2026-10-15", "2026-10-22")).toBe(7);
    expect(diasEntre("2026-02-12", "2026-02-19")).toBe(7);
  });
});

describe("estadoDosDias", () => {
  it("diz há quantos dias cada dia da rotina não é feito", () => {
    const sessoes: SessaoFeita[] = [
      { data: "2026-08-10", day_id: 1 },
      { data: "2026-08-17", day_id: 1 },
      { data: "2026-08-06", day_id: 3 },
    ];
    const estado = estadoDosDias(DIAS, sessoes, HOJE);
    expect(estado.map((e) => [e.dia.nome, e.diasAtras])).toEqual([
      ["Peito", 0],
      ["Costas", null],
      ["Perna", 11],
    ]);
  });

  it("dia nunca treinado não tem última vez", () => {
    const [peito] = estadoDosDias(DIAS, [], HOJE);
    expect(peito.ultima).toBeNull();
    expect(peito.diasAtras).toBeNull();
  });

  // Uma sessão avulsa ("treinar mesmo assim") não pertence a dia nenhum e não
  // pode fazer um dia da rotina parecer em dia.
  it("sessão sem dia da rotina não conta para nenhum dia", () => {
    const estado = estadoDosDias(DIAS, [{ data: HOJE, day_id: null }], HOJE);
    expect(estado.every((e) => e.diasAtras === null)).toBe(true);
  });

  it("rotina vazia não tem estado nenhum", () => {
    expect(estadoDosDias([], [{ data: HOJE, day_id: 1 }], HOJE)).toEqual([]);
  });
});

describe("treinosPorSemana", () => {
  it("agrupa por semana começando no domingo, da mais antiga para a mais recente", () => {
    const sessoes: SessaoFeita[] = [
      { data: "2026-08-17", day_id: 1 }, // semana de 16/08
      { data: "2026-08-16", day_id: 1 }, // semana de 16/08
      { data: "2026-08-12", day_id: 2 }, // semana de 09/08
      { data: "2026-08-10", day_id: 1 }, // semana de 09/08
      { data: "2026-08-05", day_id: 2 }, // semana de 02/08
    ];
    expect(treinosPorSemana(sessoes, HOJE, 4)).toEqual([
      { inicio: "2026-07-26", treinos: 0 },
      { inicio: "2026-08-02", treinos: 1 },
      { inicio: "2026-08-09", treinos: 2 },
      { inicio: "2026-08-16", treinos: 2 },
    ]);
  });

  // A pergunta é em quantos DIAS você treinou, não quantas sessões abriu.
  it("duas sessões no mesmo dia contam como um treino", () => {
    const sessoes: SessaoFeita[] = [
      { data: "2026-08-17", day_id: 1 },
      { data: "2026-08-17", day_id: null },
    ];
    expect(treinosPorSemana(sessoes, HOJE, 1)).toEqual([{ inicio: "2026-08-16", treinos: 1 }]);
  });

  it("sem sessão nenhuma devolve as semanas zeradas", () => {
    expect(treinosPorSemana([], HOJE, 2)).toEqual([
      { inicio: "2026-08-09", treinos: 0 },
      { inicio: "2026-08-16", treinos: 0 },
    ]);
  });
});
