import { it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { getProfile, upsertProfile } from "./profile";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

const dados = {
  sexo: "M" as const, data_nascimento: "1994-07-10",
  altura_cm: 180, peso_kg: 80, fator_atividade: 1.55,
  objetivo: "manutencao" as const,
  meta_kcal: 2760, meta_prot_g: 160, meta_carb_g: 320, meta_gord_g: 77,
};

it("retorna null quando não há perfil", async () => {
  expect(await getProfile(db)).toBeNull();
});

it("cria e lê o perfil (id sempre 1)", async () => {
  const salvo = await upsertProfile(db, dados);
  expect(salvo.id).toBe(1);
  expect(salvo.meta_kcal).toBe(2760);
  const lido = await getProfile(db);
  expect(lido?.peso_kg).toBe(80);
});

it("atualiza o perfil existente sem duplicar", async () => {
  await upsertProfile(db, dados);
  await upsertProfile(db, { ...dados, peso_kg: 82 });
  const rs = await db.execute("SELECT COUNT(*) AS n FROM profile");
  expect(rs.rows[0].n).toBe(1);
  expect((await getProfile(db))?.peso_kg).toBe(82);
});
