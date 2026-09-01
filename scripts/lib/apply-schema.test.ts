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
