import { describe, it, expect } from "vitest";
import { resumoAtividade, kcalGastaPorDia } from "./analise-atividade";
import type { ActivitySession } from "./types";

const sessao = (data: string, kcal: number, min: number): ActivitySession =>
  ({ id: 0, data, tipo: "Corrida", duracao_min: min, kcal, created_at: "" });

describe("resumoAtividade", () => {
  it("soma kcal/min, conta sessões e média sobre o período", () => {
    const r = resumoAtividade([sessao("2026-07-06", 300, 30), sessao("2026-07-06", 200, 20), sessao("2026-07-08", 500, 40)], 7);
    expect(r.totalKcal).toBe(1000);
    expect(r.totalMin).toBe(90);
    expect(r.nSessoes).toBe(3);
    expect(r.mediaKcalDia).toBeCloseTo(1000 / 7, 5);
    expect(r.diasNoPeriodo).toBe(7);
  });
  it("vazio → tudo 0", () => {
    const r = resumoAtividade([], 7);
    expect(r.totalKcal).toBe(0);
    expect(r.nSessoes).toBe(0);
  });
});

describe("kcalGastaPorDia", () => {
  it("agrupa e soma kcal por data", () => {
    const m = kcalGastaPorDia([sessao("2026-07-06", 300, 30), sessao("2026-07-06", 200, 20), sessao("2026-07-08", 500, 40)]);
    expect(m.get("2026-07-06")).toBe(500);
    expect(m.get("2026-07-08")).toBe(500);
    expect(m.size).toBe(2);
  });
});
