import { it, expect } from "vitest";
import { estimativaKcal, e1RM, volumeSet } from "./treino";

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
