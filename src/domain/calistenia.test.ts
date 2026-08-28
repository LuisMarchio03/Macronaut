import { describe, it, expect } from "vitest";
import {
  kcalDaSerie, kcalPorDia, medidaDa, quantidadeDa, recordeDeSerie, segundosDeEsforco,
  sequenciaDeDias, tendencia, totaisPorDia, totaisPorExercicio, volumeEquivalente,
  type SerieAvulsa,
} from "./calistenia";

const PESO = 80;

function serie(p: Partial<SerieAvulsa> = {}): SerieAvulsa {
  return {
    id: 1, data: "2026-08-28", created_at: "2026-08-28T10:00:00.000Z",
    exercise_id: 1, nome: "Flexão de braço", grupo: "Peito",
    reps: 20, segundos: null, peso_extra_kg: null,
    fracao_corporal: 0.64, met: 8,
    ...p,
  };
}

describe("medida da série", () => {
  it("com segundos é isometria", () => {
    expect(medidaDa(serie({ reps: null, segundos: 60 }))).toBe("segundos");
  });

  it("com reps é repetição", () => {
    expect(medidaDa(serie())).toBe("reps");
  });

  it("a quantidade é a medida que a série tem", () => {
    expect(quantidadeDa(serie())).toBe(20);
    expect(quantidadeDa(serie({ reps: null, segundos: 45 }))).toBe(45);
  });
});

describe("volumeEquivalente", () => {
  // 20 flexões de um corpo de 80 kg movem 0,64 × 80 = 51,2 kg por repetição.
  it("é a fração do corpo vezes as repetições", () => {
    expect(volumeEquivalente(serie(), PESO)).toBeCloseTo(1024, 1);
  });

  it("o peso extra entra por cima do corpo", () => {
    expect(volumeEquivalente(serie({ reps: 10, peso_extra_kg: 10 }), PESO)).toBeCloseTo(612, 1);
  });

  // Isometria não tem repetição, e inventar uma para gerar volume seria
  // devolver um número que ninguém pode conferir.
  it("isometria não gera volume em kg", () => {
    expect(volumeEquivalente(serie({ reps: null, segundos: 60 }), PESO)).toBe(0);
  });

  it("exercício sem fração medida usa a fração padrão", () => {
    expect(volumeEquivalente(serie({ reps: 10, fracao_corporal: null }), PESO)).toBeCloseTo(400, 1);
  });
});

describe("segundosDeEsforco", () => {
  it("isometria são os próprios segundos", () => {
    expect(segundosDeEsforco(serie({ reps: null, segundos: 45 }))).toBe(45);
  });

  it("repetição vira tempo pela estimativa de 3s por rep", () => {
    expect(segundosDeEsforco(serie({ reps: 20 }))).toBe(60);
  });
});

describe("kcalDaSerie", () => {
  // MET 8, 80 kg, 60 s = 8 × 80 × (1/60) h = 10,67 kcal.
  it("é a mesma conta do cardio: MET × peso × horas", () => {
    expect(kcalDaSerie(serie(), PESO)).toBeCloseTo(10.67, 1);
  });

  it("exercício sem MET usa o MET padrão da calistenia", () => {
    expect(kcalDaSerie(serie({ met: null }), PESO)).toBeCloseTo(10.67, 1);
  });

  // Sem peso no perfil não há como estimar, e devolver um número feito de
  // zero seria pior do que devolver zero.
  it("sem peso corporal a caloria é zero", () => {
    expect(kcalDaSerie(serie(), 0)).toBe(0);
  });
});

describe("totaisPorDia", () => {
  it("soma reps, segundos, volume e caloria por dia", () => {
    const totais = totaisPorDia(
      [
        serie({ id: 1, data: "2026-08-28", reps: 20 }),
        serie({ id: 2, data: "2026-08-28", reps: 15 }),
        serie({ id: 3, data: "2026-08-27", reps: null, segundos: 60 }),
      ],
      PESO,
    );

    expect(totais.get("2026-08-28")!.reps).toBe(35);
    expect(totais.get("2026-08-28")!.nSeries).toBe(2);
    expect(totais.get("2026-08-27")!.segundos).toBe(60);
    expect(totais.get("2026-08-27")!.reps).toBe(0);
  });
});

describe("totaisPorExercicio", () => {
  it("agrupa por exercício e traz o recorde de série única", () => {
    const linhas = totaisPorExercicio(
      [
        serie({ id: 1, exercise_id: 1, reps: 20 }),
        serie({ id: 2, exercise_id: 1, reps: 30 }),
        serie({ id: 3, exercise_id: 2, nome: "Prancha", reps: null, segundos: 60 }),
      ],
      PESO,
    );

    const flexao = linhas.find((l) => l.exercise_id === 1)!;
    expect(flexao.quantidade).toBe(50);
    expect(flexao.recorde).toBe(30);
    expect(flexao.nSeries).toBe(2);
    expect(flexao.medida).toBe("reps");
    expect(linhas.find((l) => l.exercise_id === 2)!.medida).toBe("segundos");
  });

  it("o exercício de maior volume vem primeiro", () => {
    const linhas = totaisPorExercicio(
      [
        serie({ id: 1, exercise_id: 1, reps: 5 }),
        serie({ id: 2, exercise_id: 2, nome: "Agachamento", reps: 100 }),
      ],
      PESO,
    );
    expect(linhas[0].exercise_id).toBe(2);
  });
});

describe("kcalPorDia", () => {
  it("é o mapa que a análise soma ao gasto do cardio", () => {
    const m = kcalPorDia([serie({ id: 1, data: "2026-08-28" })], PESO);
    expect(m.get("2026-08-28")).toBeCloseTo(10.67, 1);
  });
});

describe("recordeDeSerie", () => {
  it("é a maior série única do exercício", () => {
    expect(
      recordeDeSerie(
        [
          serie({ id: 1, reps: 20 }),
          serie({ id: 2, reps: 32 }),
          serie({ id: 3, exercise_id: 9, reps: 99 }),
        ],
        1,
      ),
    ).toBe(32);
  });

  it("sem série do exercício não há recorde", () => {
    expect(recordeDeSerie([], 1)).toBeNull();
  });
});

describe("sequenciaDeDias", () => {
  it("conta os dias seguidos até hoje", () => {
    expect(sequenciaDeDias(["2026-08-26", "2026-08-27", "2026-08-28"], "2026-08-28")).toBe(3);
  });

  // Às 8h da manhã você ainda não fez nada, e zerar a sequência de 12 dias
  // nesse momento é punir o usuário pelo relógio.
  it("hoje ainda vazio não quebra a sequência que vinha de ontem", () => {
    expect(sequenciaDeDias(["2026-08-26", "2026-08-27"], "2026-08-28")).toBe(2);
  });

  it("um dia pulado quebra a sequência", () => {
    expect(sequenciaDeDias(["2026-08-24", "2026-08-27", "2026-08-28"], "2026-08-28")).toBe(2);
  });

  it("sem registro nenhum a sequência é zero", () => {
    expect(sequenciaDeDias([], "2026-08-28")).toBe(0);
  });

  it("o mesmo dia repetido conta uma vez", () => {
    expect(sequenciaDeDias(["2026-08-28", "2026-08-28"], "2026-08-28")).toBe(1);
  });

  // Atravessar a virada do mês é onde a aritmética de data costuma quebrar.
  it("atravessa a virada do mês", () => {
    expect(sequenciaDeDias(["2026-07-31", "2026-08-01"], "2026-08-01")).toBe(2);
  });
});

describe("tendencia", () => {
  it("é a variação percentual entre os dois períodos", () => {
    expect(tendencia(120, 100)).toBeCloseTo(20, 5);
    expect(tendencia(80, 100)).toBeCloseTo(-20, 5);
  });

  // "+∞%" não é uma tendência, é uma divisão por zero na tela.
  it("sem base não há tendência", () => {
    expect(tendencia(50, 0)).toBeNull();
  });
});
