import { it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { getWaterTotal, addWater, resetWater } from "./water";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

it("soma a água do dia", async () => {
  expect(await getWaterTotal(db, "2026-07-06")).toBe(0);
  await addWater(db, "2026-07-06", 250);
  await addWater(db, "2026-07-06", 500);
  expect(await getWaterTotal(db, "2026-07-06")).toBe(750);
});

it("separa por data e reseta", async () => {
  await addWater(db, "2026-07-06", 250);
  await addWater(db, "2026-07-05", 999);
  await resetWater(db, "2026-07-06");
  expect(await getWaterTotal(db, "2026-07-06")).toBe(0);
  expect(await getWaterTotal(db, "2026-07-05")).toBe(999);
});
