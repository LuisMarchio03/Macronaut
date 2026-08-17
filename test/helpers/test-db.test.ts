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

  it("cria meal_templates e meal_template_items com cascade", async () => {
    const db = await createTestDb();
    await db.execute({
      sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
            VALUES ('Pão', 'custom', 100, 250, 8, 48, 3, ?)`,
      args: [new Date().toISOString()],
    });
    await db.execute({
      sql: "INSERT INTO meal_templates (user_id, nome, meal_id, created_at) VALUES (1, 'Café padrão', NULL, ?)",
      args: [new Date().toISOString()],
    });
    await db.execute(
      `INSERT INTO meal_template_items (template_id, food_id, qty_g, measure_id, measure_count, ordem)
       VALUES (1, 1, 50, NULL, NULL, 0)`,
    );

    // ON DELETE CASCADE: apagar o template leva os itens junto.
    await db.execute("DELETE FROM meal_templates WHERE id=1");
    const rs = await db.execute("SELECT COUNT(*) AS n FROM meal_template_items");
    expect(rs.rows[0].n).toBe(0);
  });

  it("cria as tabelas da rotina e do plano da sessão", async () => {
    const db = await createTestDb();
    const cols = async (t: string) =>
      (await db.execute(`PRAGMA table_info(${t})`)).rows.map((r) => r.name as string);

    expect(await cols("routines")).toEqual(
      expect.arrayContaining(["id", "user_id", "nome", "ativa", "created_at"]),
    );
    expect(await cols("routine_days")).toEqual(
      expect.arrayContaining(["id", "routine_id", "dia_semana", "nome"]),
    );
    expect(await cols("routine_exercises")).toEqual(
      expect.arrayContaining([
        "id", "day_id", "exercise_id", "ordem", "prescricao", "series",
        "reps_min", "reps_max", "peso_kg", "incremento_kg", "tm_kg", "parte", "descanso_s",
      ]),
    );
    expect(await cols("session_plan_sets")).toEqual(
      expect.arrayContaining([
        "id", "user_id", "session_id", "routine_exercise_id", "exercise_id",
        "ordem", "serie_ordem", "peso_kg", "reps_alvo", "reps_min",
        "tipo", "amrap", "pct", "descanso_s", "set_id",
      ]),
    );
    db.close();
  });

  it("um dia da semana só pode ter um treino na mesma rotina", async () => {
    const db = await createTestDb();
    const r = await db.execute({
      sql: "INSERT INTO routines (user_id, nome, ativa, created_at) VALUES (1, 'Minha rotina', 1, ?)",
      args: [new Date().toISOString()],
    });
    const routineId = Number(r.lastInsertRowid);
    await db.execute({
      sql: "INSERT INTO routine_days (routine_id, dia_semana, nome) VALUES (?, 1, 'Peito')",
      args: [routineId],
    });
    await expect(
      db.execute({
        sql: "INSERT INTO routine_days (routine_id, dia_semana, nome) VALUES (?, 1, 'Costas')",
        args: [routineId],
      }),
    ).rejects.toThrow();
    db.close();
  });

  // O 5/3/1 deixou de ser a espinha do módulo e virou um tipo de prescrição:
  // o Training Max mora em routine_exercises. Banco antigo mantém as tabelas
  // com os dados — nenhum DROP é emitido —, banco novo não as cria.
  it("não cria mais as tabelas do programa 5/3/1", async () => {
    const db = await createTestDb();
    const rs = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('strength_programs','program_lifts','program_sessions')",
    );
    expect(rs.rows).toHaveLength(0);
    db.close();
  });
});
