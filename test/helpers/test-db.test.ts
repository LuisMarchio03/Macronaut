import { describe, it, expect } from "vitest";
import { createTestDb } from "./test-db";

describe("createTestDb", () => {
  it("aplica o schema e cria as tabelas", async () => {
    const db = await createTestDb();
    const rs = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const nomes = rs.rows.map((r) => r.name);
    expect(nomes).toEqual(
      expect.arrayContaining([
        "food_entries", "foods", "meals", "profile", "water_log",
        "exercises", "workout_sessions", "workout_sets", "activity_types", "activity_sessions",
      ]),
    );
    db.close();
  });

  it("aplica colunas e tabela de medidas caseiras", async () => {
    const db = await createTestDb();

    const foods = await db.execute("PRAGMA table_info(foods)");
    const colsFoods = foods.rows.map((r) => r.name);
    expect(colsFoods).toEqual(expect.arrayContaining(["base_unit", "default_measure_id"]));

    const entries = await db.execute("PRAGMA table_info(food_entries)");
    const colsEntries = entries.rows.map((r) => r.name);
    expect(colsEntries).toEqual(expect.arrayContaining(["measure_id", "measure_count"]));

    const tabelas = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='food_measures'",
    );
    expect(tabelas.rows).toHaveLength(1);
    db.close();
  });

  it("aplica tabela de grupos musculares e colunas de treino", async () => {
    const db = await createTestDb();

    const cols = async (t: string) =>
      (await db.execute(`PRAGMA table_info(${t})`)).rows.map((r) => r.name as string);

    expect(await cols("muscle_groups")).toEqual(
      expect.arrayContaining(["id", "nome", "regiao", "cadeia"]),
    );
    expect(await cols("exercises")).toEqual(
      expect.arrayContaining(["user_id", "source", "grupo_id", "tipo", "equipamento"]),
    );
    expect(await cols("workout_sets")).toEqual(
      expect.arrayContaining(["tipo", "rir", "nota"]),
    );
    expect(await cols("workout_sessions")).toEqual(expect.arrayContaining(["nota"]));
    db.close();
  });

  it("série existente vira 'valida' e exercício existente vira 'custom' por default", async () => {
    const db = await createTestDb();
    const now = new Date().toISOString();
    await db.execute({
      sql: "INSERT INTO exercises (nome, grupo_muscular, created_at) VALUES ('Supino', 'Peito', ?)",
      args: [now],
    });
    await db.execute({
      sql: "INSERT INTO workout_sessions (user_id, data, created_at) VALUES (1, '2026-07-06', ?)",
      args: [now],
    });
    await db.execute({
      sql: `INSERT INTO workout_sets (user_id, session_id, exercise_id, ordem, reps, peso_kg, created_at)
            VALUES (1, 1, 1, 1, 10, 40, ?)`,
      args: [now],
    });

    const ex = await db.execute("SELECT source, grupo_id FROM exercises WHERE id=1");
    expect(ex.rows[0].source).toBe("custom");
    expect(ex.rows[0].grupo_id).toBeNull();

    const st = await db.execute("SELECT tipo, rir FROM workout_sets WHERE id=1");
    expect(st.rows[0].tipo).toBe("valida");
    expect(st.rows[0].rir).toBeNull();
    db.close();
  });
});
