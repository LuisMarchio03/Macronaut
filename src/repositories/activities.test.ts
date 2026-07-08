import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  listActivityTypes, seedActivityTypes,
  createActivitySession, listActivitySessions, deleteActivitySession,
} from "./activities";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

const nova = (over = {}) => ({ data: "2026-07-07", tipo: "Corrida", duracao_min: 30, kcal: 300, ...over });

describe("activities repo", () => {
  it("seed de tipos é global e idempotente", async () => {
    await seedActivityTypes(db);
    await seedActivityTypes(db);
    const tipos = await listActivityTypes(db);
    expect(tipos.length).toBeGreaterThan(0);
  });

  it("isola sessões de atividade por usuário", async () => {
    await createActivitySession(db, 1, nova({ kcal: 300 }));
    await createActivitySession(db, 2, nova({ kcal: 999 }));
    expect(await listActivitySessions(db, 1)).toHaveLength(1);
    expect((await listActivitySessions(db, 1))[0].kcal).toBe(300);
    expect((await listActivitySessions(db, 2))[0].kcal).toBe(999);
  });

  it("delete não afeta outro usuário", async () => {
    const a = await createActivitySession(db, 1, nova());
    await deleteActivitySession(db, 2, a.id);
    expect(await listActivitySessions(db, 1)).toHaveLength(1);
    await deleteActivitySession(db, 1, a.id);
    expect(await listActivitySessions(db, 1)).toHaveLength(0);
  });
});
