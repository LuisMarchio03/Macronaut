import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { getWaterTotal, addWater, resetWater, getWaterByRange } from "./water";

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

  it("getWaterByRange soma ml por dia dentro do range e do usuário", async () => {
    await addWater(db, 1, "2026-07-05", 500); // fora
    await addWater(db, 1, "2026-07-06", 300);
    await addWater(db, 1, "2026-07-06", 200); // mesmo dia → soma 500
    await addWater(db, 1, "2026-07-12", 900);
    await addWater(db, 2, "2026-07-06", 999); // outro usuário
    const m = await getWaterByRange(db, 1, "2026-07-06", "2026-07-12");
    expect(m.get("2026-07-06")).toBe(500);
    expect(m.get("2026-07-12")).toBe(900);
    expect(m.has("2026-07-05")).toBe(false);
    expect(m.size).toBe(2);
  });
});
