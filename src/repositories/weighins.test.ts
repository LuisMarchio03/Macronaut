import { it, expect } from "vitest";
import { createTestDb } from "../../test/helpers/test-db";
import { upsertWeighIn, getWeighInsByRange } from "./weighins";

it("upsert insere e atualiza (uma pesagem por dia)", async () => {
  const db = await createTestDb();
  await upsertWeighIn(db, 1, "2026-07-06", 80);
  await upsertWeighIn(db, 1, "2026-07-06", 79.5); // mesmo dia → atualiza
  const r = await getWeighInsByRange(db, 1, "2026-07-06", "2026-07-12");
  expect(r).toEqual([{ data: "2026-07-06", peso_kg: 79.5 }]);
});

it("getWeighInsByRange filtra por range e usuário, ordenado por data", async () => {
  const db = await createTestDb();
  await upsertWeighIn(db, 1, "2026-07-12", 78);
  await upsertWeighIn(db, 1, "2026-07-06", 80);
  await upsertWeighIn(db, 1, "2026-07-20", 77); // fora
  await upsertWeighIn(db, 2, "2026-07-07", 90); // outro usuário
  const r = await getWeighInsByRange(db, 1, "2026-07-06", "2026-07-12");
  expect(r).toEqual([{ data: "2026-07-06", peso_kg: 80 }, { data: "2026-07-12", peso_kg: 78 }]);
});
