import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { LIMITE_ITENS, LoteInvalido, gravarLote, lerLote, type Lote } from "./ingest-core";
import { listActivitySessionsByRange } from "../../src/repositories/activities";
import { getWeighInsByRange } from "../../src/repositories/weighins";

const USER = 1;
let db: Client;

beforeEach(async () => {
  db = await createTestDb();
});

const lote = (over: Partial<Lote> = {}): Lote => ({
  origem: "health-connect",
  atividades: [],
  pesos: [],
  ...over,
});

const corrida = (over: Record<string, unknown> = {}) => ({
  origem_id: "hc-1",
  data: "2026-08-31",
  tipo: "Corrida",
  duracao_min: 30,
  kcal: 400,
  ...over,
});

describe("lerLote", () => {
  it("aceita um lote bem formado", () => {
    const l = lerLote({ origem: "health-connect", atividades: [corrida()], pesos: [] });
    expect(l.atividades[0]).toEqual(corrida());
  });

  it("listas ausentes viram listas vazias", () => {
    expect(lerLote({ origem: "samsung-health" })).toEqual(lote({ origem: "samsung-health" }));
  });

  it("recusa origem que o servidor não conhece", () => {
    expect(() => lerLote({ origem: "meu-app", atividades: [] })).toThrow(/origem desconhecida/);
  });

  it("recusa data que não é YYYY-MM-DD", () => {
    expect(() => lerLote({ origem: "health-connect", atividades: [corrida({ data: "31/08/2026" })] }))
      .toThrow(/YYYY-MM-DD/);
  });

  it("recusa item sem id de origem — sem ele não há deduplicação", () => {
    expect(() => lerLote({ origem: "health-connect", atividades: [corrida({ origem_id: "" })] }))
      .toThrow(/origem_id ausente/);
  });

  it("recusa números fora da faixa do plausível", () => {
    // Um treino de 25 horas é um relógio que não parou de contar.
    expect(() => lerLote({ origem: "health-connect", atividades: [corrida({ duracao_min: 25 * 60 })] }))
      .toThrow(/fora da faixa/);
    expect(() => lerLote({ origem: "health-connect", atividades: [corrida({ duracao_min: 0 })] }))
      .toThrow(/fora da faixa/);
    expect(() => lerLote({ origem: "health-connect", pesos: [{ data: "2026-08-31", peso_kg: 900 }] }))
      .toThrow(/fora da faixa/);
  });

  it("recusa NaN e infinito, que atravessam JSON como null mas não como número", () => {
    expect(() => lerLote({ origem: "health-connect", atividades: [corrida({ kcal: "muitas" })] }))
      .toThrow(/kcal inválido/);
  });

  it("recusa lote gigante", () => {
    const muitos = Array.from({ length: LIMITE_ITENS + 1 }, (_, i) => corrida({ origem_id: `x${i}` }));
    expect(() => lerLote({ origem: "health-connect", atividades: muitos })).toThrow(/acima de/);
  });

  it("recusa corpo que não é objeto", () => {
    for (const c of [null, "x", 3]) expect(() => lerLote(c)).toThrow(LoteInvalido);
  });
});

describe("gravarLote", () => {
  it("grava a atividade com a origem, e ela entra no período", async () => {
    await gravarLote(db, USER, lote({ atividades: [corrida()] }));

    const as = await listActivitySessionsByRange(db, USER, "2026-08-01", "2026-08-31");
    expect(as).toHaveLength(1);
    expect(as[0]).toMatchObject({ tipo: "Corrida", duracao_min: 30, kcal: 400 });
  });

  it("sincronizar de novo NÃO duplica: o mesmo origem_id atualiza", async () => {
    // É o caso que acontece toda vez — o worker manda a mesma janela de dias.
    await gravarLote(db, USER, lote({ atividades: [corrida()] }));
    await gravarLote(db, USER, lote({ atividades: [corrida({ kcal: 420 })] }));

    const as = await listActivitySessionsByRange(db, USER, "2026-08-01", "2026-08-31");
    expect(as).toHaveLength(1);
    expect(as[0].kcal).toBe(420);
  });

  it("ids diferentes viram registros diferentes", async () => {
    await gravarLote(db, USER, {
      origem: "health-connect",
      atividades: [corrida({ origem_id: "a" }), corrida({ origem_id: "b" })],
      pesos: [],
    });
    expect(await listActivitySessionsByRange(db, USER, "2026-08-01", "2026-08-31")).toHaveLength(2);
  });

  it("origens diferentes não colidem, mesmo com o mesmo id", async () => {
    await gravarLote(db, USER, lote({ origem: "health-connect", atividades: [corrida()] }));
    await gravarLote(db, USER, lote({ origem: "samsung-health", atividades: [corrida()] }));
    expect(await listActivitySessionsByRange(db, USER, "2026-08-01", "2026-08-31")).toHaveLength(2);
  });

  it("NÃO toca no que você registrou dentro do app", async () => {
    // O cardio registrado na sessão de treino tem `origem` nula. Se a
    // sincronização o apagasse, o balanço energético mudaria sozinho.
    await db.execute({
      sql: `INSERT INTO activity_sessions (user_id, data, tipo, duracao_min, kcal, created_at)
            VALUES (?, '2026-08-31', 'Bicicleta', 40, 300, 't')`,
      args: [USER],
    });
    await gravarLote(db, USER, lote({ atividades: [corrida()] }));
    await gravarLote(db, USER, lote({ atividades: [corrida()] }));

    const as = await listActivitySessionsByRange(db, USER, "2026-08-01", "2026-08-31");
    expect(as).toHaveLength(2);
    expect(as.find((a) => a.tipo === "Bicicleta")).toBeDefined();
  });

  it("não mexe no dado de outro usuário com o mesmo origem_id", async () => {
    await gravarLote(db, 2, lote({ atividades: [corrida()] }));
    await gravarLote(db, USER, lote({ atividades: [corrida({ kcal: 999 })] }));

    expect((await listActivitySessionsByRange(db, 2, "2026-08-01", "2026-08-31"))[0].kcal).toBe(400);
  });

  it("grava o peso, e a pesagem do mesmo dia é corrigida em vez de duplicada", async () => {
    await gravarLote(db, USER, lote({ pesos: [{ data: "2026-08-31", peso_kg: 82.4 }] }));
    await gravarLote(db, USER, lote({ pesos: [{ data: "2026-08-31", peso_kg: 82.1 }] }));

    const pesos = await getWeighInsByRange(db, USER, "2026-08-01", "2026-08-31");
    expect(pesos).toHaveLength(1);
    expect(pesos[0].peso_kg).toBe(82.1);
  });

  it("devolve quantos itens entraram", async () => {
    const r = await gravarLote(db, USER, {
      origem: "health-connect",
      atividades: [corrida({ origem_id: "a" }), corrida({ origem_id: "b" })],
      pesos: [{ data: "2026-08-31", peso_kg: 82 }],
    });
    expect(r).toEqual({ atividades: 2, pesos: 1 });
  });

  it("lote vazio não escreve nada e não explode", async () => {
    expect(await gravarLote(db, USER, lote())).toEqual({ atividades: 0, pesos: 0 });
  });
});
