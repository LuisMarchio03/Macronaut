import { it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../test/helpers/test-db";
import { buildUserContext } from "./context";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.execute({
    sql: `INSERT INTO profile
      (user_id, sexo, data_nascimento, altura_cm, peso_kg, fator_atividade, objetivo,
       meta_kcal, meta_prot_g, meta_carb_g, meta_gord_g, updated_at)
      VALUES (1,'M','1990-01-01',180,80,1.5,'cut',2000,160,180,60,'2026-07-09')`,
    args: [],
  });
});

it("sem dados no dia: menciona a meta e ausência de registros", async () => {
  const txt = await buildUserContext(db, 1, "2026-07-09");
  expect(txt).toContain("2000");        // meta kcal
  expect(txt.toLowerCase()).toContain("sem treino");
});

it("com refeição registrada: reflete o consumido", async () => {
  await db.execute({
    sql: `INSERT INTO foods (id,nome,source,base_qty_g,kcal,prot_g,carb_g,gord_g,created_at)
          VALUES (1,'Arroz','taco',100,130,2.5,28,0.3,'2026-07-09')`,
    args: [],
  });
  await db.execute({
    sql: `INSERT INTO food_entries (user_id,data,meal_id,food_id,qty_g,label,created_at)
          VALUES (1,'2026-07-09',NULL,1,200,NULL,'2026-07-09')`,
    args: [],
  });
  const txt = await buildUserContext(db, 1, "2026-07-09");
  expect(txt).toContain("260");         // 130 kcal * 2 (200g)
});
