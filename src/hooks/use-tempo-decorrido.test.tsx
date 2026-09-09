import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTempoDecorrido, formatarDecorrido } from "./use-tempo-decorrido";

afterEach(() => vi.useRealTimers());

describe("formatarDecorrido", () => {
  it("abaixo de um minuto, ainda não é tempo nenhum", () => {
    expect(formatarDecorrido(0)).toBe("agora");
    expect(formatarDecorrido(59_000)).toBe("agora");
  });

  it("abaixo de uma hora, minutos", () => {
    expect(formatarDecorrido(32 * 60_000)).toBe("32 min");
  });

  // A forma que o cabeçalho da academia já usava, antes de este hook existir.
  it("de uma hora em diante, horas e minutos", () => {
    expect(formatarDecorrido(60 * 60_000)).toBe("1h00");
    expect(formatarDecorrido(72 * 60_000)).toBe("1h12");
    expect(formatarDecorrido(14 * 60 * 60_000)).toBe("14h00");
  });

  it("relógio para trás não vira tempo negativo", () => {
    expect(formatarDecorrido(-5000)).toBe("agora");
  });
});

describe("useTempoDecorrido", () => {
  it("sem início, não há tempo", () => {
    const { result } = renderHook(() => useTempoDecorrido(null));
    expect(result.current).toBeNull();
  });

  it("data ilegível não derruba a tela", () => {
    const { result } = renderHook(() => useTempoDecorrido("nem data isso é"));
    expect(result.current).toBeNull();
  });

  it("conta a partir do instante dado e continua contando", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T10:30:00.000Z"));

    const { result } = renderHook(() => useTempoDecorrido("2026-09-01T10:00:00.000Z"));
    expect(result.current).toBe("30 min");

    act(() => { vi.advanceTimersByTime(120_000); });
    expect(result.current).toBe("32 min");
  });
});
