import { it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../test/helpers/test-db";
import { buildUserContext } from "./context";
import { createSession, addSet } from "../src/repositories/workouts";

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

it("treino do dia: aquecimento não conta como série para a IA", async () => {
  await db.execute({
    sql: "INSERT INTO exercises (id,nome,grupo_muscular,created_at) VALUES (1,'Supino','peito','2026-07-09')",
    args: [],
  });
  const sessao = await createSession(db, 1, { data: "2026-07-09", nome: null });
  await addSet(db, 1, {
    session_id: sessao.id, exercise_id: 1, ordem: 1, reps: 15, peso_kg: 20,
    tipo: "aquecimento", rir: null, nota: null,
  });
  await addSet(db, 1, {
    session_id: sessao.id, exercise_id: 1, ordem: 2, reps: 15, peso_kg: 20,
    tipo: "aquecimento", rir: null, nota: null,
  });
  await addSet(db, 1, {
    session_id: sessao.id, exercise_id: 1, ordem: 3, reps: 10, peso_kg: 40,
    tipo: "valida", rir: 2, nota: null,
  });
  await addSet(db, 1, {
    session_id: sessao.id, exercise_id: 1, ordem: 4, reps: 8, peso_kg: 40,
    tipo: "valida", rir: 1, nota: null,
  });
  await addSet(db, 1, {
    session_id: sessao.id, exercise_id: 1, ordem: 5, reps: 6, peso_kg: 40,
    tipo: "drop", rir: 0, nota: null,
  });

  const txt = await buildUserContext(db, 1, "2026-07-09");
  expect(txt).toContain("Supino 3×");
  expect(txt).not.toContain("Supino 5×");
});
