import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { gravarLote, lerLote } from "./ingest-core";
import { listActivitySessionsByRange } from "../../src/repositories/activities";
import { getWeighInsByRange } from "../../src/repositories/weighins";
import { getWaterTotal } from "../../src/repositories/water";

/**
 * O contrato entre o app Android e este servidor.
 *
 * O lado Kotlin não é compilado nem testado aqui — não há toolchain Android
 * nesta máquina, e o Samsung Health não roda em emulador. O que dá para
 * prender é a FORMA do que ele manda: `android/contrato/exemplo-lote.json` é o
 * mesmo arquivo que a documentação da Fase 2 mostra e que o teste do worker
 * Kotlin usa como fixture.
 *
 * Se alguém mudar a validação do servidor e quebrar o app do celular, este
 * teste cai antes do deploy — que é o mais perto de testar o Android que este
 * repositório consegue chegar.
 */

const AQUI = fileURLToPath(import.meta.url);
const LOTE = JSON.parse(
  readFileSync(resolve(dirname(AQUI), "../../android/contrato/exemplo-lote.json"), "utf-8"),
) as unknown;

const USER = 3;
let db: Client;

beforeEach(async () => {
  db = await createTestDb();
});

describe("contrato com o app Android", () => {
  it("o lote de exemplo é aceito pelo servidor", () => {
    expect(() => lerLote(LOTE)).not.toThrow();
  });

  it("o lote de exemplo grava exatamente o que promete", async () => {
    const r = await gravarLote(db, USER, lerLote(LOTE));
    expect(r).toEqual({ atividades: 2, pesos: 1, aguas: 2 });

    const atividades = await listActivitySessionsByRange(db, USER, "2026-08-01", "2026-08-31");
    expect(atividades.map((a) => a.tipo).sort()).toEqual(["Corrida", "Musculação"]);
    expect(atividades.find((a) => a.tipo === "Corrida")).toMatchObject({
      duracao_min: 32.5,
      kcal: 415,
    });

    const pesos = await getWeighInsByRange(db, USER, "2026-08-01", "2026-08-31");
    expect(pesos).toEqual([expect.objectContaining({ data: "2026-08-31", peso_kg: 81.6 })]);
    expect(await getWaterTotal(db, USER, "2026-08-31")).toBe(750);
  });

  it("reenviar o mesmo lote não soma nada — é o que o worker faz toda vez", async () => {
    await gravarLote(db, USER, lerLote(LOTE));
    await gravarLote(db, USER, lerLote(LOTE));

    expect(await listActivitySessionsByRange(db, USER, "2026-08-01", "2026-08-31")).toHaveLength(2);
    expect(await getWeighInsByRange(db, USER, "2026-08-01", "2026-08-31")).toHaveLength(1);
    expect(await getWaterTotal(db, USER, "2026-08-31")).toBe(750);
  });

  it("os campos que o Kotlin preenche são exatamente os que o servidor lê", () => {
    // Um campo a mais no Kotlin que o servidor ignora em silêncio é um bug que
    // só aparece no celular de quem instalou. Este teste falha na hora.
    const lote = LOTE as Record<string, Record<string, unknown>[]>;
    expect(Object.keys(lote.atividades[0]).sort()).toEqual(
      ["data", "duracao_min", "kcal", "origem_id", "tipo"],
    );
    expect(Object.keys(lote.pesos[0]).sort()).toEqual(["data", "peso_kg"]);
    expect(Object.keys(lote.aguas[0]).sort()).toEqual(["data", "ml", "origem_id"]);
  });

  it("a origem do exemplo é uma das que o servidor conhece", () => {
    expect(lerLote(LOTE).origem).toBe("health-connect");
  });
});
