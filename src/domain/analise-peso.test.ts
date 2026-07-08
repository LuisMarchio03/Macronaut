import { describe, it, expect } from "vitest";
import { resumoPeso, type Pesagem } from "./analise-peso";

const p = (data: string, peso_kg: number): Pesagem => ({ data, peso_kg });

describe("resumoPeso", () => {
  it("atual/inicial/variação/média/min/max sobre as pesagens ordenadas", () => {
    const r = resumoPeso([p("2026-07-06", 80), p("2026-07-08", 79), p("2026-07-10", 78)]);
    expect(r.inicial).toBe(80);
    expect(r.atual).toBe(78);
    expect(r.variacao).toBe(-2);
    expect(r.media).toBeCloseTo(79, 5);
    expect(r.min).toBe(78);
    expect(r.max).toBe(80);
    expect(r.nRegistros).toBe(3);
  });
  it("variação positiva (ganho)", () => {
    expect(resumoPeso([p("2026-07-06", 78), p("2026-07-10", 80)]).variacao).toBe(2);
  });
  it("vazio → tudo 0", () => {
    expect(resumoPeso([])).toEqual({ atual: 0, inicial: 0, variacao: 0, media: 0, min: 0, max: 0, nRegistros: 0 });
  });
});
