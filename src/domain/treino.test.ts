import { describe, it, expect } from "vitest";
import {
  estimativaKcal, e1RM, volumeSet, seriesEfetivas, duracaoSessaoMin,
  resumirSets, rotuloRir, listaPorVirgula, passosDaExecucao, urlDeExecucao,
} from "./treino";

it("estimativaKcal = met * peso * duracao/60", () => {
  expect(estimativaKcal(10, 80, 60)).toBeCloseTo(800, 0);
  expect(estimativaKcal(9.8, 70, 30)).toBeCloseTo(343, 0);
});

it("e1RM (Epley) = peso * (1 + reps/30)", () => {
  expect(e1RM(100, 1)).toBeCloseTo(103.33, 1);
  expect(e1RM(80, 10)).toBeCloseTo(106.67, 1);
});

it("volumeSet = peso * reps", () => {
  expect(volumeSet(80, 10)).toBe(800);
});

it("seriesEfetivas remove aquecimento e mantém valida, drop e falha", () => {
  const sets = [
    { id: 1, tipo: "aquecimento" as const },
    { id: 2, tipo: "valida" as const },
    { id: 3, tipo: "drop" as const },
    { id: 4, tipo: "falha" as const },
    { id: 5, tipo: "aquecimento" as const },
  ];
  expect(seriesEfetivas(sets).map((s) => s.id)).toEqual([2, 3, 4]);
});

it("seriesEfetivas em lista vazia devolve vazio", () => {
  expect(seriesEfetivas([])).toEqual([]);
});

it("duracaoSessaoMin mede da primeira à última série", () => {
  const sets = [
    { created_at: "2026-07-16T10:00:00.000Z" },
    { created_at: "2026-07-16T10:45:00.000Z" },
    { created_at: "2026-07-16T10:20:00.000Z" },
  ];
  expect(duracaoSessaoMin(sets)).toBe(45);
});

it("duracaoSessaoMin com série única é 0", () => {
  expect(duracaoSessaoMin([{ created_at: "2026-07-16T10:00:00.000Z" }])).toBe(0);
});

it("duracaoSessaoMin com sessão vazia é 0", () => {
  expect(duracaoSessaoMin([])).toBe(0);
});

it("resumirSets: reps e peso uniformes vira NxR @ peso kg", () => {
  const sets = [
    { reps: 10, peso_kg: 40 },
    { reps: 10, peso_kg: 40 },
    { reps: 10, peso_kg: 40 },
  ];
  expect(resumirSets(sets)).toBe("3×10 @ 40 kg");
});

it("resumirSets: reps variando lista cada valor; peso uniforme fica com um número só", () => {
  const sets = [
    { reps: 10, peso_kg: 40 },
    { reps: 8, peso_kg: 40 },
    { reps: 6, peso_kg: 40 },
  ];
  expect(resumirSets(sets)).toBe("10,8,6 @ 40 kg");
});

it("resumirSets: peso variando lista cada valor (drop set); reps uniformes ficam NxR", () => {
  const sets = [
    { reps: 10, peso_kg: 40 },
    { reps: 10, peso_kg: 40 },
    { reps: 10, peso_kg: 25 },
  ];
  expect(resumirSets(sets)).toBe("3×10 @ 40/40/25 kg");
});

it("resumirSets: reps e peso variando ao mesmo tempo detalha as duas dimensões", () => {
  const sets = [
    { reps: 10, peso_kg: 40 },
    { reps: 8, peso_kg: 35 },
    { reps: 6, peso_kg: 25 },
  ];
  expect(resumirSets(sets)).toBe("10,8,6 @ 40/35/25 kg");
});

it("resumirSets: série única", () => {
  expect(resumirSets([{ reps: 10, peso_kg: 40 }])).toBe("1×10 @ 40 kg");
});

it("rotuloRir: 0 a 3 mostra o número cru; 4 vira '4+' (spec: 4 = 4 ou mais)", () => {
  expect(rotuloRir(0)).toBe("0");
  expect(rotuloRir(1)).toBe("1");
  expect(rotuloRir(2)).toBe("2");
  expect(rotuloRir(3)).toBe("3");
  expect(rotuloRir(4)).toBe("4+");
});

describe("ficha do exercício", () => {
  it("separa a lista por vírgula, ignorando espaço e vazio", () => {
    expect(listaPorVirgula("Peito, Tríceps ,, Ombros")).toEqual(["Peito", "Tríceps", "Ombros"]);
    expect(listaPorVirgula(null)).toEqual([]);
    expect(listaPorVirgula("")).toEqual([]);
  });

  it("um passo por linha, sem linha em branco", () => {
    expect(passosDaExecucao("Deite no banco.\n\nDesça a barra.\n  Empurre.  ")).toEqual([
      "Deite no banco.",
      "Desça a barra.",
      "Empurre.",
    ]);
    expect(passosDaExecucao(null)).toEqual([]);
  });

  /**
   * O termo importa: "Rosca scott" sozinho no Google devolve loja de
   * equipamento antes de qualquer demonstração de execução.
   */
  it("a busca de execução leva o termo pronto e escapado", () => {
    const g = urlDeExecucao("Rosca scott", "google");
    expect(g).toContain("google.com/search");
    expect(decodeURIComponent(g)).toContain("Rosca scott execução correta");

    const y = urlDeExecucao("Supino reto com barra", "youtube");
    expect(y).toContain("youtube.com/results");
    expect(decodeURIComponent(y)).toContain("como fazer Supino reto com barra");
  });
});
