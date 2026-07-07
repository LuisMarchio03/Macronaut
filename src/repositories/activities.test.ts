import { it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  listActivityTypes, seedActivityTypes, createActivitySession,
  listActivitySessions, deleteActivitySession,
} from "./activities";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

it("seedActivityTypes cria os MET e é idempotente", async () => {
  await seedActivityTypes(db);
  await seedActivityTypes(db);
  const tipos = await listActivityTypes(db);
  expect(tipos).toHaveLength(12);
  expect(tipos.find((t) => t.nome === "Muay Thai")?.met).toBe(10);
});

it("cria, lista e deleta sessão de atividade", async () => {
  const a = await createActivitySession(db, { data: "2026-07-06", tipo: "Corrida", duracao_min: 30, kcal: 340 });
  expect(a.id).toBeGreaterThan(0);
  expect(await listActivitySessions(db)).toHaveLength(1);
  await deleteActivitySession(db, a.id);
  expect(await listActivitySessions(db)).toHaveLength(0);
});
