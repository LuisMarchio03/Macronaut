import { it, expect, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createTestDb } from "../../test/helpers/test-db";
import { applyAdditiveColumns } from "../../scripts/lib/apply-schema";
import {
  listExercises,
  createExercise,
  updateExercise,
  deleteExercise,
  seedExercicios,
  backfillGrupos,
  backfillUserIds,
} from "./exercises";
import { seedMuscleGroups } from "./muscle-groups";

const here = fileURLToPath(import.meta.url);
const schemaPath = resolve(dirname(here), "../db/schema.sql");

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

async function addUser(db: Client, email: string): Promise<number> {
  const rs = await db.execute({
    sql: "INSERT INTO users (email, password_hash, created_at) VALUES (?, 'h', ?)",
    args: [email, new Date().toISOString()],
  });
  return Number(rs.lastInsertRowid);
}

async function nomeGrupoDe(db: Client, exId: number): Promise<string | null> {
  const rs = await db.execute({
    sql: `SELECT mg.nome AS g FROM exercises e
          LEFT JOIN muscle_groups mg ON mg.id = e.grupo_id WHERE e.id = ?`,
    args: [exId],
  });
  return (rs.rows[0]?.g as string | null) ?? null;
}

it("cria, lista e atualiza exercício do usuário", async () => {
  await seedMuscleGroups(db);
  const gs = await db.execute("SELECT id FROM muscle_groups WHERE nome='Peito'");
  const peitoId = gs.rows[0].id as number;

  const e = await createExercise(db, 1, { nome: "Supino", grupo_id: peitoId });
  expect(e.id).toBeGreaterThan(0);
  expect(e.source).toBe("custom");
  expect(e.user_id).toBe(1);

  const lista = await listExercises(db, 1);
  expect(lista[0].nome).toBe("Supino");
  expect(lista[0].grupo_nome).toBe("Peito");

  expect(await updateExercise(db, 1, e.id, { nome: "Supino reto", grupo_id: peitoId })).toEqual({ ok: true });
  expect((await listExercises(db, 1))[0].nome).toBe("Supino reto");
});

it("deleta exercício sem uso; bloqueia se em uso", async () => {
  const e = await createExercise(db, 1, { nome: "Agachamento", grupo_id: null });
  expect(await deleteExercise(db, 1, e.id)).toEqual({ ok: true });
  expect(await listExercises(db, 1)).toHaveLength(0);

  const e2 = await createExercise(db, 1, { nome: "Terra", grupo_id: null });
  const now = new Date().toISOString();
  await db.execute({
    sql: "INSERT INTO workout_sessions (user_id, data, created_at) VALUES (1, '2026-07-06', ?)",
    args: [now],
  });
  await db.execute({
    sql: `INSERT INTO workout_sets (user_id, session_id, exercise_id, ordem, reps, peso_kg, created_at)
          VALUES (1, 1, ?, 1, 5, 100, ?)`,
    args: [e2.id, now],
  });
  expect(await deleteExercise(db, 1, e2.id)).toEqual({ ok: false, reason: "em_uso" });
  expect(await listExercises(db, 1)).toHaveLength(1);
});

it("listExercises não vaza exercício de outro usuário e inclui o catálogo", async () => {
  await seedMuscleGroups(db);
  await seedExercicios(db);
  await createExercise(db, 1, { nome: "Meu exercício", grupo_id: null });
  await createExercise(db, 2, { nome: "Exercício do outro", grupo_id: null });

  const do1 = await listExercises(db, 1);
  expect(do1.some((e) => e.nome === "Meu exercício")).toBe(true);
  expect(do1.some((e) => e.nome === "Exercício do outro")).toBe(false);
  expect(do1.some((e) => e.source === "catalogo")).toBe(true);

  const do2 = await listExercises(db, 2);
  expect(do2.some((e) => e.nome === "Exercício do outro")).toBe(true);
  expect(do2.some((e) => e.nome === "Meu exercício")).toBe(false);
});

it("update e delete recusam linha de catálogo", async () => {
  await seedMuscleGroups(db);
  await seedExercicios(db);
  const cat = await db.execute("SELECT id FROM exercises WHERE source='catalogo' LIMIT 1");
  const id = cat.rows[0].id as number;

  expect(await updateExercise(db, 1, id, { nome: "Hackeado", grupo_id: null })).toEqual({
    ok: false, reason: "catalogo",
  });
  expect(await deleteExercise(db, 1, id)).toEqual({ ok: false, reason: "catalogo" });

  const ainda = await db.execute({ sql: "SELECT nome FROM exercises WHERE id=?", args: [id] });
  expect(ainda.rows[0].nome).not.toBe("Hackeado");
});

it("update e delete recusam exercício de outro usuário", async () => {
  const e = await createExercise(db, 2, { nome: "Do outro", grupo_id: null });
  expect(await updateExercise(db, 1, e.id, { nome: "Roubado", grupo_id: null })).toEqual({
    ok: false, reason: "catalogo",
  });
  expect(await deleteExercise(db, 1, e.id)).toEqual({ ok: false, reason: "catalogo" });
});

it("seed do catálogo insere com user_id nulo e source catalogo", async () => {
  await seedMuscleGroups(db);
  await seedExercicios(db);
  const rs = await db.execute(
    "SELECT COUNT(*) AS n FROM exercises WHERE source='catalogo' AND user_id IS NULL",
  );
  expect(rs.rows[0].n as number).toBeGreaterThanOrEqual(70);

  const supino = await db.execute(
    "SELECT id FROM exercises WHERE nome='Supino reto com barra' AND source='catalogo'",
  );
  expect(await nomeGrupoDe(db, supino.rows[0].id as number)).toBe("Peito");
});

it("rodar o seed duas vezes não duplica e atualiza a linha de catálogo", async () => {
  await seedMuscleGroups(db);
  await seedExercicios(db);
  const antes = (await db.execute("SELECT COUNT(*) AS n FROM exercises")).rows[0].n as number;

  // simula catálogo desatualizado: zera o grupo da linha de catálogo
  await db.execute("UPDATE exercises SET grupo_id=NULL, tipo=NULL WHERE source='catalogo'");
  await seedExercicios(db);

  expect((await db.execute("SELECT COUNT(*) AS n FROM exercises")).rows[0].n).toBe(antes);
  const supino = await db.execute(
    "SELECT id, tipo FROM exercises WHERE nome='Supino reto com barra' AND source='catalogo'",
  );
  expect(await nomeGrupoDe(db, supino.rows[0].id as number)).toBe("Peito");
  expect(supino.rows[0].tipo).toBe("composto");
});

it("seed NÃO toca em custom de mesmo nome — a linha do usuário sobrevive intacta", async () => {
  await seedMuscleGroups(db);
  const gs = await db.execute("SELECT id FROM muscle_groups WHERE nome='Core'");
  const coreId = gs.rows[0].id as number;

  // usuário tem "Supino reto com barra" custom, com grupo editado à mão para Core.
  const e = await createExercise(db, 1, { nome: "Supino reto com barra", grupo_id: coreId });
  const meuId = e.id;
  const antes = await db.execute({ sql: "SELECT * FROM exercises WHERE id=?", args: [meuId] });

  await seedExercicios(db);

  // a linha custom continua byte-a-byte igual
  const depois = await db.execute({ sql: "SELECT * FROM exercises WHERE id=?", args: [meuId] });
  expect(depois.rows[0]).toEqual(antes.rows[0]);
  expect(depois.rows[0].source).toBe("custom");
  expect(depois.rows[0].user_id).toBe(1);
  expect(depois.rows[0].grupo_id).toBe(coreId);

  // e a de catálogo existe ao lado, com o grupo do catálogo
  const cat = await db.execute(
    "SELECT id FROM exercises WHERE nome='Supino reto com barra' AND source='catalogo'",
  );
  expect(cat.rows).toHaveLength(1);
  expect(await nomeGrupoDe(db, cat.rows[0].id as number)).toBe("Peito");
});

it("backfill casa por acento e caixa, e por sinônimo", async () => {
  await seedMuscleGroups(db);
  const now = new Date().toISOString();
  for (const [nome, grupo] of [
    ["Meu supino", "peito"],
    ["Minha remada", "DORSAL"],
    ["Meu agacho", "Perna"],
    ["Minha rosca", "bíceps"],
    // Singular acentuado: só casa via strip de acento ("glúteo"→"gluteo"→sinônimo).
    // Os casos acima passam mesmo sem o strip, então sem este a faixa
    // \u0300-\u036f-\u0300-\u036f de `normalizar` ficaria sem cobertura de teste.
    ["Meu coice", "glúteo"],
  ]) {
    await db.execute({
      sql: "INSERT INTO exercises (user_id, nome, grupo_muscular, source, created_at) VALUES (1, ?, ?, 'custom', ?)",
      args: [nome, grupo, now],
    });
  }

  const n = await backfillGrupos(db);
  expect(n).toBe(5);

  const rs = await db.execute(`SELECT e.nome AS n, mg.nome AS g FROM exercises e
    LEFT JOIN muscle_groups mg ON mg.id = e.grupo_id ORDER BY e.id`);
  expect(rs.rows.map((r) => r.g)).toEqual([
    "Peito",
    "Costas",
    "Quadríceps",
    "Bíceps",
    "Glúteos",
  ]);
});

it("backfill deixa NULL o que não casa e não sobrescreve grupo já definido", async () => {
  await seedMuscleGroups(db);
  const gs = await db.execute("SELECT id FROM muscle_groups WHERE nome='Core'");
  const coreId = gs.rows[0].id as number;
  const now = new Date().toISOString();

  await db.execute({
    sql: "INSERT INTO exercises (user_id, nome, grupo_muscular, source, created_at) VALUES (1, 'Lixo', 'zzz-inexistente', 'custom', ?)",
    args: [now],
  });
  // já corrigido à mão pelo usuário: grupo_muscular diz "peito", mas grupo_id diz Core
  await db.execute({
    sql: "INSERT INTO exercises (user_id, nome, grupo_muscular, grupo_id, source, created_at) VALUES (1, 'Corrigido', 'peito', ?, 'custom', ?)",
    args: [coreId, now],
  });

  const n = await backfillGrupos(db);
  expect(n).toBe(0);

  const rs = await db.execute("SELECT nome, grupo_id FROM exercises ORDER BY id");
  expect(rs.rows[0].grupo_id).toBeNull();      // Lixo continua sem grupo
  expect(rs.rows[1].grupo_id).toBe(coreId);    // correção manual preservada
});

it("backfill ignora espaços ao redor do grupo (.trim())", async () => {
  await seedMuscleGroups(db);
  const now = new Date().toISOString();
  // Espaços de sobra ao redor do texto livre — sem o `.trim()` em `normalizar()`,
  // "  peito  " não bate com a chave exata "peito" do Map e o backfill fica NULL.
  await db.execute({
    sql: "INSERT INTO exercises (user_id, nome, grupo_muscular, source, created_at) VALUES (1, 'Meu supino com espaço', '  Peito  ', 'custom', ?)",
    args: [now],
  });

  const n = await backfillGrupos(db);
  expect(n).toBe(1);

  const rs = await db.execute(
    "SELECT mg.nome AS g FROM exercises e LEFT JOIN muscle_groups mg ON mg.id = e.grupo_id WHERE e.nome='Meu supino com espaço'",
  );
  expect(rs.rows[0].g).toBe("Peito");
});

it("backfill casa 'Panturrilhas' (plural) com o grupo 'Panturrilha' (singular)", async () => {
  await seedMuscleGroups(db);
  const now = new Date().toISOString();
  await db.execute({
    sql: "INSERT INTO exercises (user_id, nome, grupo_muscular, source, created_at) VALUES (1, 'Panturrilha na máquina', 'Panturrilhas', 'custom', ?)",
    args: [now],
  });

  const n = await backfillGrupos(db);
  expect(n).toBe(1);

  const rs = await db.execute(
    "SELECT mg.nome AS g FROM exercises e LEFT JOIN muscle_groups mg ON mg.id = e.grupo_id WHERE e.nome='Panturrilha na máquina'",
  );
  expect(rs.rows[0].g).toBe("Panturrilha");
});

it("backfill é idempotente", async () => {
  await seedMuscleGroups(db);
  const now = new Date().toISOString();
  await db.execute({
    sql: "INSERT INTO exercises (user_id, nome, grupo_muscular, source, created_at) VALUES (1, 'Meu supino', 'peitoral', 'custom', ?)",
    args: [now],
  });
  expect(await backfillGrupos(db)).toBe(1);
  expect(await backfillGrupos(db)).toBe(0);
});

// --- backfillUserIds: linha pré-existente ganha `user_id NULL` na migração
// aditiva (ver scripts/lib/apply-schema.ts, ADDITIVE_COLUMNS). Sem esse
// backfill: (1) vaza entre usuários em `listExercises` (`user_id IS NULL`
// entra no OR do catálogo), e (2) fica permanentemente ineditável/indeletável
// (`editavelPor` exige `user_id = ?`, e `NULL = ?` nunca é verdade).

it("backfillUserIds: exercício legado usado por 1 usuário recebe aquele user_id", async () => {
  const u1 = await addUser(db, "u1@x.com");
  await addUser(db, "u2@x.com"); // 2º usuário no banco — prova que quem decide é o uso, não a regra do usuário único
  const now = new Date().toISOString();
  const ex = await db.execute({
    sql: "INSERT INTO exercises (user_id, nome, source, created_at) VALUES (NULL, 'Supino legado', 'custom', ?)",
    args: [now],
  });
  const exId = Number(ex.lastInsertRowid);
  const sess = await db.execute({
    sql: "INSERT INTO workout_sessions (user_id, data, created_at) VALUES (?, '2026-07-06', ?)",
    args: [u1, now],
  });
  await db.execute({
    sql: `INSERT INTO workout_sets (user_id, session_id, exercise_id, ordem, reps, peso_kg, created_at)
          VALUES (?, ?, ?, 1, 5, 40, ?)`,
    args: [u1, Number(sess.lastInsertRowid), exId, now],
  });

  expect(await backfillUserIds(db)).toBe(1);
  const row = await db.execute({ sql: "SELECT user_id FROM exercises WHERE id=?", args: [exId] });
  expect(row.rows[0].user_id).toBe(u1);
});

it("backfillUserIds: exercício legado usado por 2 usuários diferentes fica NULL (ambíguo, não chuta)", async () => {
  const u1 = await addUser(db, "u1@x.com");
  const u2 = await addUser(db, "u2@x.com");
  const now = new Date().toISOString();
  const ex = await db.execute({
    sql: "INSERT INTO exercises (user_id, nome, source, created_at) VALUES (NULL, 'Supino compartilhado', 'custom', ?)",
    args: [now],
  });
  const exId = Number(ex.lastInsertRowid);
  for (const uid of [u1, u2]) {
    const sess = await db.execute({
      sql: "INSERT INTO workout_sessions (user_id, data, created_at) VALUES (?, '2026-07-06', ?)",
      args: [uid, now],
    });
    await db.execute({
      sql: `INSERT INTO workout_sets (user_id, session_id, exercise_id, ordem, reps, peso_kg, created_at)
            VALUES (?, ?, ?, 1, 5, 40, ?)`,
      args: [uid, Number(sess.lastInsertRowid), exId, now],
    });
  }

  expect(await backfillUserIds(db)).toBe(0);
  const row = await db.execute({ sql: "SELECT user_id FROM exercises WHERE id=?", args: [exId] });
  expect(row.rows[0].user_id).toBeNull();
});

it("backfillUserIds: exercício legado nunca usado, com 1 usuário no banco, recebe aquele user_id", async () => {
  const u1 = await addUser(db, "solo@x.com");
  const now = new Date().toISOString();
  const ex = await db.execute({
    sql: "INSERT INTO exercises (user_id, nome, source, created_at) VALUES (NULL, 'Nunca usado', 'custom', ?)",
    args: [now],
  });
  const exId = Number(ex.lastInsertRowid);

  expect(await backfillUserIds(db)).toBe(1);
  const row = await db.execute({ sql: "SELECT user_id FROM exercises WHERE id=?", args: [exId] });
  expect(row.rows[0].user_id).toBe(u1);
});

it("backfillUserIds: exercício legado nunca usado, com 2 usuários no banco, fica NULL", async () => {
  await addUser(db, "a@x.com");
  await addUser(db, "b@x.com");
  const now = new Date().toISOString();
  const ex = await db.execute({
    sql: "INSERT INTO exercises (user_id, nome, source, created_at) VALUES (NULL, 'Nunca usado 2', 'custom', ?)",
    args: [now],
  });
  const exId = Number(ex.lastInsertRowid);

  expect(await backfillUserIds(db)).toBe(0);
  const row = await db.execute({ sql: "SELECT user_id FROM exercises WHERE id=?", args: [exId] });
  expect(row.rows[0].user_id).toBeNull();
});

it("backfillUserIds NUNCA atribui user_id a linha source='catalogo' — protege o catálogo global", async () => {
  await seedMuscleGroups(db);
  await seedExercicios(db);
  // Pior cenário deliberado: 1 usuário só no banco (dispararia a regra do
  // "nunca usado" se o filtro de source vazasse) E a linha de catálogo usada
  // por exatamente esse 1 usuário (dispararia a regra de "uso real" também).
  const u1 = await addUser(db, "unico@x.com");
  const now = new Date().toISOString();

  const cat = await db.execute("SELECT id FROM exercises WHERE source='catalogo' LIMIT 1");
  const catId = cat.rows[0].id as number;

  const sess = await db.execute({
    sql: "INSERT INTO workout_sessions (user_id, data, created_at) VALUES (?, '2026-07-06', ?)",
    args: [u1, now],
  });
  await db.execute({
    sql: `INSERT INTO workout_sets (user_id, session_id, exercise_id, ordem, reps, peso_kg, created_at)
          VALUES (?, ?, ?, 1, 5, 40, ?)`,
    args: [u1, Number(sess.lastInsertRowid), catId, now],
  });

  await backfillUserIds(db);

  const catoAindaGlobal = await db.execute(
    "SELECT COUNT(*) AS n FROM exercises WHERE source='catalogo' AND user_id IS NOT NULL",
  );
  expect(catoAindaGlobal.rows[0].n).toBe(0);
  const row = await db.execute({ sql: "SELECT user_id FROM exercises WHERE id=?", args: [catId] });
  expect(row.rows[0].user_id).toBeNull();
});

it("backfillUserIds não sobrescreve user_id já definido", async () => {
  const u1 = await addUser(db, "dono@x.com");
  const u2 = await addUser(db, "outro@x.com");
  const now = new Date().toISOString();
  const ex = await db.execute({
    sql: "INSERT INTO exercises (user_id, nome, source, created_at) VALUES (?, 'Já tem dono', 'custom', ?)",
    args: [u1, now],
  });
  const exId = Number(ex.lastInsertRowid);
  // Uso conflitante por outro usuário — não pode sobrescrever o dono já definido.
  const sess = await db.execute({
    sql: "INSERT INTO workout_sessions (user_id, data, created_at) VALUES (?, '2026-07-06', ?)",
    args: [u2, now],
  });
  await db.execute({
    sql: `INSERT INTO workout_sets (user_id, session_id, exercise_id, ordem, reps, peso_kg, created_at)
          VALUES (?, ?, ?, 1, 5, 40, ?)`,
    args: [u2, Number(sess.lastInsertRowid), exId, now],
  });

  expect(await backfillUserIds(db)).toBe(0);
  const row = await db.execute({ sql: "SELECT user_id FROM exercises WHERE id=?", args: [exId] });
  expect(row.rows[0].user_id).toBe(u1);
});

it("backfillUserIds é idempotente", async () => {
  const u1 = await addUser(db, "idem@x.com");
  await addUser(db, "idem2@x.com");
  const now = new Date().toISOString();
  const ex = await db.execute({
    sql: "INSERT INTO exercises (user_id, nome, source, created_at) VALUES (NULL, 'Idempotente', 'custom', ?)",
    args: [now],
  });
  const exId = Number(ex.lastInsertRowid);
  const sess = await db.execute({
    sql: "INSERT INTO workout_sessions (user_id, data, created_at) VALUES (?, '2026-07-06', ?)",
    args: [u1, now],
  });
  await db.execute({
    sql: `INSERT INTO workout_sets (user_id, session_id, exercise_id, ordem, reps, peso_kg, created_at)
          VALUES (?, ?, ?, 1, 5, 40, ?)`,
    args: [u1, Number(sess.lastInsertRowid), exId, now],
  });

  expect(await backfillUserIds(db)).toBe(1);
  expect(await backfillUserIds(db)).toBe(0);
  const row = await db.execute({ sql: "SELECT user_id FROM exercises WHERE id=?", args: [exId] });
  expect(row.rows[0].user_id).toBe(u1);
});

// Achado CRITICAL do review de fase: `ALTER TABLE exercises ADD COLUMN user_id
// INTEGER` sem default/backfill deixa toda linha pré-existente com `user_id
// NULL, source='custom'` — um estado que `listExercises`/`editavelPor` não
// modelam. Este teste monta um banco LEGADO de verdade (não a partir de
// `createTestDb`, que já nasce migrado) e roda o pipeline completo na ordem
// real de `scripts/setup-db.ts`, provando que o vazamento fecha e o usuário
// recupera a posse do próprio exercício. Sem `backfillUserIds` no pipeline,
// este teste FALHA (verificado manualmente).
it("integração: banco LEGADO, pipeline completo fecha o vazamento entre usuários e destrava updateExercise", async () => {
  const legacyDb = createClient({ url: ":memory:" });
  await legacyDb.execute("PRAGMA foreign_keys = ON");

  // Forma antiga das tabelas, espelhando produção antes desta migração:
  // `exercises` só com as 4 colunas originais (sem user_id/grupo_id/source/...).
  await legacyDb.execute(
    "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL)",
  );
  await legacyDb.execute(
    "CREATE TABLE exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, grupo_muscular TEXT, created_at TEXT NOT NULL)",
  );
  await legacyDb.execute(
    "CREATE TABLE workout_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, data TEXT NOT NULL, nome TEXT, created_at TEXT NOT NULL)",
  );
  await legacyDb.execute(
    `CREATE TABLE workout_sets (
       id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, session_id INTEGER NOT NULL,
       exercise_id INTEGER NOT NULL, ordem INTEGER NOT NULL, reps INTEGER NOT NULL, peso_kg REAL NOT NULL,
       created_at TEXT NOT NULL,
       FOREIGN KEY (session_id) REFERENCES workout_sessions (id),
       FOREIGN KEY (exercise_id) REFERENCES exercises (id))`,
  );

  const now = new Date().toISOString();
  await legacyDb.execute({
    sql: "INSERT INTO users (id, email, password_hash, created_at) VALUES (1, 'u1@x.com', 'h', ?)",
    args: [now],
  });
  await legacyDb.execute({
    sql: "INSERT INTO users (id, email, password_hash, created_at) VALUES (2, 'u2@x.com', 'h', ?)",
    args: [now],
  });
  // Exercício criado pelo usuário 1 anos atrás — mesmo cenário do defeito relatado.
  await legacyDb.execute({
    sql: "INSERT INTO exercises (id, nome, grupo_muscular, created_at) VALUES (1, 'Supino do Luis', 'Peito', ?)",
    args: [now],
  });
  await legacyDb.execute({
    sql: "INSERT INTO workout_sessions (id, user_id, data, created_at) VALUES (1, 1, '2026-01-01', ?)",
    args: [now],
  });
  await legacyDb.execute({
    sql: `INSERT INTO workout_sets (id, user_id, session_id, exercise_id, ordem, reps, peso_kg, created_at)
          VALUES (1, 1, 1, 1, 1, 10, 40, ?)`,
    args: [now],
  });

  // Pipeline completo, na ordem real de scripts/setup-db.ts.
  const schema = readFileSync(schemaPath, "utf-8");
  await legacyDb.executeMultiple(schema);
  await applyAdditiveColumns(legacyDb);
  await seedMuscleGroups(legacyDb);
  await seedExercicios(legacyDb);
  await backfillGrupos(legacyDb);
  await backfillUserIds(legacyDb);

  // O vazamento fechou: o exercício legado do usuário 1 não aparece pro usuário 2.
  const do2 = await listExercises(legacyDb, 2);
  expect(do2.some((e) => e.nome === "Supino do Luis")).toBe(false);

  // O usuário 1 consegue editar o próprio exercício legado agora.
  const resultado = await updateExercise(legacyDb, 1, 1, {
    nome: "Supino do Luis (corrigido)",
    grupo_id: null,
  });
  expect(resultado).toEqual({ ok: true });

  legacyDb.close();
});
