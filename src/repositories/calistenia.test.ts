import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  apagarMeta, apagarSerie, exerciciosDeCalistenia, listarMetas, registrarSerie,
  salvarMeta, seriesDoDia, seriesPorRange, usadosRecentemente,
} from "./calistenia";

const USER = 1;
const OUTRO = 2;
let db: Client;

async function exercicio(
  nome: string,
  extras: { fracao?: number; met?: number; medida?: string; equipamento?: string } = {},
): Promise<number> {
  const rs = await db.execute({
    sql: `INSERT INTO exercises
            (user_id, nome, source, equipamento, met, fracao_corporal, medida, created_at)
          VALUES (NULL, ?, 'catalogo', ?, ?, ?, ?, 't')`,
    args: [
      nome,
      extras.equipamento ?? "peso_corporal",
      extras.met ?? 8,
      extras.fracao ?? 0.64,
      extras.medida ?? null,
    ],
  });
  return Number(rs.lastInsertRowid);
}

beforeEach(async () => { db = await createTestDb(); });

describe("registrarSerie", () => {
  it("grava as repetições e traz a ficha do exercício junto na leitura", async () => {
    const flexao = await exercicio("Flexão de braço");

    await registrarSerie(db, USER, {
      data: "2026-08-28", exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });

    const series = await seriesDoDia(db, USER, "2026-08-28");
    expect(series).toHaveLength(1);
    expect(series[0].nome).toBe("Flexão de braço");
    expect(series[0].reps).toBe(20);
    expect(series[0].fracao_corporal).toBeCloseTo(0.64, 2);
    expect(series[0].met).toBe(8);
  });

  it("grava isometria em segundos", async () => {
    const prancha = await exercicio("Prancha", { medida: "segundos" });

    await registrarSerie(db, USER, {
      data: "2026-08-28", exercise_id: prancha, reps: null, segundos: 60, peso_extra_kg: null,
    });

    const [s] = await seriesDoDia(db, USER, "2026-08-28");
    expect(s.segundos).toBe(60);
    expect(s.reps).toBeNull();
  });

  // O CHECK do schema é o que impede uma série de dizer duas coisas ao mesmo
  // tempo — e uma que não diz nenhuma não é série.
  it("recusa série sem medida nenhuma", async () => {
    const flexao = await exercicio("Flexão de braço");
    await expect(
      registrarSerie(db, USER, {
        data: "2026-08-28", exercise_id: flexao, reps: null, segundos: null, peso_extra_kg: null,
      }),
    ).rejects.toThrow();
  });

  it("recusa série com as duas medidas", async () => {
    const flexao = await exercicio("Flexão de braço");
    await expect(
      registrarSerie(db, USER, {
        data: "2026-08-28", exercise_id: flexao, reps: 20, segundos: 60, peso_extra_kg: null,
      }),
    ).rejects.toThrow();
  });

  it("uma série de um usuário não aparece para o outro", async () => {
    const flexao = await exercicio("Flexão de braço");
    await registrarSerie(db, USER, {
      data: "2026-08-28", exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });
    expect(await seriesDoDia(db, OUTRO, "2026-08-28")).toHaveLength(0);
  });
});

describe("apagarSerie", () => {
  it("tira a série do dia", async () => {
    const flexao = await exercicio("Flexão de braço");
    const id = await registrarSerie(db, USER, {
      data: "2026-08-28", exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });

    await apagarSerie(db, USER, id);

    expect(await seriesDoDia(db, USER, "2026-08-28")).toHaveLength(0);
  });

  it("um usuário não apaga a série do outro", async () => {
    const flexao = await exercicio("Flexão de braço");
    const id = await registrarSerie(db, USER, {
      data: "2026-08-28", exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });

    await apagarSerie(db, OUTRO, id);

    expect(await seriesDoDia(db, USER, "2026-08-28")).toHaveLength(1);
  });
});

describe("seriesPorRange", () => {
  it("filtra pelo período e devolve em ordem cronológica", async () => {
    const flexao = await exercicio("Flexão de braço");
    for (const data of ["2026-08-25", "2026-08-27", "2026-08-30"]) {
      await registrarSerie(db, USER, {
        data, exercise_id: flexao, reps: 10, segundos: null, peso_extra_kg: null,
      });
    }

    const dentro = await seriesPorRange(db, USER, "2026-08-26", "2026-08-28");

    expect(dentro.map((s) => s.data)).toEqual(["2026-08-27"]);
  });
});

describe("exerciciosDeCalistenia", () => {
  it("traz os de peso corporal do catálogo e os próprios do usuário", async () => {
    await exercicio("Flexão de braço");
    await exercicio("Supino reto", { equipamento: "barra" });
    await db.execute({
      sql: `INSERT INTO exercises (user_id, nome, source, equipamento, created_at)
            VALUES (?, 'Flexão na parede', 'custom', 'peso_corporal', 't')`,
      args: [USER],
    });

    const lista = await exerciciosDeCalistenia(db, USER);

    expect(lista.map((e) => e.nome).sort()).toEqual(["Flexão de braço", "Flexão na parede"]);
  });

  it("não traz o exercício próprio de outro usuário", async () => {
    await db.execute({
      sql: `INSERT INTO exercises (user_id, nome, source, equipamento, created_at)
            VALUES (?, 'Flexão do vizinho', 'custom', 'peso_corporal', 't')`,
      args: [OUTRO],
    });
    expect(await exerciciosDeCalistenia(db, USER)).toHaveLength(0);
  });

  it("exercício sem medida declarada conta em repetições", async () => {
    await exercicio("Flexão de braço");
    const [e] = await exerciciosDeCalistenia(db, USER);
    expect(e.medida).toBe("reps");
  });
});

describe("usadosRecentemente", () => {
  // São os chips do card: o que você registra sempre tem que estar a um toque,
  // e a última quantidade é o que o stepper abre preenchido.
  it("ordena por frequência e traz a última quantidade de cada um", async () => {
    const flexao = await exercicio("Flexão de braço");
    const agacho = await exercicio("Agachamento");
    for (const reps of [20, 25, 30]) {
      await registrarSerie(db, USER, {
        data: "2026-08-28", exercise_id: flexao, reps, segundos: null, peso_extra_kg: null,
      });
    }
    await registrarSerie(db, USER, {
      data: "2026-08-28", exercise_id: agacho, reps: 15, segundos: null, peso_extra_kg: null,
    });

    const chips = await usadosRecentemente(db, USER, "2026-08-01", 5);

    expect(chips[0].nome).toBe("Flexão de braço");
    expect(chips[0].vezes).toBe(3);
    expect(chips[0].ultima_qtd).toBe(30);
    expect(chips[1].nome).toBe("Agachamento");
  });

  it("ignora o que ficou fora da janela", async () => {
    const flexao = await exercicio("Flexão de braço");
    await registrarSerie(db, USER, {
      data: "2026-07-01", exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });
    expect(await usadosRecentemente(db, USER, "2026-08-01", 5)).toHaveLength(0);
  });

  it("na isometria a última quantidade são os segundos", async () => {
    const prancha = await exercicio("Prancha", { medida: "segundos" });
    await registrarSerie(db, USER, {
      data: "2026-08-28", exercise_id: prancha, reps: null, segundos: 90, peso_extra_kg: null,
    });

    const [chip] = await usadosRecentemente(db, USER, "2026-08-01", 5);

    expect(chip.medida).toBe("segundos");
    expect(chip.ultima_qtd).toBe(90);
  });

  it("não conta a série de outro usuário", async () => {
    const flexao = await exercicio("Flexão de braço");
    await registrarSerie(db, OUTRO, {
      data: "2026-08-28", exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });
    expect(await usadosRecentemente(db, USER, "2026-08-01", 5)).toHaveLength(0);
  });
});

describe("metas", () => {
  it("salva, lê e apaga a meta diária", async () => {
    const flexao = await exercicio("Flexão de braço");

    await salvarMeta(db, USER, flexao, 100);
    expect(await listarMetas(db, USER)).toEqual([
      { exercise_id: flexao, nome: "Flexão de braço", medida: "reps", alvo_dia: 100 },
    ]);

    await apagarMeta(db, USER, flexao);
    expect(await listarMetas(db, USER)).toHaveLength(0);
  });

  it("salvar de novo atualiza o alvo em vez de duplicar", async () => {
    const flexao = await exercicio("Flexão de braço");
    await salvarMeta(db, USER, flexao, 100);
    await salvarMeta(db, USER, flexao, 150);

    const metas = await listarMetas(db, USER);
    expect(metas).toHaveLength(1);
    expect(metas[0].alvo_dia).toBe(150);
  });

  it("a meta de um usuário não aparece para o outro", async () => {
    const flexao = await exercicio("Flexão de braço");
    await salvarMeta(db, USER, flexao, 100);
    expect(await listarMetas(db, OUTRO)).toHaveLength(0);
  });

  it("um usuário não apaga a meta do outro", async () => {
    const flexao = await exercicio("Flexão de braço");
    await salvarMeta(db, USER, flexao, 100);

    await apagarMeta(db, OUTRO, flexao);

    expect(await listarMetas(db, USER)).toHaveLength(1);
  });
});
