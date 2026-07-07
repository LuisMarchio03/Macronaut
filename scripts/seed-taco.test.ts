import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../test/helpers/test-db";
import { importarTaco, type TacoItem } from "./seed-taco";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

const itens = [
  { nome: "Arroz", base_qty_g: 100, kcal: 128, prot_g: 2.5, carb_g: 28, gord_g: 0.2 },
];

describe("importarTaco", () => {
  it("importa itens da TACO como source=taco", async () => {
    const n = await importarTaco(db, itens);
    expect(n).toBe(1);
    const rs = await db.execute("SELECT source FROM foods WHERE nome='Arroz'");
    expect(rs.rows[0].source).toBe("taco");
  });

  it("é idempotente por nome (não duplica na segunda rodada)", async () => {
    await importarTaco(db, itens);
    const n2 = await importarTaco(db, itens);
    expect(n2).toBe(0);
    const rs = await db.execute("SELECT COUNT(*) AS n FROM foods");
    expect(rs.rows[0].n).toBe(1);
  });

  it("aplica defaults para campos ausentes (base_qty_g→100, macros→0)", async () => {
    // Simula uma linha real de JSON com chaves numéricas ausentes.
    const parcial = { nome: "Item Parcial" } as unknown as TacoItem;
    const n = await importarTaco(db, [parcial]);
    expect(n).toBe(1);
    const rs = await db.execute(
      "SELECT base_qty_g, kcal, prot_g, carb_g, gord_g FROM foods WHERE nome='Item Parcial'",
    );
    const row = rs.rows[0];
    expect(row.base_qty_g).toBe(100);
    expect(row.kcal).toBe(0);
    expect(row.prot_g).toBe(0);
    expect(row.carb_g).toBe(0);
    expect(row.gord_g).toBe(0);
  });
});
