import { describe, it, expect } from "vitest";
import { createClient } from "@libsql/client";
import { applyAdditiveColumns } from "./apply-schema";

/** Um banco no formato ANTERIOR à coluna: é isso que existe em produção. */
async function bancoLegado() {
  const db = createClient({ url: ":memory:" });
  await db.execute(`CREATE TABLE workout_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    nome TEXT,
    created_at TEXT NOT NULL
  )`);
  return db;
}

describe("applyAdditiveColumns — iniciado_em", () => {
  it("marca toda sessão pré-existente como iniciada quando foi criada", async () => {
    const db = await bancoLegado();
    await db.execute({
      sql: "INSERT INTO workout_sessions (user_id, data, nome, created_at) VALUES (1,'2026-08-20','Peito',?)",
      args: ["2026-08-20T09:00:00.000Z"],
    });

    await applyAdditiveColumns(db);

    const rs = await db.execute("SELECT iniciado_em, created_at FROM workout_sessions");
    expect(rs.rows[0].iniciado_em).toBe("2026-08-20T09:00:00.000Z");
    expect(rs.rows[0].iniciado_em).toBe(rs.rows[0].created_at);
  });

  it("não reescreve o início de quem já tem um", async () => {
    const db = await bancoLegado();
    await db.execute("ALTER TABLE workout_sessions ADD COLUMN iniciado_em TEXT");
    await db.execute({
      sql: `INSERT INTO workout_sessions (user_id, data, nome, created_at, iniciado_em)
            VALUES (1,'2026-08-20','Peito',?,?)`,
      args: ["2026-08-20T09:00:00.000Z", "2026-08-20T18:30:00.000Z"],
    });

    await applyAdditiveColumns(db);

    const rs = await db.execute("SELECT iniciado_em FROM workout_sessions");
    expect(rs.rows[0].iniciado_em).toBe("2026-08-20T18:30:00.000Z");
  });

  it("rodar duas vezes não muda nada", async () => {
    const db = await bancoLegado();
    await db.execute({
      sql: "INSERT INTO workout_sessions (user_id, data, nome, created_at) VALUES (1,'2026-08-20','Peito',?)",
      args: ["2026-08-20T09:00:00.000Z"],
    });

    await applyAdditiveColumns(db);
    await applyAdditiveColumns(db);

    const rs = await db.execute("SELECT iniciado_em FROM workout_sessions");
    expect(rs.rows[0].iniciado_em).toBe("2026-08-20T09:00:00.000Z");
  });
});

/**
 * A tabela no formato ANTIGO — com UNIQUE e o CHECK de uma origem só.
 *
 * As tabelas referenciadas existem porque o formato NOVO declara chaves
 * estrangeiras para elas: `db.migrate` suspende a checagem durante a troca,
 * mas a religa depois, e um INSERT contra FK órfã falha.
 */
async function bancoComTrocasAntigas() {
  const db = createClient({ url: ":memory:" });
  // `foods` e `food_measures` levam as colunas que ADDITIVE_INDEXES toca: o
  // mesmo `applyAdditiveColumns` cria índices sobre elas, e um stub sem as
  // colunas aborta a aplicação antes de chegar na reconstrução.
  await db.executeMultiple(`
    CREATE TABLE plan_blocks (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE plan_items (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE plan_swaps (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE foods (id INTEGER PRIMARY KEY AUTOINCREMENT, nome_norm TEXT);
    CREATE TABLE food_measures (
      id INTEGER PRIMARY KEY AUTOINCREMENT, food_id INTEGER, status TEXT
    );
  `);
  await db.execute(`CREATE TABLE plan_item_swaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, data TEXT NOT NULL,
    block_id INTEGER NOT NULL, item_id INTEGER NOT NULL,
    swap_id INTEGER, food_id INTEGER, texto TEXT,
    qty_g REAL, measure_id INTEGER, medidas REAL, kcal REAL,
    created_at TEXT NOT NULL,
    UNIQUE (user_id, data, item_id),
    CHECK ((swap_id IS NOT NULL) + (food_id IS NOT NULL) + (texto IS NOT NULL) = 1)
  )`);
  // As linhas que as FKs do formato novo vão exigir.
  await db.executeMultiple(`
    INSERT INTO plan_blocks (id) VALUES (10);
    INSERT INTO plan_items (id) VALUES (5), (9), (11), (12);
    INSERT INTO foods (id) VALUES (42), (77);
  `);
  await db.execute(`INSERT INTO plan_item_swaps
    (user_id, data, block_id, item_id, food_id, qty_g, kcal, created_at)
    VALUES (1, '2026-08-31', 10, 5, 42, 100, 128, '2026-08-31T10:00:00.000Z')`);
  return db;
}

describe("applyAdditiveColumns — plan_item_swaps reconstruída", () => {
  it("preserva as trocas já gravadas, com dispensado = 0", async () => {
    const db = await bancoComTrocasAntigas();
    await applyAdditiveColumns(db);

    const rs = await db.execute("SELECT * FROM plan_item_swaps");
    expect(rs.rows).toHaveLength(1);
    expect(rs.rows[0].food_id).toBe(42);
    expect(rs.rows[0].kcal).toBe(128);
    expect(Number(rs.rows[0].dispensado)).toBe(0);
  });

  it("passa a aceitar duas trocas no mesmo item", async () => {
    const db = await bancoComTrocasAntigas();
    await applyAdditiveColumns(db);

    await db.execute(`INSERT INTO plan_item_swaps
      (user_id, data, block_id, item_id, food_id, qty_g, kcal, created_at, dispensado)
      VALUES (1, '2026-08-31', 10, 5, 77, 50, 90, 't', 0)`);

    const rs = await db.execute("SELECT COUNT(*) AS n FROM plan_item_swaps WHERE item_id=5");
    expect(Number(rs.rows[0].n)).toBe(2);
  });

  it("aceita a dispensa, e só uma por item", async () => {
    const db = await bancoComTrocasAntigas();
    await applyAdditiveColumns(db);

    await db.execute(`INSERT INTO plan_item_swaps
      (user_id, data, block_id, item_id, created_at, dispensado)
      VALUES (1, '2026-08-31', 10, 9, 't', 1)`);

    await expect(db.execute(`INSERT INTO plan_item_swaps
      (user_id, data, block_id, item_id, created_at, dispensado)
      VALUES (1, '2026-08-31', 10, 9, 't', 1)`)).rejects.toThrow();
  });

  it("uma linha ambígua continua recusada", async () => {
    const db = await bancoComTrocasAntigas();
    await applyAdditiveColumns(db);

    // Dispensa COM origem: as duas afirmações não coexistem.
    await expect(db.execute(`INSERT INTO plan_item_swaps
      (user_id, data, block_id, item_id, food_id, created_at, dispensado)
      VALUES (1, '2026-08-31', 10, 11, 42, 't', 1)`)).rejects.toThrow();

    // Troca sem origem nenhuma.
    await expect(db.execute(`INSERT INTO plan_item_swaps
      (user_id, data, block_id, item_id, created_at, dispensado)
      VALUES (1, '2026-08-31', 10, 12, 't', 0)`)).rejects.toThrow();
  });

  it("rodar de novo não mexe em nada", async () => {
    const db = await bancoComTrocasAntigas();
    await applyAdditiveColumns(db);
    await applyAdditiveColumns(db);
    const rs = await db.execute("SELECT COUNT(*) AS n FROM plan_item_swaps");
    expect(Number(rs.rows[0].n)).toBe(1);
  });
});
