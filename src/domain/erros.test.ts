import { describe, it, expect } from "vitest";
import { traduzirErro } from "./erros";

describe("banco desatualizado", () => {
  it("nomeia a tabela que falta e diz como resolver", () => {
    // É exatamente o erro que o importador dá contra um banco que nunca
    // recebeu a migração — e que antes desaparecia sem deixar rastro.
    const f = traduzirErro(new Error("SQLITE_ERROR: no such table: diet_plans"));
    expect(f.titulo).toContain("diet_plans");
    expect(f.titulo).toMatch(/desatualizado/i);
    expect(f.acao).toContain("db:setup");
  });

  it("faz o mesmo para coluna faltando", () => {
    const f = traduzirErro(new Error("SQLITE_ERROR: no such column: water_log.block_id"));
    expect(f.titulo).toContain("water_log.block_id");
    expect(f.acao).toContain("db:setup");
  });
});

describe("outras falhas", () => {
  it("sessão expirada", () => {
    expect(traduzirErro(new Error("request failed with 401")).titulo).toMatch(/sess[ãa]o/i);
  });

  it("sem permissão de escrita", () => {
    expect(traduzirErro(new Error("403 Forbidden")).acao).toMatch(/permiss[ãa]o/i);
  });

  it("banco fora do ar", () => {
    for (const m of ["Failed to fetch", "ECONNREFUSED 127.0.0.1:8090", "fetch failed"]) {
      expect(traduzirErro(new Error(m)).titulo, m).toMatch(/n[ãa]o consegui falar/i);
    }
  });

  it("erro do servidor", () => {
    expect(traduzirErro(new Error("Server returned HTTP status 500")).titulo).toMatch(/erro/i);
  });

  it("conflito de restrição", () => {
    expect(traduzirErro(new Error("UNIQUE constraint failed: users.email")).titulo).toMatch(
      /conflita/i,
    );
  });
});

describe("sempre devolve algo utilizável", () => {
  it("mensagem desconhecida vira um aviso genérico, nunca vazio", () => {
    const f = traduzirErro(new Error("¯\\_(ツ)_/¯"));
    expect(f.titulo).not.toBe("");
    expect(f.acao).not.toBe("");
  });

  it("aceita coisas que não são Error", () => {
    for (const v of ["texto solto", 42, null, undefined, { a: 1 }]) {
      const f = traduzirErro(v);
      expect(f.titulo, String(v)).not.toBe("");
      expect(typeof f.original, String(v)).toBe("string");
    }
  });

  it("preserva a mensagem original para diagnóstico", () => {
    const f = traduzirErro(new Error("SQLITE_ERROR: no such table: plan_blocks"));
    expect(f.original).toBe("SQLITE_ERROR: no such table: plan_blocks");
  });
});
