import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { executarLimpeza, jaLimpo, planejarLimpeza } from "./limpar-dados";

/**
 * Este é o único código do repositório que apaga em lote. A única prova de que
 * ele preserva o que promete é rodá-lo contra um banco povoado e conferir o
 * que sobrou — por isso os testes montam dados em TODA tabela que a limpeza
 * toca, e não numa amostra.
 */

let db: Client;
const AGORA = "2026-08-20T10:00:00.000Z";

async function contar(tabela: string, onde = "1=1"): Promise<number> {
  const rs = await db.execute(`SELECT COUNT(*) AS n FROM ${tabela} WHERE ${onde}`);
  return Number(rs.rows[0].n);
}

/** Catálogos: conteúdo que não é de ninguém e precisa sobreviver à limpeza. */
async function semearCatalogos(): Promise<void> {
  await db.execute({
    sql: `INSERT INTO foods (id, nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES (1, 'Arroz, integral, cozido', 'taco', 100, 124, 2.6, 25.8, 1, ?)`,
    args: [AGORA],
  });
  await db.execute(
    "INSERT INTO food_measures (id, food_id, nome, qty_base, ordem, source) VALUES (1, 1, 'colher de sopa', 25, 0, 'pof')",
  );
  await db.execute("INSERT INTO muscle_groups (id, nome, regiao) VALUES (1, 'Peito', 'superior')");
  await db.execute("INSERT INTO activity_types (id, nome, met) VALUES (1, 'Corrida', 9.8)");
  await db.execute({
    sql: `INSERT INTO exercises (id, user_id, nome, source, created_at)
          VALUES (1, NULL, 'Supino reto com barra', 'catalogo', ?)`,
    args: [AGORA],
  });
}

/** Tudo que uma pessoa registra usando o app, para um usuário. */
async function semearUsuario(id: number, email: string): Promise<void> {
  await db.execute({
    sql: "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, 'hash', ?)",
    args: [id, email, AGORA],
  });
  await db.execute({
    sql: `INSERT INTO profile (user_id, sexo, data_nascimento, altura_cm, peso_kg,
            fator_atividade, objetivo, meta_kcal, meta_prot_g, meta_carb_g, meta_gord_g, updated_at)
          VALUES (?, 'M', '1998-05-10', 178, 82, 1.55, 'cutting', 1850, 150, 160, 50, ?)`,
    args: [id, AGORA],
  });
  await db.execute({
    sql: "INSERT INTO meals (id, user_id, nome, horario, ordem) VALUES (?, ?, 'Almoço', '12:00', 1)",
    args: [id * 100, id],
  });

  // Alimento e medida criados à mão: são do usuário, mesmo sem coluna de dono.
  await db.execute({
    sql: `INSERT INTO foods (id, nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES (?, 'Marmita da vó', 'custom', 100, 200, 10, 20, 8, ?)`,
    args: [id * 100, AGORA],
  });
  await db.execute({
    sql: "INSERT INTO food_measures (food_id, nome, qty_base, ordem, source) VALUES (1, 'pote', 300, 1, 'manual')",
    args: [],
  });

  await db.execute({
    sql: `INSERT INTO food_entries (user_id, data, meal_id, food_id, qty_g, created_at)
          VALUES (?, '2026-08-14', ?, 1, 150, ?)`,
    args: [id, id * 100, AGORA],
  });
  await db.execute({
    sql: "INSERT INTO water_log (user_id, data, ml, created_at) VALUES (?, '2026-08-14', 500, ?)",
    args: [id, AGORA],
  });
  await db.execute({
    sql: "INSERT INTO weigh_ins (user_id, data, peso_kg, created_at) VALUES (?, '2026-08-14', 82, ?)",
    args: [id, AGORA],
  });
  await db.execute({
    sql: `INSERT INTO activity_sessions (user_id, data, tipo, duracao_min, kcal, created_at)
          VALUES (?, '2026-08-14', 'Corrida', 30, 300, ?)`,
    args: [id, AGORA],
  });
  await db.execute({
    sql: "INSERT INTO ai_messages (user_id, provider, session_id, role, content, created_at) VALUES (?, 'gemini', 's1', 'user', 'oi', ?)",
    args: [id, AGORA],
  });

  // Exercício próprio, e o treino inteiro em volta dele.
  await db.execute({
    sql: "INSERT INTO exercises (id, user_id, nome, source, created_at) VALUES (?, ?, 'Rosca do Luís', 'custom', ?)",
    args: [id * 100, id, AGORA],
  });
  await db.execute({
    sql: "INSERT INTO workout_sessions (id, user_id, data, nome, created_at) VALUES (?, ?, '2026-08-14', 'Peito', ?)",
    args: [id * 100, id, AGORA],
  });
  await db.execute({
    sql: `INSERT INTO workout_sets (id, user_id, session_id, exercise_id, ordem, reps, peso_kg, created_at)
          VALUES (?, ?, ?, 1, 1, 10, 60, ?)`,
    args: [id * 100, id, id * 100, AGORA],
  });
  await db.execute({
    sql: `INSERT INTO session_plan_sets (user_id, session_id, exercise_id, ordem, serie_ordem, peso_kg, reps_alvo)
          VALUES (?, ?, 1, 1, 1, 60, 10)`,
    args: [id, id * 100],
  });
  await db.execute({
    sql: "INSERT INTO routines (id, user_id, nome, created_at) VALUES (?, ?, 'ABC', ?)",
    args: [id * 100, id, AGORA],
  });
  await db.execute({
    sql: "INSERT INTO routine_days (id, routine_id, dia_semana, nome) VALUES (?, ?, 1, 'Peito')",
    args: [id * 100, id * 100],
  });
  await db.execute({
    sql: "INSERT INTO routine_exercises (day_id, exercise_id, ordem) VALUES (?, 1, 1)",
    args: [id * 100],
  });

  // Plano alimentar completo.
  await db.execute({
    sql: `INSERT INTO diet_plans (id, user_id, nome, origem, ativo, created_at)
          VALUES (?, ?, 'PLANO DE CUTTING', 'xlsx', 1, ?)`,
    args: [id * 100, id, AGORA],
  });
  await db.execute({
    sql: "INSERT INTO plan_blocks (id, plan_id, tipo, nome, ordem) VALUES (?, ?, 'refeicao', 'Almoço', 0)",
    args: [id * 100, id * 100],
  });
  await db.execute({
    sql: "INSERT INTO plan_items (block_id, texto, ordem) VALUES (?, '120g de frango', 0)",
    args: [id * 100],
  });
  await db.execute({
    sql: "INSERT INTO plan_macros (plan_id, block_nome, prot_g, carb_g, gord_g, kcal) VALUES (?, 'Almoço', 35, 45, 15, 500)",
    args: [id * 100],
  });
  await db.execute({
    sql: `INSERT INTO plan_swaps (plan_id, block_nome, categoria, alimento, porcao, kcal)
          VALUES (?, 'Almoço', 'Proteína', 'Peixe branco', '120g', 115)`,
    args: [id * 100],
  });
  await db.execute({
    sql: `INSERT INTO plan_checks (user_id, plan_id, data, block_id, feito, created_at)
          VALUES (?, ?, '2026-08-14', ?, 1, ?)`,
    args: [id, id * 100, id * 100, AGORA],
  });

  await db.execute({
    sql: "INSERT INTO meal_templates (id, user_id, nome, created_at) VALUES (?, ?, 'Café de sempre', ?)",
    args: [id * 100, id, AGORA],
  });
  await db.execute({
    sql: "INSERT INTO meal_template_items (template_id, food_id, qty_g, ordem) VALUES (?, 1, 100, 0)",
    args: [id * 100],
  });

  // Calistenia: as séries soltas do dia e a meta diária.
  await db.execute({
    sql: `INSERT INTO calistenia_sets (user_id, data, exercise_id, reps, segundos, created_at)
          VALUES (?, '2026-08-14', 1, 20, NULL, ?)`,
    args: [id, AGORA],
  });
  await db.execute({
    sql: "INSERT INTO calistenia_metas (user_id, exercise_id, alvo_dia) VALUES (?, 1, 100)",
    args: [id],
  });
}

beforeEach(async () => {
  db = await createTestDb();
  await semearCatalogos();
  await semearUsuario(1, "luis@exemplo.com");
  await semearUsuario(2, "outro@exemplo.com");
});

describe("planejarLimpeza", () => {
  it("conta sem apagar nada", async () => {
    const antes = await contar("food_entries");
    const plano = await planejarLimpeza(db);

    expect(plano.total).toBeGreaterThan(0);
    expect(await contar("food_entries")).toBe(antes);
  });

  it("lista os dois usuários como preservados", async () => {
    const plano = await planejarLimpeza(db);
    expect(plano.usuarios.map((u) => u.email)).toEqual(["luis@exemplo.com", "outro@exemplo.com"]);
  });

  it("ignora tabela que o banco não tem", async () => {
    // `strength_programs` e companhia saíram do schema; num banco novo elas
    // nem existem, e consultá-las abortaria a limpeza inteira no meio.
    const plano = await planejarLimpeza(db);
    expect(plano.pendentes.map((p) => p.tabela)).not.toContain("strength_programs");
  });

  it("não reclama da ausência das tabelas legadas do 5/3/1", async () => {
    // Num banco com o schema atual elas não existem, e isso é o normal —
    // avisar aqui seria ruído em todo comando.
    const plano = await planejarLimpeza(db);
    expect(plano.tabelasAusentes).toEqual([]);
  });

  it("avisa quando falta tabela do schema atual, em vez de pular calado", async () => {
    // Um comando destrutivo que pula em silêncio diria "pronto, limpo" tendo
    // deixado dado para trás — o mesmo defeito que a tela de import tinha.
    await db.execute("DROP TABLE ai_messages");
    await db.execute("DROP TABLE weigh_ins");

    const plano = await planejarLimpeza(db);
    expect(plano.tabelasAusentes).toEqual(["ai_messages", "weigh_ins"]);
  });

  it("recusa e-mail que não existe em vez de limpar o banco todo", async () => {
    // O erro mais caro possível: um `--email` com typo virando "todos".
    await expect(planejarLimpeza(db, { email: "ninguem@exemplo.com" })).rejects.toThrow(
      /nenhum usuário/i,
    );
  });
});

describe("executarLimpeza", () => {
  it("preserva o login", async () => {
    await executarLimpeza(db);

    const rs = await db.execute("SELECT email, password_hash FROM users ORDER BY id");
    expect(rs.rows.map((r) => r.email)).toEqual(["luis@exemplo.com", "outro@exemplo.com"]);
    expect(rs.rows[0].password_hash).toBe("hash");
  });

  it("preserva os catálogos — TACO, medidas da POF, exercícios e grupos", async () => {
    await executarLimpeza(db);

    expect(await contar("foods", "source='taco'")).toBe(1);
    expect(await contar("food_measures", "source='pof'")).toBe(1);
    expect(await contar("exercises", "user_id IS NULL")).toBe(1);
    expect(await contar("muscle_groups")).toBe(1);
    expect(await contar("activity_types")).toBe(1);
  });

  it("apaga tudo que a pessoa registrou", async () => {
    await executarLimpeza(db);

    for (const tabela of [
      "food_entries",
      "water_log",
      "weigh_ins",
      "activity_sessions",
      "ai_messages",
      "workout_sessions",
      "workout_sets",
      "session_plan_sets",
      "calistenia_sets",
      "calistenia_metas",
      "routines",
      "routine_days",
      "routine_exercises",
      "diet_plans",
      "plan_blocks",
      "plan_items",
      "plan_macros",
      "plan_swaps",
      "plan_checks",
      "meal_templates",
      "meal_template_items",
      "profile",
    ]) {
      expect(`${tabela}=${await contar(tabela)}`).toBe(`${tabela}=0`);
    }
  });

  it("apaga o que o usuário criou à mão, e só isso", async () => {
    await executarLimpeza(db);

    expect(await contar("foods", "source='custom'")).toBe(0);
    expect(await contar("food_measures", "source='manual'")).toBe(0);
    expect(await contar("exercises", "user_id IS NOT NULL")).toBe(0);
  });

  it("recria as refeições padrão — sem elas o diário não tem onde gravar", async () => {
    await executarLimpeza(db);

    expect(await contar("meals", "user_id=1")).toBeGreaterThan(0);
    expect(await contar("meals", "user_id=2")).toBeGreaterThan(0);
    // As refeições recriadas são as de fábrica, não as que estavam lá.
    expect(await contar("meals", "nome='Almoço' AND horario='12:00' AND ordem=1")).toBe(0);
  });

  it("deixa a conta pelada com --sem-refeicoes", async () => {
    await executarLimpeza(db, { recriarRefeicoes: false });
    expect(await contar("meals")).toBe(0);
  });

  it("não deixa órfão para trás", async () => {
    await executarLimpeza(db);

    const orfaos = await db.execute(`
      SELECT (SELECT COUNT(*) FROM plan_items WHERE block_id NOT IN (SELECT id FROM plan_blocks)) itens,
             (SELECT COUNT(*) FROM routine_exercises WHERE day_id NOT IN (SELECT id FROM routine_days)) exercicios,
             (SELECT COUNT(*) FROM meal_template_items WHERE template_id NOT IN (SELECT id FROM meal_templates)) favoritas,
             (SELECT COUNT(*) FROM workout_sets WHERE session_id NOT IN (SELECT id FROM workout_sessions)) series
    `);
    expect(Object.values(orfaos.rows[0]).map(Number)).toEqual([0, 0, 0, 0]);
  });

  it("rodar de novo é seguro e não acha mais nada", async () => {
    await executarLimpeza(db);
    const plano = await planejarLimpeza(db);

    expect(jaLimpo(plano)).toBe(true);
    await expect(executarLimpeza(db)).resolves.toBeDefined();
    expect(await contar("users")).toBe(2);
  });
});

describe("limpeza restrita a um usuário", () => {
  it("não encosta nos dados de quem não foi pedido", async () => {
    await executarLimpeza(db, { email: "luis@exemplo.com" });

    expect(await contar("food_entries", "user_id=1")).toBe(0);
    expect(await contar("food_entries", "user_id=2")).toBe(1);
    expect(await contar("diet_plans", "user_id=2")).toBe(1);
    expect(await contar("profile", "user_id=2")).toBe(1);
  });

  it("deixa `foods` e `food_measures` de fora — não têm dono", async () => {
    // Um alimento criado à mão é global. Com o escopo num usuário, não há como
    // saber quem cadastrou o quê, e apagar seria chutar no dado do outro.
    await executarLimpeza(db, { email: "luis@exemplo.com" });

    expect(await contar("foods", "source='custom'")).toBe(2);
    expect(await contar("food_measures", "source='manual'")).toBe(2);
  });

  it("não apaga o plano do outro usuário pelo caminho dos blocos", async () => {
    await executarLimpeza(db, { email: "luis@exemplo.com" });

    expect(await contar("plan_blocks")).toBe(1);
    expect(await contar("plan_items")).toBe(1);
    expect(await contar("plan_swaps")).toBe(1);
  });
});
