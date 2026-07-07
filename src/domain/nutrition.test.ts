import { describe, it, expect } from "vitest";
import {
  idade, tmbMifflinStJeor, gastoEnergetico, ajustePorObjetivo, splitMacros,
} from "./nutrition";

describe("idade", () => {
  it("calcula anos completos", () => {
    expect(idade("1994-07-10", new Date("2026-07-06"))).toBe(31);
    expect(idade("1994-07-06", new Date("2026-07-06"))).toBe(32);
  });
});

describe("tmbMifflinStJeor", () => {
  it("homem: 10*peso + 6.25*altura - 5*idade + 5", () => {
    expect(tmbMifflinStJeor({ sexo: "M", peso_kg: 80, altura_cm: 180, idade: 30 }))
      .toBeCloseTo(1780, 0);
  });
  it("mulher: 10*peso + 6.25*altura - 5*idade - 161", () => {
    expect(tmbMifflinStJeor({ sexo: "F", peso_kg: 60, altura_cm: 165, idade: 30 }))
      .toBeCloseTo(1320.25, 2);
  });
});

describe("gastoEnergetico", () => {
  it("multiplica TMB pelo fator", () => {
    expect(gastoEnergetico(1780, 1.55)).toBeCloseTo(2759, 0);
  });
});

describe("ajustePorObjetivo", () => {
  it("bulk soma 15%", () => expect(ajustePorObjetivo(2000, "bulk")).toBe(2300));
  it("cut corta 20%", () => expect(ajustePorObjetivo(2000, "cut")).toBe(1600));
  it("manutencao mantém", () => expect(ajustePorObjetivo(2000, "manutencao")).toBe(2000));
});

describe("splitMacros", () => {
  it("proteína por g/kg, gordura 25% kcal, carbo no restante", () => {
    const m = splitMacros(2000, 80, "manutencao");
    expect(m.kcal).toBe(2000);
    expect(m.prot_g).toBeCloseTo(160, 0);        // 80 * 2.0
    expect(m.gord_g).toBe(56);                   // 2000*0.25/9 = 55.5556 → round
    expect(m.carb_g).toBeCloseTo(215, 0);        // (2000 - 160*4 - 55.56*9)/4
  });
});
