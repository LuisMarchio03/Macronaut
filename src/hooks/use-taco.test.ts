import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const FIXTURE = [
  { nome: "Arroz, integral, cozido", base_qty_g: 100, kcal: 124, prot_g: 2.6, carb_g: 25.8, gord_g: 1.0 },
  { nome: "Feijão, carioca, cozido", base_qty_g: 100, kcal: 76, prot_g: 4.8, carb_g: 13.6, gord_g: 0.5 },
];

beforeEach(() => {
  vi.resetModules(); // limpa o cache de módulo do hook entre os testes
});

describe("useBuscaTaco", () => {
  it("carrega a base e retorna matches", async () => {
    vi.doMock("../data/taco.json", () => ({ default: FIXTURE }));
    const { useBuscaTaco } = await import("./use-taco");
    const { result } = renderHook(() => useBuscaTaco("feijao"));
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].nome).toBe("Feijão, carioca, cozido");
  });

  it("termo vazio retorna []", async () => {
    vi.doMock("../data/taco.json", () => ({ default: FIXTURE }));
    const { useBuscaTaco } = await import("./use-taco");
    const { result } = renderHook(() => useBuscaTaco(""));
    await waitFor(() => expect(result.current).toEqual([]));
  });

  it("degrada para [] quando a base falha ao carregar", async () => {
    vi.doMock("../data/taco.json", () => {
      throw new Error("offline");
    });
    const { useBuscaTaco } = await import("./use-taco");
    const { result } = renderHook(() => useBuscaTaco("feijao"));
    // dá tempo do import rejeitar e o catch rodar
    await waitFor(() => expect(result.current).toEqual([]));
  });
});
