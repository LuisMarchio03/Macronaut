import type { Client } from "@libsql/client";
import { seedDefaultMeals } from "../../src/repositories/meals.ts";

/**
 * A regra de "o que é dado de uso e o que é conteúdo".
 *
 * Separada do CLI para poder ser testada contra um banco de verdade: este é o
 * único código do repositório que APAGA em lote, e a única forma de provar que
 * ele preserva o que promete é rodá-lo e conferir o que sobrou.
 */

export interface Usuario {
  id: number;
  email: string;
}

export interface Pendencia {
  tabela: string;
  n: number;
}

export interface Plano {
  usuarios: Usuario[];
  pendentes: Pendencia[];
  /** Linhas que serão apagadas, somando tudo. */
  total: number;
  /** Quantas das linhas acima voltam em seguida (as refeições padrão). */
  recriadas: number;
  /** `false` quando a limpeza foi restrita a um usuário. */
  escopoGlobal: boolean;
  /**
   * Tabelas do schema atual que este banco não tem.
   *
   * Pular tabela inexistente é necessário — as do 5/3/1 saíram do schema e só
   * existem em banco antigo. Mas pular CALADO num comando destrutivo é o pior
   * dos mundos: o banco com schema atrasado diria "pronto, limpo" tendo
   * deixado dado para trás. As legadas não entram aqui de propósito; ausência
   * delas é o normal, não um aviso.
   */
  tabelasAusentes: string[];
}

export interface Opcoes {
  /** Restringe a um usuário. Sem isto, todos.  */
  email?: string;
  /** Recria as refeições padrão depois de limpar. Padrão: sim. */
  recriarRefeicoes?: boolean;
}

type Alvo = { tabela: string; onde: string; legado?: true };

/**
 * Filhos antes dos pais.
 *
 * O sqld liga `foreign_keys` por padrão, então o CASCADE do schema já daria
 * conta de boa parte disto — mas a ordem não custa nada e é o que segura a
 * limpeza num banco onde o pragma esteja desligado (SQLite puro, por exemplo).
 */
const POR_USUARIO: Alvo[] = [
  { tabela: "ai_messages", onde: "user_id IN (U)" },
  { tabela: "food_entries", onde: "user_id IN (U)" },
  { tabela: "water_log", onde: "user_id IN (U)" },
  { tabela: "weigh_ins", onde: "user_id IN (U)" },
  { tabela: "activity_sessions", onde: "user_id IN (U)" },

  { tabela: "calistenia_sets", onde: "user_id IN (U)" },
  // Meta é configuração do usuário, não catálogo: recomeçar do zero apaga.
  { tabela: "calistenia_metas", onde: "user_id IN (U)" },

  { tabela: "session_plan_sets", onde: "user_id IN (U)" },
  { tabela: "workout_sets", onde: "user_id IN (U)" },
  { tabela: "workout_sessions", onde: "user_id IN (U)" },

  {
    tabela: "routine_exercises",
    onde: "day_id IN (SELECT d.id FROM routine_days d JOIN routines r ON r.id = d.routine_id WHERE r.user_id IN (U))",
  },
  { tabela: "routine_days", onde: "routine_id IN (SELECT id FROM routines WHERE user_id IN (U))" },
  { tabela: "routines", onde: "user_id IN (U)" },

  // Legado do 5/3/1: saiu do schema, mas continua no banco de quem já usava.
  { tabela: "program_sessions", onde: "user_id IN (U)", legado: true },
  {
    tabela: "program_lifts",
    onde: "program_id IN (SELECT id FROM strength_programs WHERE user_id IN (U))",
    legado: true,
  },
  { tabela: "strength_programs", onde: "user_id IN (U)", legado: true },

  { tabela: "plan_checks", onde: "user_id IN (U)" },
  { tabela: "plan_swaps", onde: "plan_id IN (SELECT id FROM diet_plans WHERE user_id IN (U))" },
  { tabela: "plan_macros", onde: "plan_id IN (SELECT id FROM diet_plans WHERE user_id IN (U))" },
  {
    tabela: "plan_items",
    onde: "block_id IN (SELECT b.id FROM plan_blocks b JOIN diet_plans p ON p.id = b.plan_id WHERE p.user_id IN (U))",
  },
  { tabela: "plan_blocks", onde: "plan_id IN (SELECT id FROM diet_plans WHERE user_id IN (U))" },
  { tabela: "diet_plans", onde: "user_id IN (U)" },

  {
    tabela: "meal_template_items",
    onde: "template_id IN (SELECT id FROM meal_templates WHERE user_id IN (U))",
  },
  { tabela: "meal_templates", onde: "user_id IN (U)" },
  { tabela: "meals", onde: "user_id IN (U)" },
  { tabela: "profile", onde: "user_id IN (U)" },

  // Exercício próprio é do usuário; o catálogo (user_id NULL) fica.
  { tabela: "exercises", onde: "user_id IN (U)" },
];

/**
 * `foods` e `food_measures` não têm dono — um alimento criado à mão é global.
 * Por isso só entram quando a limpeza é do banco inteiro; com `--email` não há
 * como saber quem cadastrou o quê, e apagar seria chutar.
 */
const GLOBAIS: Alvo[] = [
  {
    tabela: "food_measures",
    onde: "source <> 'pof' OR food_id IN (SELECT id FROM foods WHERE source <> 'taco')",
  },
  { tabela: "foods", onde: "source <> 'taco'" },
];

async function tabelaExiste(db: Client, tabela: string): Promise<boolean> {
  const rs = await db.execute({
    sql: "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
    args: [tabela],
  });
  return rs.rows.length > 0;
}

async function alvosDe(
  db: Client,
  escopoGlobal: boolean,
): Promise<{ existentes: Alvo[]; ausentes: string[] }> {
  const candidatos = [...POR_USUARIO, ...(escopoGlobal ? GLOBAIS : [])];
  const existentes: Alvo[] = [];
  const ausentes: string[] = [];
  for (const a of candidatos) {
    if (await tabelaExiste(db, a.tabela)) existentes.push(a);
    else if (!a.legado) ausentes.push(a.tabela);
  }
  return { existentes, ausentes };
}

/** Os ids entram na SQL como literais; vêm do próprio banco, nunca de input. */
const comUsuarios = (onde: string, ids: number[]) => onde.replaceAll("(U)", `(${ids.join(", ")})`);

export async function usuariosAlvo(db: Client, email?: string): Promise<Usuario[]> {
  const rs = await db.execute(
    email
      ? { sql: "SELECT id, email FROM users WHERE email=?", args: [email] }
      : { sql: "SELECT id, email FROM users ORDER BY id", args: [] },
  );
  return rs.rows.map((r) => ({ id: r.id as number, email: r.email as string }));
}

/** Conta o que sairia, sem apagar nada. É o dry-run. */
export async function planejarLimpeza(db: Client, opcoes: Opcoes = {}): Promise<Plano> {
  const usuarios = await usuariosAlvo(db, opcoes.email);
  if (usuarios.length === 0) {
    throw new Error(
      opcoes.email ? `nenhum usuário com e-mail ${opcoes.email}` : "o banco não tem usuário nenhum",
    );
  }

  const escopoGlobal = !opcoes.email;
  const ids = usuarios.map((u) => u.id);
  const pendentes: Pendencia[] = [];
  let total = 0;

  const { existentes, ausentes } = await alvosDe(db, escopoGlobal);
  for (const alvo of existentes) {
    const rs = await db.execute(
      `SELECT COUNT(*) AS n FROM ${alvo.tabela} WHERE ${comUsuarios(alvo.onde, ids)}`,
    );
    const n = Number(rs.rows[0].n);
    if (n > 0) pendentes.push({ tabela: alvo.tabela, n });
    total += n;
  }

  // As refeições padrão saem e voltam no mesmo comando, então sozinhas elas
  // não são trabalho: sem esta conta, um banco recém-limpo continuaria
  // anunciando "10 a apagar" para sempre e ninguém saberia se sobrou dado.
  const recriadas =
    opcoes.recriarRefeicoes === false
      ? 0
      : (pendentes.find((p) => p.tabela === "meals")?.n ?? 0);

  return { usuarios, pendentes, total, recriadas, escopoGlobal, tabelasAusentes: ausentes };
}

/** `true` quando não há mais nada de uso no banco (fora o que é recriado). */
export const jaLimpo = (plano: Plano): boolean => plano.total - plano.recriadas === 0;

/** Apaga de verdade. Devolve quantas linhas saíram de cada tabela. */
export async function executarLimpeza(db: Client, opcoes: Opcoes = {}): Promise<Pendencia[]> {
  const plano = await planejarLimpeza(db, opcoes);
  const ids = plano.usuarios.map((u) => u.id);
  const porTabela = new Map(
    [...POR_USUARIO, ...GLOBAIS].map((a) => [a.tabela, a.onde] as const),
  );

  const apagados: Pendencia[] = [];
  for (const { tabela } of plano.pendentes) {
    const rs = await db.execute(
      `DELETE FROM ${tabela} WHERE ${comUsuarios(porTabela.get(tabela)!, ids)}`,
    );
    apagados.push({ tabela, n: rs.rowsAffected });
  }

  if (opcoes.recriarRefeicoes !== false) {
    // Sem isto a conta fica sem refeição nenhuma e o diário não tem onde
    // gravar — `seedDefaultMeals` só roda na criação do usuário, nunca depois.
    for (const id of ids) await seedDefaultMeals(db, id);
  }

  return apagados;
}
