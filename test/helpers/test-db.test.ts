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
});
