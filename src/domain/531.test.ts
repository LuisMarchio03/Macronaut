import { describe, it, expect } from "vitest";
import {
  arredondarCarga,
  ciclosConcluidos,
  e1RMDaSerie,
  ehDeload,
  ehRecorde,
  nomeDaSemana,
  proximaSessao,
  proximoTM,
  recordeNoPeso,
  serieAmrap,
  seriesDeTrabalho,
  sessaoPrescrita,
  tmVigente,
  trainingMaxDe1RM,
  umRMDeTrainingMax,
  escolherSugestao,
  LEVANTAMENTOS_SUGERIDOS,
  type Semana,
  type SessaoConcluida,
} from "./531";

/** Resume a sessão como "reps×peso" para conferir a tabela de uma vez só. */
const resumo = (tm: number, semana: Semana, inc = 2.5) =>
  sessaoPrescrita(tm, semana, inc).map(
    (s) => `${s.reps}${s.amrap ? "+" : ""}×${s.peso_kg}`,
  );

/* ══════════════════════════════════════════════════════════════════
   A TABELA DO MÉTODO — critério de aceite

   TM 100 kg, incremento 2,5. Números conferidos contra a definição
   do 5/3/1: se algum destes mudar, alguém quebrou a matemática.
   ══════════════════════════════════════════════════════════════════ */

describe("ciclo com TM de 100 kg", () => {
  it("semana 1 é 5/5/5+ sobre 65, 75 e 85%", () => {
    expect(resumo(100, 1)).toEqual([
      "5×40", "5×50", "3×60", // aquecimento
      "5×65", "5×75", "5+×85",
    ]);
  });

  it("semana 2 é 3/3/3+ sobre 70, 80 e 90%", () => {
    expect(resumo(100, 2)).toEqual([
      "5×40", "5×50", "3×60",
      "3×70", "3×80", "3+×90",
    ]);
  });

  it("semana 3 é 5/3/1+ sobre 75, 85 e 95%", () => {
    expect(resumo(100, 3)).toEqual([
      "5×40", "5×50", "3×60",
      "5×75", "3×85", "1+×95",
    ]);
  });

  it("semana 4 é deload: 40/50/60%, sem AMRAP e sem aquecimento", () => {
    // As séries de trabalho do deload JÁ são o aquecimento; repetir seria
    // fazer a mesma coisa duas vezes.
    expect(resumo(100, 4)).toEqual(["5×40", "5×50", "5×60"]);
    expect(serieAmrap(sessaoPrescrita(100, 4, 2.5))).toBeNull();
  });
});

describe("AMRAP", () => {
  it("existe só na última série das semanas 1 a 3", () => {
    for (const semana of [1, 2, 3] as Semana[]) {
      const sessao = sessaoPrescrita(120, semana, 2.5);
      const comAmrap = sessao.filter((s) => s.amrap);
      expect(comAmrap, `semana ${semana}`).toHaveLength(1);
      expect(comAmrap[0]).toBe(sessao.at(-1));
    }
  });

  it("o deload não tem nenhuma", () => {
    expect(sessaoPrescrita(120, 4, 2.5).filter((s) => s.amrap)).toEqual([]);
  });
});

describe("arredondarCarga", () => {
  it("vai para o múltiplo mais próximo do incremento", () => {
    expect(arredondarCarga(83.7, 2.5)).toBe(82.5);
    expect(arredondarCarga(84.0, 2.5)).toBe(85);
    expect(arredondarCarga(101, 2.5)).toBe(100);
    expect(arredondarCarga(102, 2.5)).toBe(102.5);
  });

  it("no empate, desce", () => {
    // Entre duas cargas, a mais leve é a que não custa a sessão.
    expect(arredondarCarga(81.25, 2.5)).toBe(80);
    expect(arredondarCarga(2.5, 5)).toBe(0);
  });

  it("respeita outros incrementos", () => {
    expect(arredondarCarga(83.7, 5)).toBe(85);
    expect(arredondarCarga(83.7, 1.25)).toBe(83.75);
    expect(arredondarCarga(83.7, 1)).toBe(84);
  });

  it("não devolve lixo de ponto flutuante", () => {
    // 0.7 * 67.5 = 47.25 → 47.5, e não 47.500000000000004.
    for (let tm = 60; tm <= 200; tm += 2.5) {
      for (const pct of [40, 50, 60, 65, 70, 75, 80, 85, 90, 95]) {
        const kg = arredondarCarga((tm * pct) / 100, 2.5);
        expect(String(kg), `${tm}kg @ ${pct}%`).not.toMatch(/\d{6,}/);
        expect(kg % 2.5, `${tm}kg @ ${pct}%`).toBeCloseTo(0, 6);
      }
    }
  });

  it("incremento inválido devolve o valor intacto em vez de dividir por zero", () => {
    expect(arredondarCarga(83.7, 0)).toBe(83.7);
    expect(arredondarCarga(83.7, -5)).toBe(83.7);
  });
});

describe("Training Max", () => {
  it("é 90% do 1RM, arredondado para a anilha", () => {
    // Aplicar os percentuais sobre o 1RM faria treinar ~11% mais pesado.
    expect(trainingMaxDe1RM(100, 2.5)).toBe(90);
    expect(trainingMaxDe1RM(140, 2.5)).toBe(125); // 126 → 125
    expect(trainingMaxDe1RM(85, 2.5)).toBe(77.5); // 76,5 → 77,5
  });

  it("converte de volta para 1RM aproximado", () => {
    expect(umRMDeTrainingMax(90)).toBe(100);
    expect(umRMDeTrainingMax(125)).toBe(139);
  });
});

describe("progressão entre ciclos", () => {
  it("superior sobe 2,5 kg e inferior sobe 5 kg", () => {
    expect(proximoTM(100, "superior", 2.5)).toBe(102.5);
    expect(proximoTM(100, "inferior", 2.5)).toBe(105);
  });

  it("acumula ao longo de vários ciclos", () => {
    expect(tmVigente(100, "inferior", 3, 2.5)).toBe(115);
    expect(tmVigente(100, "superior", 3, 2.5)).toBe(107.5);
  });

  it("ciclo nenhum fechado mantém o TM inicial", () => {
    expect(tmVigente(100, "inferior", 0, 2.5)).toBe(100);
  });
});

describe("nome e deload", () => {
  it("nomeia as semanas como o método", () => {
    expect(nomeDaSemana(1)).toBe("5/5/5+");
    expect(nomeDaSemana(2)).toBe("3/3/3+");
    expect(nomeDaSemana(3)).toBe("5/3/1+");
    expect(nomeDaSemana(4)).toBe("deload");
  });

  it("só a semana 4 é deload", () => {
    expect([1, 2, 3].map((s) => ehDeload(s as Semana))).toEqual([false, false, false]);
    expect(ehDeload(4)).toBe(true);
  });
});

describe("séries de trabalho", () => {
  it("descarta o aquecimento", () => {
    const t = seriesDeTrabalho(sessaoPrescrita(100, 1, 2.5));
    expect(t).toHaveLength(3);
    expect(t.every((s) => s.tipo === "trabalho")).toBe(true);
  });
});

describe("e1RM da série AMRAP", () => {
  it("usa Epley, a mesma fórmula do método", () => {
    // 100 kg × 5 reps → 100 × (1 + 5/30) ≈ 117
    expect(e1RMDaSerie(100, 5)).toBe(117);
    expect(e1RMDaSerie(90, 1)).toBe(93);
  });
});

describe("recordes de repetição", () => {
  const historico = [
    { peso_kg: 100, reps: 5 },
    { peso_kg: 100, reps: 7 },
    { peso_kg: 105, reps: 3 },
  ];

  it("acha o melhor daquele peso", () => {
    expect(recordeNoPeso(historico, 100)).toBe(7);
    expect(recordeNoPeso(historico, 105)).toBe(3);
  });

  it("devolve null num peso nunca treinado, em vez de inventar um alvo", () => {
    expect(recordeNoPeso(historico, 120)).toBeNull();
  });

  it("recorde é passar o melhor daquele peso", () => {
    expect(ehRecorde(historico, 100, 8)).toBe(true);
    expect(ehRecorde(historico, 100, 7)).toBe(false);
    expect(ehRecorde(historico, 100, 6)).toBe(false);
  });

  it("a primeira vez num peso não conta como recorde", () => {
    // Não havia marca a bater; chamar de recorde barateia a palavra.
    expect(ehRecorde(historico, 120, 10)).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════
   ESTADO DERIVADO
   ══════════════════════════════════════════════════════════════════ */

const LIFTS = [1, 2, 3, 4];
const feita = (lift_id: number, ciclo: number, semana: number): SessaoConcluida => ({
  lift_id,
  ciclo,
  semana,
});

describe("proximaSessao", () => {
  it("programa novo começa no ciclo 1, semana 1, primeiro levantamento", () => {
    expect(proximaSessao(LIFTS, [])).toEqual({ ciclo: 1, semana: 1, lift_id: 1 });
  });

  it("anda pelos levantamentos dentro da semana", () => {
    expect(proximaSessao(LIFTS, [feita(1, 1, 1)])).toEqual({
      ciclo: 1,
      semana: 1,
      lift_id: 2,
    });
  });

  it("completada a semana, passa para a seguinte", () => {
    const semana1 = LIFTS.map((id) => feita(id, 1, 1));
    expect(proximaSessao(LIFTS, semana1)).toEqual({ ciclo: 1, semana: 2, lift_id: 1 });
  });

  it("completado o ciclo, começa o próximo", () => {
    const cicloInteiro = [1, 2, 3, 4].flatMap((sem) => LIFTS.map((id) => feita(id, 1, sem)));
    expect(proximaSessao(LIFTS, cicloInteiro)).toEqual({ ciclo: 2, semana: 1, lift_id: 1 });
  });

  it("volta ao buraco quando uma sessão do meio é apagada", () => {
    // Estado derivado se corrige sozinho; um contador guardado mentiria.
    const quaseTudo = LIFTS.map((id) => feita(id, 1, 1)).filter((f) => f.lift_id !== 3);
    expect(proximaSessao(LIFTS, quaseTudo)).toEqual({ ciclo: 1, semana: 1, lift_id: 3 });
  });

  it("respeita a ordem configurada dos levantamentos", () => {
    expect(proximaSessao([7, 3, 9], [])).toEqual({ ciclo: 1, semana: 1, lift_id: 7 });
    expect(proximaSessao([7, 3, 9], [feita(7, 1, 1)])).toEqual({
      ciclo: 1,
      semana: 1,
      lift_id: 3,
    });
  });

  it("sem levantamentos configurados não há o que treinar", () => {
    expect(proximaSessao([], [])).toEqual({ ciclo: 1, semana: 1, lift_id: null });
  });

  it("ignora sessão de um levantamento que saiu do programa", () => {
    expect(proximaSessao([1, 2], [feita(99, 1, 1)])).toEqual({
      ciclo: 1,
      semana: 1,
      lift_id: 1,
    });
  });
});

describe("ciclosConcluidos", () => {
  it("conta só ciclo inteiro", () => {
    const meioCiclo = [1, 2].flatMap((sem) => LIFTS.map((id) => feita(id, 1, sem)));
    expect(ciclosConcluidos(LIFTS, meioCiclo)).toBe(0);
  });

  it("conta o ciclo fechado", () => {
    const um = [1, 2, 3, 4].flatMap((sem) => LIFTS.map((id) => feita(id, 1, sem)));
    expect(ciclosConcluidos(LIFTS, um)).toBe(1);
  });

  it("conta vários seguidos", () => {
    const dois = [1, 2].flatMap((ciclo) =>
      [1, 2, 3, 4].flatMap((sem) => LIFTS.map((id) => feita(id, ciclo, sem))),
    );
    expect(ciclosConcluidos(LIFTS, dois)).toBe(2);
  });

  it("ciclo 2 completo com o ciclo 1 furado não conta nenhum", () => {
    // Sem o ciclo 1 fechado, o TM nunca subiu a primeira vez.
    const ciclo2 = [1, 2, 3, 4].flatMap((sem) => LIFTS.map((id) => feita(id, 2, sem)));
    expect(ciclosConcluidos(LIFTS, ciclo2)).toBe(0);
  });

  it("sem levantamentos, zero", () => {
    expect(ciclosConcluidos([], [])).toBe(0);
  });
});

describe("a sessão de verdade, ponta a ponta", () => {
  it("TM 130 na semana 2 dá as cargas do mockup", () => {
    // Conferido à mão: 40/50/60% = 52,5 / 65 / 77,5 e 70/80/90% = 90 / 105 / 117,5
    expect(resumo(130, 2)).toEqual([
      "5×52.5", "5×65", "3×77.5",
      "3×90", "3×105", "3+×117.5",
    ]);
  });
});

describe("sugestão de levantamentos", () => {
  const CATALOGO = [
    { nome: "Agachamento hack" },
    { nome: "Agachamento livre" },
    { nome: "Agachamento frontal" },
    { nome: "Agachamento no Smith" },
    { nome: "Supino fechado" },
    { nome: "Supino na máquina" },
    { nome: "Supino reto com barra" },
    { nome: "Supino declinado com barra" },
    { nome: "Levantamento terra" },
    { nome: "Levantamento terra romeno" },
    { nome: "Desenvolvimento Arnold" },
    { nome: "Desenvolvimento militar" },
    { nome: "Desenvolvimento militar com barra" },
  ];

  it("escolhe o levantamento principal, não uma variação", () => {
    // O bug real: "Agachamento frontal" e "Supino declinado" foram sugeridos
    // por serem os primeiros a conter a palavra.
    const escolhas = LEVANTAMENTOS_SUGERIDOS.map(
      (s) => escolherSugestao(CATALOGO, s)?.nome,
    );
    expect(escolhas).toEqual([
      "Agachamento livre",
      "Supino reto com barra",
      "Levantamento terra",
      "Desenvolvimento militar com barra",
    ]);
  });

  it("cai para o termo genérico quando o específico não existe", () => {
    const magro = [{ nome: "Agachamento no Smith" }];
    expect(escolherSugestao(magro, LEVANTAMENTOS_SUGERIDOS[0])?.nome).toBe(
      "Agachamento no Smith",
    );
  });

  it("entre variações do mesmo termo, prefere o nome mais curto", () => {
    // Variação carrega palavra a mais; o nome curto é o levantamento base.
    const so = [{ nome: "Levantamento terra romeno" }, { nome: "Levantamento terra" }];
    expect(escolherSugestao(so, LEVANTAMENTOS_SUGERIDOS[2])?.nome).toBe("Levantamento terra");
  });

  it("ignora acento e caixa", () => {
    expect(escolherSugestao([{ nome: "AGACHAMENTO LÍVRE" }], LEVANTAMENTOS_SUGERIDOS[0])).not.toBeNull();
  });

  it("devolve null quando o catálogo não tem nada parecido", () => {
    expect(escolherSugestao([{ nome: "Rosca direta" }], LEVANTAMENTOS_SUGERIDOS[0])).toBeNull();
  });
});
