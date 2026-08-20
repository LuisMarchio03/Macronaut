import { it, expect, describe, vi, afterEach } from "vitest";
import {
  hoje,
  formatarData,
  dataPorExtenso,
  dataRelativa,
  horaParaMinutos,
  minutosAgora,
  horaCurta,
  janelaHoraria,
  diaSemana,
} from "./date";

afterEach(() => vi.useRealTimers());

it("hoje devolve YYYY-MM-DD", () => {
  expect(hoje()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

it("formata data local", () => {
  expect(formatarData("2026-07-06")).toBe("06/07/2026");
});

describe("dataPorExtenso", () => {
  it("escreve dia da semana, dia e mês", () => {
    expect(dataPorExtenso("2026-08-14")).toBe("Sexta, 14 de agosto");
  });

  it("não desloca o dia por fuso horário", () => {
    // `new Date("2026-01-01")` é UTC; a oeste de Greenwich viraria 31/12.
    expect(dataPorExtenso("2026-01-01")).toContain("1 de janeiro");
  });
});

describe("dataRelativa", () => {
  it("nomeia hoje, ontem e amanhã", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 14, 10, 0));
    expect(dataRelativa("2026-08-14")).toBe("Hoje");
    expect(dataRelativa("2026-08-13")).toBe("Ontem");
    expect(dataRelativa("2026-08-15")).toBe("Amanhã");
  });

  it("cai para a data por extenso além disso", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 14, 10, 0));
    expect(dataRelativa("2026-08-10")).toBe("Segunda, 10 de agosto");
  });

  it("atravessa a virada do mês", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 1, 10, 0));
    expect(dataRelativa("2026-08-31")).toBe("Ontem");
  });
});

describe("horaParaMinutos", () => {
  it("converte HH:MM", () => {
    expect(horaParaMinutos("07:00")).toBe(420);
    expect(horaParaMinutos("00:00")).toBe(0);
    expect(horaParaMinutos("23:59")).toBe(1439);
    expect(horaParaMinutos("7:05")).toBe(425);
  });

  it("devolve null para entrada inválida em vez de NaN", () => {
    // NaN passaria adiante e faria toda comparação de horário virar false,
    // escondendo o erro em vez de expô-lo.
    for (const v of [null, undefined, "", "abc", "25:00", "12:99", "12", "12:5"]) {
      expect(horaParaMinutos(v)).toBeNull();
    }
  });
});

it("minutosAgora conta desde a meia-noite", () => {
  expect(minutosAgora(new Date(2026, 7, 14, 15, 30))).toBe(930);
});

describe("horaCurta", () => {
  it("abrevia hora cheia e hora quebrada", () => {
    expect(horaCurta("07:00")).toBe("7h");
    expect(horaCurta("07:30")).toBe("7h30");
    expect(horaCurta("19:05")).toBe("19h05");
  });

  it("devolve vazio para hora inválida", () => {
    expect(horaCurta(null)).toBe("");
    expect(horaCurta("nope")).toBe("");
  });
});

describe("janelaHoraria", () => {
  it("junta início e fim", () => {
    expect(janelaHoraria("07:00", "08:00")).toBe("7h – 8h");
  });

  it("aceita só um dos lados", () => {
    expect(janelaHoraria("12:00", null)).toBe("12h");
    expect(janelaHoraria(null, "13:00")).toBe("13h");
    expect(janelaHoraria(null, null)).toBe("");
  });
});

describe("diaSemana", () => {
  it("devolve o dia da semana com 0 = domingo", () => {
    expect(diaSemana("2026-08-16")).toBe(0); // domingo
    expect(diaSemana("2026-08-17")).toBe(1); // segunda
    expect(diaSemana("2026-08-22")).toBe(6); // sábado
  });

  // `new Date("2026-08-17").getDay()` lê a string como UTC. Rodando a oeste de
  // Greenwich isso cai no dia anterior e responde domingo no lugar de segunda —
  // a implementação ingênua falha aqui, a que usa `local` passa em qualquer fuso.
  it("concorda com a data construída no fuso local", () => {
    for (const [ano, mes, dia] of [
      [2026, 8, 16], [2026, 8, 17], [2026, 1, 1], [2026, 12, 31],
    ] as const) {
      const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      expect(diaSemana(iso)).toBe(new Date(ano, mes - 1, dia).getDay());
    }
  });
});
