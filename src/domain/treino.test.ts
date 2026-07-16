import { it, expect } from "vitest";
import {
  estimativaKcal, e1RM, volumeSet, seriesEfetivas, duracaoSessaoMin,
  resumirSets, rotuloRir,
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
