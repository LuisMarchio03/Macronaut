import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { getWaterTotal, addWater, resetWater } from "./water";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

describe("water repo", () => {
  it("soma por usuário e data", async () => {
    await addWater(db, 1, "2026-07-07", 250);
    await addWater(db, 1, "2026-07-07", 500);
    expect(await getWaterTotal(db, 1, "2026-07-07")).toBe(750);
  });

  it("isola por usuário", async () => {
    await addWater(db, 1, "2026-07-07", 250);
    await addWater(db, 2, "2026-07-07", 999);
    expect(await getWaterTotal(db, 1, "2026-07-07")).toBe(250);
    expect(await getWaterTotal(db, 2, "2026-07-07")).toBe(999);
  });

  it("reset só apaga o do próprio usuário", async () => {
    await addWater(db, 1, "2026-07-07", 250);
    await addWater(db, 2, "2026-07-07", 999);
    await resetWater(db, 1, "2026-07-07");
    expect(await getWaterTotal(db, 1, "2026-07-07")).toBe(0);
    expect(await getWaterTotal(db, 2, "2026-07-07")).toBe(999);
  });
});
