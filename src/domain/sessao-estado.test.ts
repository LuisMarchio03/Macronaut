import { describe, it, expect } from "vitest";
import { estadoDaSessao } from "./sessao-estado";

describe("estadoDaSessao", () => {
  it("sem início e sem fim é rascunho", () => {
    expect(estadoDaSessao({ iniciado_em: null, concluida_em: null })).toBe("rascunho");
  });

  it("com início e sem fim está em andamento", () => {
    expect(
      estadoDaSessao({ iniciado_em: "2026-09-01T10:00:00.000Z", concluida_em: null }),
    ).toBe("andamento");
  });

  it("com os dois está concluída", () => {
    expect(
      estadoDaSessao({
        iniciado_em: "2026-09-01T10:00:00.000Z",
        concluida_em: "2026-09-01T11:00:00.000Z",
      }),
    ).toBe("concluida");
  });

  // O cruzamento que `finalizarSessao` torna impossível — mas uma linha vinda
  // de um banco mais velho que este código não pode derrubar a tela.
  it("concluída sem início é concluída, não rascunho", () => {
    expect(
      estadoDaSessao({ iniciado_em: null, concluida_em: "2026-09-01T11:00:00.000Z" }),
    ).toBe("concluida");
  });
});
