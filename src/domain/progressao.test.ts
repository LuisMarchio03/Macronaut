import { it, expect } from "vitest";
import { serieDeProgressao } from "./treino";

it("agrupa por data (sessão), calcula topPeso/e1RM/volume e ordena", () => {
  const pontos = serieDeProgressao([
    { data: "2026-07-02", peso_kg: 80, reps: 10 },
    { data: "2026-07-02", peso_kg: 82.5, reps: 8 },
    { data: "2026-06-30", peso_kg: 75, reps: 10 },
  ]);
  expect(pontos.map((p) => p.data)).toEqual(["2026-06-30", "2026-07-02"]);
  const seg = pontos[1];
  expect(seg.topPeso).toBe(82.5);
  expect(seg.volume).toBe(80 * 10 + 82.5 * 8); // 1460
  expect(seg.e1RM).toBe(107); // max(round(80*(1+10/30))=107, round(82.5*(1+8/30))=105) = 107
});

it("vazio devolve []", () => {
  expect(serieDeProgressao([])).toEqual([]);
});
