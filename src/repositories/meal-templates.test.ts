import { it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  listTemplates, listTemplateItems, criarDeEntries, aplicar, deleteTemplate,
} from "./meal-templates";
import { listEntriesByDate } from "./entries";
import type { FoodEntry } from "../domain/types";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.executeMultiple(`
    INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
      VALUES ('Pão', 'taco', 100, 250, 8, 48, 3, '2026-01-01');
    INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
      VALUES ('Ovo', 'taco', 1, 70, 6, 0, 5, '2026-01-01');
    INSERT INTO food_measures (food_id, nome, qty_base, ordem) VALUES (1, 'fatia', 25, 0);
    INSERT INTO meals (user_id, nome, horario, ordem) VALUES (1, 'Café', '07:30', 0);
    INSERT INTO meals (user_id, nome, horario, ordem) VALUES (1, 'Almoço', '12:00', 1);
  `);
});

const entry = (over: Partial<FoodEntry>): FoodEntry => ({
  id: 1, data: "2026-07-16", meal_id: 1, food_id: 1, qty_g: 50,
  measure_id: 1, measure_count: 2, label: null, created_at: "", ...over,
});

it("criarDeEntries tira snapshot da intenção (medida), não só da grama", async () => {
  const t = await criarDeEntries(db, 1, "Café padrão", 1, [
    entry({}), entry({ id: 2, food_id: 2, qty_g: 2, measure_id: null, measure_count: null }),
  ]);
  const itens = await listTemplateItems(db, t.id);
  expect(itens).toHaveLength(2);
  expect(itens[0].measure_id).toBe(1);
  expect(itens[0].measure_count).toBe(2);
  expect(itens[0].qty_g).toBe(50);
  expect(itens[1].measure_id).toBeNull();
});

it("listTemplates filtra por refeição, e meal_id null aparece em qualquer uma", async () => {
  await criarDeEntries(db, 1, "Café padrão", 1, [entry({})]);
  await criarDeEntries(db, 1, "Qualquer hora", null, [entry({})]);
  const doCafe = await listTemplates(db, 1, 1);
  expect(doCafe.map((t) => t.nome).sort()).toEqual(["Café padrão", "Qualquer hora"]);
  const deOutra = await listTemplates(db, 1, 2);
  expect(deOutra.map((t) => t.nome)).toEqual(["Qualquer hora"]);
});

it("aplicar registra todos os itens no dia e refeição pedidos", async () => {
  const t = await criarDeEntries(db, 1, "Café padrão", 1, [
    entry({}), entry({ id: 2, food_id: 2, qty_g: 2, measure_id: null, measure_count: null }),
  ]);
  const n = await aplicar(db, 1, t.id, "2026-07-17", 1);
  expect(n).toBe(2);
  const registradas = await listEntriesByDate(db, 1, "2026-07-17");
  expect(registradas).toHaveLength(2);
  expect(registradas[0].measure_count).toBe(2);
  expect(registradas[0].qty_g).toBe(50);
});

it("aplicar pode registrar noutra refeição: meal_id do template não restringe", async () => {
  const t = await criarDeEntries(db, 1, "Café padrão", 1, [entry({})]);
  await aplicar(db, 1, t.id, "2026-07-17", 2);
  const registradas = await listEntriesByDate(db, 1, "2026-07-17");
  expect(registradas[0].meal_id).toBe(2);
});

it("a favorita guarda a INTENÇÃO: corrigir a medida muda o que ela registra", async () => {
  const t = await criarDeEntries(db, 1, "Café padrão", 1, [entry({})]);
  // Usuário descobre que a fatia do pão dele é 28 g, não 25.
  await db.execute("UPDATE food_measures SET qty_base=28 WHERE id=1");
  await aplicar(db, 1, t.id, "2026-07-17", 1);
  const registradas = await listEntriesByDate(db, 1, "2026-07-17");
  expect(registradas[0].qty_g).toBe(56); // 28 × 2, não os 50 congelados
  expect(registradas[0].measure_count).toBe(2);
});

// Se a medida foi DESCARTADA (some da UI), o recálculo não pode usá-la: cai na
// grama do snapshot. Sem o filtro status!='descartada' na query de aplicar,
// registraria com uma medida que a tela nem mostra mais.
it("medida descartada cai na grama do snapshot, não recalcula", async () => {
  const t = await criarDeEntries(db, 1, "Café padrão", 1, [entry({})]); // 2 fatias, snapshot 50 g
  // a medida vira descartada E tem o peso adulterado — se o recálculo a usasse,
  // daria 999×2; o correto é ignorá-la e ficar nos 50 g do snapshot.
  await db.execute("UPDATE food_measures SET status='descartada', qty_base=999 WHERE id=1");
  await aplicar(db, 1, t.id, "2026-07-17", 1);
  const registradas = await listEntriesByDate(db, 1, "2026-07-17");
  expect(registradas[0].qty_g).toBe(50); // grama congelada do snapshot, não 1998
});

it("item sem medida usa a grama do snapshot", async () => {
  const t = await criarDeEntries(db, 1, "Ovos", 1, [
    entry({ food_id: 2, qty_g: 2, measure_id: null, measure_count: null }),
  ]);
  await aplicar(db, 1, t.id, "2026-07-17", 1);
  expect((await listEntriesByDate(db, 1, "2026-07-17"))[0].qty_g).toBe(2);
});

it("deleteTemplate leva os itens junto (cascade) e não toca no histórico", async () => {
  const t = await criarDeEntries(db, 1, "Café padrão", 1, [entry({})]);
  await aplicar(db, 1, t.id, "2026-07-17", 1);
  await deleteTemplate(db, 1, t.id);
  expect(await listTemplates(db, 1)).toHaveLength(0);
  expect((await db.execute("SELECT COUNT(*) AS n FROM meal_template_items")).rows[0].n).toBe(0);
  // O que já foi registrado é histórico: continua lá.
  expect(await listEntriesByDate(db, 1, "2026-07-17")).toHaveLength(1);
});

it("não deleta template de outro usuário", async () => {
  const t = await criarDeEntries(db, 1, "Café padrão", 1, [entry({})]);
  await deleteTemplate(db, 999, t.id);
  expect(await listTemplates(db, 1)).toHaveLength(1);
});
