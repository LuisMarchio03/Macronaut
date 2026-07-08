import { describe, it, expect } from "vitest";
import { resumoAgua } from "./analise-agua";

describe("resumoAgua", () => {
  it("média sobre TODOS os dias do período e conta dias na meta", () => {
    const m = new Map<string, number>([["2026-07-06", 3200], ["2026-07-07", 1000]]);
    const r = resumoAgua(m, 3000, 7);
    expect(r.totalMl).toBe(4200);
    expect(r.mediaMl).toBeCloseTo(4200 / 7, 5);
    expect(r.diasBateramMeta).toBe(1); // só o dia de 3200 >= 3000
    expect(r.diasRegistrados).toBe(2);
    expect(r.diasNoPeriodo).toBe(7);
  });
  it("meta 0 → diasBateramMeta 0", () => {
    const m = new Map<string, number>([["2026-07-06", 500]]);
    expect(resumoAgua(m, 0, 7).diasBateramMeta).toBe(0);
  });
  it("mapa vazio → tudo 0", () => {
    const r = resumoAgua(new Map(), 3000, 7);
    expect(r.totalMl).toBe(0);
    expect(r.mediaMl).toBe(0);
    expect(r.diasRegistrados).toBe(0);
  });
});
