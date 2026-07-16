import { describe, it, expect } from "vitest";
import { normalizar } from "./texto";

describe("normalizar", () => {
  it("remove acentos, baixa a caixa e apara espaços", () => {
    expect(normalizar("Glúteos")).toBe("gluteos");
    expect(normalizar("  BÍCEPS  ")).toBe("biceps");
  });

  it("é idempotente em texto já normalizado", () => {
    expect(normalizar("supino")).toBe("supino");
  });

  it("não altera texto sem acento além de caixa e espaços", () => {
    expect(normalizar("  Agachamento Livre  ")).toBe("agachamento livre");
  });
});
