import { describe, it, expect } from "vitest";
import { num, numOuNulo } from "./taco-num";

describe("num", () => {
  it("trata Tr/NA/vazio como 0 (comportamento existente dos macros)", () => {
    expect(num("Tr")).toBe(0);
    expect(num("NA")).toBe(0);
    expect(num("")).toBe(0);
  });

  it("aceita decimal com vírgula e arredonda em 1 casa", () => {
    expect(num("2,74")).toBe(2.7);
    expect(num(2.75)).toBe(2.8);
  });

  it("grampeia negativo de arredondamento, mas explode em negativo real", () => {
    expect(num(-0.02)).toBe(0);              // ruído de "carboidrato por diferença"
    expect(() => num(-5)).toThrow(/negativo/); // erro de dado de verdade
  });
});

describe("numOuNulo", () => {
  it("distingue traço de não-analisado", () => {
    expect(numOuNulo("Tr")).toBe(0);      // traço ≈ zero: afirmar zero é honesto
    expect(numOuNulo("NA")).toBeNull();   // não analisado: dizer 0 seria mentira
    expect(numOuNulo("")).toBeNull();
  });

  it("passa números adiante como num()", () => {
    expect(numOuNulo("2,7")).toBe(2.7);
    expect(numOuNulo(2.7)).toBe(2.7);
  });

  it("é case-insensitive (a fonte mistura 'Tr' e 'tr')", () => {
    expect(numOuNulo("tr")).toBe(0);
    expect(numOuNulo("na")).toBeNull();
  });
});
