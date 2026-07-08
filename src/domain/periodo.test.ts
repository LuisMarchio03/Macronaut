import { describe, it, expect } from "vitest";
import {
  rangeDoPeriodo, navegar, rotuloPeriodo, diasNoPeriodo, listaDeDias,
} from "./periodo";

// 2026-07-08 é uma quarta-feira; semana seg–dom = 2026-07-06 a 2026-07-12.
describe("rangeDoPeriodo", () => {
  it("semana: segunda a domingo que contêm a âncora", () => {
    expect(rangeDoPeriodo("semana", "2026-07-08")).toEqual({ inicio: "2026-07-06", fim: "2026-07-12" });
  });
  it("semana: atravessa a virada de mês", () => {
    // 2026-08-01 é sábado; semana = 2026-07-27 (seg) a 2026-08-02 (dom)
    expect(rangeDoPeriodo("semana", "2026-08-01")).toEqual({ inicio: "2026-07-27", fim: "2026-08-02" });
  });
  it("mes: primeiro ao último dia do mês", () => {
    expect(rangeDoPeriodo("mes", "2026-07-08")).toEqual({ inicio: "2026-07-01", fim: "2026-07-31" });
  });
  it("ano: 01-01 a 31-12", () => {
    expect(rangeDoPeriodo("ano", "2026-07-08")).toEqual({ inicio: "2026-01-01", fim: "2026-12-31" });
  });
});

describe("navegar", () => {
  it("semana: -1 volta 7 dias", () => {
    expect(navegar("semana", "2026-07-08", -1)).toBe("2026-07-01");
  });
  it("mes: +1 vai pro 1º do mês seguinte", () => {
    expect(navegar("mes", "2026-07-08", 1)).toBe("2026-08-01");
  });
  it("mes: +1 atravessa a virada de ano", () => {
    expect(navegar("mes", "2026-12-15", 1)).toBe("2027-01-01");
  });
  it("ano: +1 vai pro 1º de janeiro do ano seguinte", () => {
    expect(navegar("ano", "2026-07-08", 1)).toBe("2027-01-01");
  });
});

describe("diasNoPeriodo / listaDeDias", () => {
  it("conta os dias inclusive", () => {
    expect(diasNoPeriodo({ inicio: "2026-07-06", fim: "2026-07-12" })).toBe(7);
    expect(diasNoPeriodo({ inicio: "2026-07-01", fim: "2026-07-31" })).toBe(31);
  });
  it("lista todas as datas do range", () => {
    expect(listaDeDias({ inicio: "2026-07-06", fim: "2026-07-08" }))
      .toEqual(["2026-07-06", "2026-07-07", "2026-07-08"]);
  });
});

describe("rotuloPeriodo", () => {
  it("semana no mesmo mês", () => {
    expect(rotuloPeriodo("semana", { inicio: "2026-07-06", fim: "2026-07-12" })).toBe("6–12 jul 2026");
  });
  it("semana entre meses", () => {
    expect(rotuloPeriodo("semana", { inicio: "2026-07-27", fim: "2026-08-02" })).toBe("27 jul – 2 ago 2026");
  });
  it("mes", () => {
    expect(rotuloPeriodo("mes", { inicio: "2026-07-01", fim: "2026-07-31" })).toBe("Julho 2026");
  });
  it("ano", () => {
    expect(rotuloPeriodo("ano", { inicio: "2026-01-01", fim: "2026-12-31" })).toBe("2026");
  });
});
