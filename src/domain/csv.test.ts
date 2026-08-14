import { describe, it, expect } from "vitest";
import { parseCsv, detectarSeparador } from "./csv";

describe("detectarSeparador", () => {
  it("reconhece vírgula", () => {
    expect(detectarSeparador("a,b,c\n1,2,3")).toBe(",");
  });

  it("reconhece ponto-e-vírgula do Excel em português", () => {
    // Excel pt-BR usa ";" porque a vírgula é o separador decimal. Adivinhar
    // errado colapsaria a planilha inteira numa coluna só.
    expect(detectarSeparador("a;b;c\n1;2;3")).toBe(";");
  });

  it("reconhece tabulação", () => {
    expect(detectarSeparador("a\tb\tc")).toBe("\t");
  });

  it("não conta separadores que estão dentro de aspas", () => {
    expect(detectarSeparador('"a,b,c,d";x')).toBe(";");
  });
});

describe("parseCsv", () => {
  it("lê uma grade simples", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("aceita separador dentro de campo entre aspas", () => {
    expect(parseCsv('nome,obs\n"Ovos, 3 unidades",ok')).toEqual([
      ["nome", "obs"],
      ["Ovos, 3 unidades", "ok"],
    ]);
  });

  it("aceita aspas escapadas", () => {
    expect(parseCsv('a\n"disse ""oi"""')).toEqual([["a"], ['disse "oi"']]);
  });

  it("aceita quebra de linha dentro de campo", () => {
    expect(parseCsv('a,b\n"linha1\nlinha2",x')).toEqual([
      ["a", "b"],
      ["linha1\nlinha2", "x"],
    ]);
  });

  it("aceita CRLF", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("descarta o BOM que o Excel escreve", () => {
    expect(parseCsv("﻿a,b\n1,2")[0]).toEqual(["a", "b"]);
  });

  it("transforma campo vazio em null, como o leitor de xlsx faz", () => {
    // As duas fontes precisam entregar a mesma forma para os parsers do plano.
    expect(parseCsv("a,,c")).toEqual([["a", null, "c"]]);
    expect(parseCsv("a,   ,c")).toEqual([["a", null, "c"]]);
  });

  it("lê a última linha sem quebra final", () => {
    expect(parseCsv("a,b\n1,2")).toHaveLength(2);
  });

  it("devolve grade vazia para entrada vazia", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("lê um trecho no formato da aba Plano", () => {
    const csv = [
      "REFEIÇÃO,HORÁRIO,ALIMENTOS,CALORIAS,OBSERVAÇÕES",
      "Café da Manhã,7h00 - 8h00,3 ovos mexidos,~400 kcal,",
      ",,1 fatia de pão integral,,",
    ].join("\n");
    expect(parseCsv(csv)).toEqual([
      ["REFEIÇÃO", "HORÁRIO", "ALIMENTOS", "CALORIAS", "OBSERVAÇÕES"],
      ["Café da Manhã", "7h00 - 8h00", "3 ovos mexidos", "~400 kcal", null],
      [null, null, "1 fatia de pão integral", null, null],
    ]);
  });
});
