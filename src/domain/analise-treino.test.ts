import { describe, it, expect } from "vitest";
import { resumoTreino, volumePorDia, volumePorGrupo, type SetAnalise } from "./analise-treino";

const s = (data: string, peso_kg: number, reps: number, grupo: string | null): SetAnalise =>
  ({ data, peso_kg, reps, grupo });

describe("resumoTreino", () => {
  it("volumeTotal = Σ peso×reps, nSeries e nSessoes", () => {
    const sets = [s("2026-07-06", 40, 10, "peito"), s("2026-07-06", 50, 8, "peito"), s("2026-07-08", 60, 5, "perna")];
    const r = resumoTreino(sets, 2, 7);
    expect(r.volumeTotal).toBe(40 * 10 + 50 * 8 + 60 * 5); // 1100
    expect(r.nSeries).toBe(3);
    expect(r.nSessoes).toBe(2);
    expect(r.diasNoPeriodo).toBe(7);
  });
  it("vazio → tudo 0", () => {
    expect(resumoTreino([], 0, 7)).toEqual({ nSessoes: 0, nSeries: 0, volumeTotal: 0, diasNoPeriodo: 7 });
  });
});

describe("volumePorDia", () => {
  it("agrupa volume por data", () => {
    const m = volumePorDia([s("2026-07-06", 40, 10, "peito"), s("2026-07-06", 50, 8, "peito"), s("2026-07-08", 60, 5, "perna")]);
    expect(m.get("2026-07-06")).toBe(800);
    expect(m.get("2026-07-08")).toBe(300);
    expect(m.size).toBe(2);
  });
});

describe("volumePorGrupo", () => {
  it("soma por grupo; null vira 'Sem grupo'", () => {
    const m = volumePorGrupo([s("2026-07-06", 40, 10, "peito"), s("2026-07-06", 60, 5, null)]);
    expect(m.get("peito")).toBe(400);
    expect(m.get("Sem grupo")).toBe(300);
  });
});
