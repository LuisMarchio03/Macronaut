import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  LIMITE_BATCH,
  PedidoInvalido,
  executarPedido,
  lerPedido,
  serializar,
  type ResultadoSerializado,
} from "./db-core";

let db: Client;

beforeEach(async () => {
  db = await createTestDb();
  await db.executeMultiple(`
    INSERT INTO users (email, password_hash, created_at) VALUES ('a@x.com', 'h', 't');
    INSERT INTO meals (user_id, nome, horario, ordem) VALUES (1, 'Café', '07:00', 0);
  `);
});

const um = (r: ResultadoSerializado | ResultadoSerializado[]) => r as ResultadoSerializado;
const varios = (r: ResultadoSerializado | ResultadoSerializado[]) => r as ResultadoSerializado[];

describe("lerPedido", () => {
  it("aceita um execute", () => {
    expect(lerPedido({ tipo: "execute", comando: { sql: "SELECT 1", args: [] } })).toEqual({
      tipo: "execute",
      comando: { sql: "SELECT 1", args: [] },
    });
  });

  it("aceita um batch com modo", () => {
    const p = lerPedido({
      tipo: "batch",
      comandos: [{ sql: "SELECT 1" }, { sql: "SELECT 2" }],
      modo: "write",
    });
    expect(p).toMatchObject({ tipo: "batch", modo: "write" });
  });

  it("recusa o que não é pedido", () => {
    for (const corpo of [null, "x", {}, { tipo: "drop" }, { tipo: "execute" }]) {
      expect(() => lerPedido(corpo)).toThrow(PedidoInvalido);
    }
  });

  it("recusa sql vazio", () => {
    expect(() => lerPedido({ tipo: "execute", comando: { sql: "  " } })).toThrow(/sql ausente/);
  });

  it("recusa batch vazio e batch gigante", () => {
    expect(() => lerPedido({ tipo: "batch", comandos: [] })).toThrow(/vazio/);
    const muitos = Array.from({ length: LIMITE_BATCH + 1 }, () => ({ sql: "SELECT 1" }));
    expect(() => lerPedido({ tipo: "batch", comandos: muitos })).toThrow(/acima de/);
  });

  it("recusa modo inventado", () => {
    // O modo vai direto para o libsql; deixar passar seria transporte cego.
    expect(() =>
      lerPedido({ tipo: "batch", comandos: [{ sql: "SELECT 1" }], modo: "destruir" }),
    ).toThrow(/modo inválido/);
  });
});

describe("executarPedido", () => {
  it("um SELECT volta com colunas e linhas por nome", async () => {
    const r = um(await executarPedido(db, {
      tipo: "execute",
      comando: { sql: "SELECT id, nome FROM meals WHERE user_id = ?", args: [1] },
    }));

    expect(r.columns).toEqual(["id", "nome"]);
    expect(r.rows).toEqual([{ id: 1, nome: "Café" }]);
  });

  it("um INSERT volta com lastInsertRowid utilizável", async () => {
    // Meia dúzia de repositórios fazem `Number(rs.lastInsertRowid)`; se isso
    // não atravessar, cada criação passa a devolver id `NaN`.
    const r = um(await executarPedido(db, {
      tipo: "execute",
      comando: {
        sql: "INSERT INTO meals (user_id, nome, horario, ordem) VALUES (?, ?, ?, ?)",
        args: [1, "Almoço", "12:00", 1],
      },
    }));

    expect(r.rowsAffected).toBe(1);
    expect(Number(r.lastInsertRowid)).toBe(2);
  });

  it("bigint vira número, porque JSON não tem bigint", async () => {
    const r = um(await executarPedido(db, {
      tipo: "execute",
      comando: { sql: "SELECT COUNT(*) AS n FROM meals" },
    }));
    expect(r.rows[0].n).toBe(1);
    expect(JSON.parse(JSON.stringify(r)).rows[0].n).toBe(1);
  });

  it("NULL continua NULL do outro lado", async () => {
    const r = um(await executarPedido(db, {
      tipo: "execute",
      comando: { sql: "SELECT NULL AS vazio, 1.5 AS decimal, 'oi' AS texto" },
    }));
    expect(r.rows[0]).toEqual({ vazio: null, decimal: 1.5, texto: "oi" });
  });

  it("um batch devolve um resultado por comando, na ordem", async () => {
    const r = varios(await executarPedido(db, {
      tipo: "batch",
      modo: "write",
      comandos: [
        { sql: "INSERT INTO meals (user_id, nome, horario, ordem) VALUES (1,'A',NULL,1)" },
        { sql: "INSERT INTO meals (user_id, nome, horario, ordem) VALUES (1,'B',NULL,2)" },
        { sql: "SELECT nome FROM meals ORDER BY ordem" },
      ],
    }));

    expect(r).toHaveLength(3);
    expect(r[2].rows.map((x) => x.nome)).toEqual(["Café", "A", "B"]);
  });

  it("erro de SQL sobe como erro, não como resultado vazio", async () => {
    await expect(
      executarPedido(db, { tipo: "execute", comando: { sql: "SELECT * FROM tabela_que_nao_existe" } }),
    ).rejects.toThrow();
  });

  it("o resultado inteiro sobrevive a uma ida e volta por JSON", async () => {
    const r = await executarPedido(db, {
      tipo: "execute",
      comando: { sql: "SELECT * FROM meals" },
    });
    expect(() => JSON.stringify(r)).not.toThrow();
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});

describe("serializar", () => {
  it("resultado sem colunas (um INSERT) não quebra", async () => {
    const rs = await db.execute("INSERT INTO meals (user_id,nome,horario,ordem) VALUES (1,'X',NULL,9)");
    const s = serializar(rs);
    expect(s.rows).toEqual([]);
    expect(s.rowsAffected).toBe(1);
  });
});
