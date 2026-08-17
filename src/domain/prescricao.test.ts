import { describe, it, expect } from "vitest";
import {
  planejar,
  posicao531,
  proximoTreino,
  treinoDoDia,
  type Prescricao,
  type SessaoAnterior,
} from "./prescricao";

const DUPLA: Prescricao = {
  tipo: "dupla",
  series: 3,
  reps_min: 8,
  reps_max: 12,
  peso_inicial_kg: 40,
  incremento_kg: 2.5,
};

/** Uma sessão anterior com uma série por repetição informada. */
function sessao(peso: number, reps: number[]): SessaoAnterior {
  return { data: "2026-08-10", sets: reps.map((r) => ({ reps: r, peso_kg: peso })) };
}

describe("planejar — prescrição fixa", () => {
  it("repete a mesma carga e as mesmas reps, ignorando o histórico", () => {
    const p: Prescricao = { tipo: "fixa", series: 4, reps: 15, peso_kg: 20 };
    const s = planejar(p, [sessao(20, [15, 15, 15, 15])]);
    expect(s).toHaveLength(4);
    expect(s.map((x) => x.ordem)).toEqual([1, 2, 3, 4]);
    expect(s.every((x) => x.peso_kg === 20 && x.reps_alvo === 15)).toBe(true);
    expect(s.every((x) => x.tipo === "valida" && !x.amrap)).toBe(true);
  });
});

describe("planejar — dupla progressão", () => {
  it("sem histórico, começa no peso inicial mirando o topo da faixa", () => {
    const s = planejar(DUPLA, []);
    expect(s).toHaveLength(3);
    expect(s[0].peso_kg).toBe(40);
    expect(s[0].reps_alvo).toBe(12);
    expect(s[0].reps_min).toBe(8);
  });

  it("bateu o topo da faixa em TODAS as séries: sobe o incremento", () => {
    const s = planejar(DUPLA, [sessao(40, [12, 12, 12])]);
    expect(s[0].peso_kg).toBe(42.5);
  });

  // A carga sobe pela série mais fraca: 11 numa das três segura o peso.
  it("faltou uma repetição em uma série: mantém a carga", () => {
    const s = planejar(DUPLA, [sessao(40, [12, 12, 11])]);
    expect(s[0].peso_kg).toBe(40);
  });

  it("dentro da faixa mas longe do topo: mantém a carga", () => {
    const s = planejar(DUPLA, [sessao(40, [9, 8, 8])]);
    expect(s[0].peso_kg).toBe(40);
  });

  it("uma falha isolada não derruba a carga", () => {
    const s = planejar(DUPLA, [sessao(40, [8, 8, 6])]);
    expect(s[0].peso_kg).toBe(40);
  });

  it("duas falhas seguidas no mesmo peso derrubam 10%", () => {
    const s = planejar(DUPLA, [sessao(40, [8, 7, 6]), sessao(40, [8, 8, 6])]);
    expect(s[0].peso_kg).toBe(35); // 36 arredondado para baixo no passo de 2,5
  });

  // Falhar em 40 hoje depois de ter falhado em 45 não é reincidência: o peso
  // mudou, e a tentativa em 40 é a primeira nesse peso.
  it("duas falhas em pesos diferentes não derrubam a carga", () => {
    const s = planejar(DUPLA, [sessao(40, [8, 7, 6]), sessao(45, [8, 8, 6])]);
    expect(s[0].peso_kg).toBe(40);
  });

  // Drop set: as séries leves do fim não são a carga de trabalho.
  it("lê a carga de trabalho como o peso mais pesado da sessão", () => {
    const anterior: SessaoAnterior = {
      data: "2026-08-10",
      sets: [
        { reps: 12, peso_kg: 40 },
        { reps: 12, peso_kg: 40 },
        { reps: 12, peso_kg: 40 },
        { reps: 20, peso_kg: 20 },
      ],
    };
    expect(planejar(DUPLA, [anterior])[0].peso_kg).toBe(42.5);
  });
});

describe("planejar — dupla progressão ao longo de seis sessões", () => {
  it("sobe, mantém, mantém, falha, falha, desce", () => {
    const carga = (anteriores: SessaoAnterior[]) => planejar(DUPLA, anteriores)[0].peso_kg;

    const s1: SessaoAnterior[] = [];
    expect(carga(s1)).toBe(40);

    const s2 = [sessao(40, [12, 12, 12]), ...s1];
    expect(carga(s2)).toBe(42.5);

    const s3 = [sessao(42.5, [10, 10, 9]), ...s2];
    expect(carga(s3)).toBe(42.5);

    const s4 = [sessao(42.5, [11, 11, 10]), ...s3];
    expect(carga(s4)).toBe(42.5);

    const s5 = [sessao(42.5, [8, 8, 7]), ...s4];
    expect(carga(s5)).toBe(42.5);

    const s6 = [sessao(42.5, [8, 7, 7]), ...s5];
    expect(carga(s6)).toBe(37.5); // 38,25 arredondado para baixo
  });
});

describe("posicao531", () => {
  it("anda uma semana por sessão do exercício e vira o ciclo a cada quatro", () => {
    expect(posicao531(0)).toEqual({ ciclo: 1, semana: 1 });
    expect(posicao531(3)).toEqual({ ciclo: 1, semana: 4 });
    expect(posicao531(4)).toEqual({ ciclo: 2, semana: 1 });
    expect(posicao531(9)).toEqual({ ciclo: 3, semana: 2 });
  });
});

describe("planejar — 5/3/1", () => {
  const P531: Prescricao = { tipo: "531", tm_kg: 100, parte: "inferior", incremento_kg: 2.5 };

  it("primeira sessão: aquecimento 40/50/60 e trabalho 65/75/85 com AMRAP no fim", () => {
    const s = planejar(P531, []);
    expect(s.map((x) => x.pct)).toEqual([40, 50, 60, 65, 75, 85]);
    expect(s.map((x) => x.peso_kg)).toEqual([40, 50, 60, 65, 75, 85]);
    expect(s.slice(0, 3).every((x) => x.tipo === "aquecimento")).toBe(true);
    expect(s.filter((x) => x.amrap)).toHaveLength(1);
    expect(s[5].amrap).toBe(true);
    expect(s[5].reps_alvo).toBe(5);
    expect(s.map((x) => x.ordem)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("quarta sessão é deload: sem aquecimento e sem AMRAP", () => {
    const feitas = Array.from({ length: 3 }, () => sessao(85, [5]));
    const s = planejar(P531, feitas);
    expect(s.map((x) => x.pct)).toEqual([40, 50, 60]);
    expect(s.some((x) => x.amrap)).toBe(false);
    expect(s.every((x) => x.tipo === "valida")).toBe(true);
  });

  // Fechado o ciclo, o TM sobe — 5 kg no inferior — e todas as cargas do ciclo
  // seguinte saem do TM novo, não do original.
  it("depois de quatro sessões, o Training Max sobe", () => {
    const feitas = Array.from({ length: 4 }, () => sessao(85, [5]));
    const s = planejar(P531, feitas);
    expect(s.map((x) => x.pct)).toEqual([40, 50, 60, 65, 75, 85]);
    expect(s[3].peso_kg).toBe(67.5); // 65% de 105
  });

  // Superior sobe 2,5 e inferior 5 por ciclo. A série de 65% arredonda para o
  // mesmo 67,5 nos dois e não distinguiria nada; a de 85% separa: 85% de 102,5
  // dá 87,5, 85% de 105 dá 90.
  it("no superior o Training Max sobe 2,5 kg por ciclo, contra 5 no inferior", () => {
    const feitas = Array.from({ length: 4 }, () => sessao(85, [5]));
    const superior: Prescricao = { tipo: "531", tm_kg: 100, parte: "superior", incremento_kg: 2.5 };
    expect(planejar(superior, feitas)[5].peso_kg).toBe(87.5);
    expect(planejar(P531, feitas)[5].peso_kg).toBe(90);
  });
});

describe("treinoDoDia e proximoTreino", () => {
  // 1 = segunda, 3 = quarta, 5 = sexta
  const DIAS = [
    { dia_semana: 1, nome: "Peito e tríceps" },
    { dia_semana: 3, nome: "Costas e bíceps" },
    { dia_semana: 5, nome: "Perna" },
  ];

  it("acha o treino do dia", () => {
    expect(treinoDoDia(DIAS, 3)?.nome).toBe("Costas e bíceps");
  });

  it("devolve null num dia de descanso", () => {
    expect(treinoDoDia(DIAS, 2)).toBeNull();
  });

  it("o próximo treino é o dia de treino seguinte", () => {
    expect(proximoTreino(DIAS, 2)?.nome).toBe("Costas e bíceps");
  });

  it("dá a volta na semana", () => {
    expect(proximoTreino(DIAS, 6)?.nome).toBe("Peito e tríceps");
  });

  it("rotina sem dia nenhum não tem próximo", () => {
    expect(proximoTreino([], 2)).toBeNull();
    expect(treinoDoDia([], 2)).toBeNull();
  });

  it("com um único dia de treino, o próximo é ele mesmo na semana que vem", () => {
    const um = [{ dia_semana: 1, nome: "Full body" }];
    expect(proximoTreino(um, 1)?.nome).toBe("Full body");
  });
});

describe("planejar — cardio", () => {
  const BIKE: Prescricao = { tipo: "cardio", duracao_min: 30, met: 7.5 };

  it("devolve uma linha só, com a duração prescrita", () => {
    const s = planejar(BIKE, []);
    expect(s).toHaveLength(1);
    expect(s[0].duracao_min).toBe(30);
    expect(s[0].ordem).toBe(1);
    expect(s[0].tipo).toBe("valida");
    expect(s[0].amrap).toBe(false);
  });

  // Zerados de propósito: são campos que não se aplicam, e forjar um número
  // neles faria o volume da sessão mentir.
  it("não inventa reps nem carga", () => {
    const [linha] = planejar(BIKE, []);
    expect(linha.reps_alvo).toBe(0);
    expect(linha.peso_kg).toBe(0);
    expect(linha.reps_min).toBeNull();
    expect(linha.pct).toBeNull();
  });

  it("não progride: o histórico não muda a prescrição", () => {
    const comHistorico = planejar(BIKE, [sessao(0, [0]), sessao(0, [0])]);
    expect(comHistorico).toEqual(planejar(BIKE, []));
  });
});
