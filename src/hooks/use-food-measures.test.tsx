import { it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { useMeasures } from "./use-food-measures";
import { criarWrapper } from "../../test/helpers/query-wrapper";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Pão', 'taco', 100, 250, 8, 48, 3, ?)`,
    args: [new Date().toISOString()],
  });
  await db.execute(
    "INSERT INTO food_measures (food_id, nome, qty_base, ordem) VALUES (1, 'fatia', 25, 0)",
  );
});

it("useMeasures lista as medidas do alimento", async () => {
  const { result } = renderHook(() => useMeasures(1), { wrapper: criarWrapper(db) });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.[0].nome).toBe("fatia");
});

it("useMeasures não busca com foodId null", async () => {
  const { result } = renderHook(() => useMeasures(null), { wrapper: criarWrapper(db) });
  expect(result.current.fetchStatus).toBe("idle");
});
