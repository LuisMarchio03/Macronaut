import type { Client, Row } from "@libsql/client";
import type { Equipamento, Exercise, ExerciseSource, TipoExercicio } from "../domain/types.js";
import { CATALOGO, GRUPOS, RENOMEADOS } from "../db/catalogo-exercicios.js";
import { normalizar } from "../domain/texto.js";

export type ResultadoEx = { ok: true } | { ok: false; reason: "em_uso" | "catalogo" };

/**
 * O que se pode escrever num exercício seu.
 *
 * Cresceu para além de `nome` + `grupo_id`: sem `equipamento` não dava para
 * cadastrar um cardio próprio (é ele que faz a sessão tratar o item como
 * duração em vez de séries), e sem `instrucoes`/`aliases` a ficha e a busca
 * do exercício ficavam vazias justamente nos exercícios que são só seus.
 */
export type ExInput = {
  nome: string;
  grupo_id: number | null;
  tipo?: TipoExercicio | null;
  equipamento?: Equipamento | null;
  met?: number | null;
  instrucoes?: string | null;
  musculos_secundarios?: string | null;
  aliases?: string | null;
};

function mapRow(r: Row): Exercise {
  return {
    id: r.id as number,
    user_id: (r.user_id as number | null) ?? null,
    nome: r.nome as string,
    grupo_muscular: (r.grupo_muscular as string | null) ?? null,
    grupo_id: (r.grupo_id as number | null) ?? null,
    grupo_nome: (r.grupo_nome as string | null) ?? null,
    source: r.source as ExerciseSource,
    tipo: (r.tipo as TipoExercicio | null) ?? null,
    equipamento: (r.equipamento as Equipamento | null) ?? null,
    met: (r.met as number | null) ?? null,
    fracao_corporal: (r.fracao_corporal as number | null) ?? null,
    medida: (r.medida as "reps" | "segundos" | null) ?? null,
    instrucoes: (r.instrucoes as string | null) ?? null,
    musculos_secundarios: (r.musculos_secundarios as string | null) ?? null,
    aliases: (r.aliases as string | null) ?? null,
    created_at: r.created_at as string,
  };
}

/** Catálogo global (`user_id IS NULL`) + os do próprio usuário. */
export async function listExercises(db: Client, userId: number): Promise<Exercise[]> {
  const rs = await db.execute({
    sql: `SELECT e.*, mg.nome AS grupo_nome
          FROM exercises e
          LEFT JOIN muscle_groups mg ON mg.id = e.grupo_id
          WHERE e.user_id IS NULL OR e.user_id = ?
          ORDER BY e.nome`,
    args: [userId],
  });
  return rs.rows.map(mapRow);
}

/** True se a linha existe E pertence ao usuário E não é catálogo. */
async function editavelPor(db: Client, userId: number, id: number): Promise<boolean> {
  const rs = await db.execute({
    sql: "SELECT 1 FROM exercises WHERE id=? AND source='custom' AND user_id=?",
    args: [id, userId],
  });
  return rs.rows.length > 0;
}

export async function createExercise(
  db: Client,
  userId: number,
  e: ExInput,
): Promise<Exercise> {
  const created_at = new Date().toISOString();
  const rs = await db.execute({
    sql: `INSERT INTO exercises
            (user_id, nome, grupo_id, source, tipo, equipamento, met,
             instrucoes, musculos_secundarios, aliases, created_at)
          VALUES (?, ?, ?, 'custom', ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      userId, e.nome, e.grupo_id,
      e.tipo ?? null, e.equipamento ?? null, e.met ?? null,
      e.instrucoes ?? null, e.musculos_secundarios ?? null, e.aliases ?? null,
      created_at,
    ],
  });
  const id = Number(rs.lastInsertRowid);
  const lido = await db.execute({
    sql: `SELECT e.*, mg.nome AS grupo_nome FROM exercises e
          LEFT JOIN muscle_groups mg ON mg.id = e.grupo_id WHERE e.id = ?`,
    args: [id],
  });
  return mapRow(lido.rows[0]);
}

export async function updateExercise(
  db: Client,
  userId: number,
  id: number,
  e: ExInput,
): Promise<ResultadoEx> {
  if (!(await editavelPor(db, userId, id))) return { ok: false, reason: "catalogo" };
  await db.execute({
    sql: `UPDATE exercises
          SET nome=?, grupo_id=?, tipo=?, equipamento=?, met=?,
              instrucoes=?, musculos_secundarios=?, aliases=?
          WHERE id=? AND source='custom' AND user_id=?`,
    args: [
      e.nome, e.grupo_id,
      e.tipo ?? null, e.equipamento ?? null, e.met ?? null,
      e.instrucoes ?? null, e.musculos_secundarios ?? null, e.aliases ?? null,
      id, userId,
    ],
  });
  return { ok: true };
}

export async function deleteExercise(
  db: Client,
  userId: number,
  id: number,
): Promise<ResultadoEx> {
  if (!(await editavelPor(db, userId, id))) return { ok: false, reason: "catalogo" };
  const usado = await db.execute({
    sql: "SELECT 1 FROM workout_sets WHERE exercise_id=? LIMIT 1",
    args: [id],
  });
  if (usado.rows.length) return { ok: false, reason: "em_uso" };
  await db.execute({
    sql: "DELETE FROM exercises WHERE id=? AND source='custom' AND user_id=?",
    args: [id, userId],
  });
  return { ok: true };
}

/**
 * Sinônimos de texto livre → nome canônico do grupo. Chaves já normalizadas.
 * Não repita aqui nada que `mapaDeGrupos()` já deriva de `normalizar(g.nome)`
 * (ex.: "biceps" → "Bíceps" já sai do próprio nome do grupo) — isso mascara
 * lacuna de cobertura do strip de acento de `normalizar()`.
 */
const SINONIMOS: Record<string, string> = {
  peitoral: "Peito",
  dorsal: "Costas",
  costa: "Costas",
  dorsais: "Costas",
  ombro: "Ombros",
  deltoide: "Ombros",
  perna: "Quadríceps",
  pernas: "Quadríceps",
  posteriores: "Posterior",
  isquiotibiais: "Posterior",
  gluteo: "Glúteos",
  abdomen: "Core",
  abdominal: "Core",
  abdominais: "Core",
  panturrilhas: "Panturrilha",
};

/** normalizado → nome canônico, cobrindo os próprios nomes dos grupos + sinônimos. */
function mapaDeGrupos(): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of GRUPOS) m.set(normalizar(g.nome), g.nome);
  for (const [k, v] of Object.entries(SINONIMOS)) m.set(k, v);
  return m;
}

async function idsDosGrupos(db: Client): Promise<Map<string, number>> {
  const rs = await db.execute("SELECT id, nome FROM muscle_groups");
  return new Map(rs.rows.map((r) => [r.nome as string, r.id as number]));
}

/**
 * Aplica `RENOMEADOS` antes do upsert, preservando o id da linha.
 *
 * Dois caminhos, conforme o nome novo já exista ou não:
 *
 *  - não existe → RENOMEIA a linha antiga. O id sobrevive, e com ele tudo que
 *    aponta para ele.
 *  - já existe (um seed rodou entre a versão antiga e esta, criando a linha
 *    nova e deixando a velha para trás) → a velha é duplicata pura. Some, mas
 *    SÓ se nada apontar para ela; se apontar, fica, porque juntar o histórico
 *    de duas linhas é decisão de gente, não de seed.
 *
 * Nunca toca `source='custom'`: um exercício SEU chamado "Búlgaro com
 * halteres" é seu, e não vira outra coisa porque o catálogo mudou de ideia.
 */
async function aplicarRenomeios(db: Client): Promise<number> {
  const rs = await db.execute("SELECT id, nome FROM exercises WHERE source='catalogo'");
  const porNome = new Map(rs.rows.map((r) => [r.nome as string, r.id as number]));

  let mexidos = 0;
  for (const [antigo, novo] of Object.entries(RENOMEADOS)) {
    const id = porNome.get(antigo);
    if (id === undefined) continue;

    if (!porNome.has(novo)) {
      await db.execute({
        sql: "UPDATE exercises SET nome=? WHERE id=? AND source='catalogo'",
        args: [novo, id],
      });
      porNome.delete(antigo);
      porNome.set(novo, id);
      mexidos++;
      continue;
    }

    if (await estaEmUso(db, id)) continue;
    await db.execute({
      sql: "DELETE FROM exercises WHERE id=? AND source='catalogo'",
      args: [id],
    });
    porNome.delete(antigo);
    mexidos++;
  }
  return mexidos;
}

/** Alguma coisa aponta para este exercício? Treino feito, rotina ou plano de sessão. */
async function estaEmUso(db: Client, id: number): Promise<boolean> {
  const rs = await db.execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM workout_sets      WHERE exercise_id=?) +
            (SELECT COUNT(*) FROM routine_exercises WHERE exercise_id=?) +
            (SELECT COUNT(*) FROM session_plan_sets WHERE exercise_id=?) AS n`,
    args: [id, id, id],
  });
  return Number(rs.rows[0].n) > 0;
}

/**
 * Upsert do catálogo global. A chave é `(nome, source='catalogo')` — NUNCA `nome`
 * sozinho: `exercises` não tem índice único em `nome`, e casar só por nome
 * sobrescreveria um exercício `custom` homônimo do usuário.
 * Esta função nunca lê nem escreve linha `source='custom'`.
 */
export async function seedExercicios(db: Client): Promise<void> {
  const grupoId = await idsDosGrupos(db);
  const created_at = new Date().toISOString();

  await aplicarRenomeios(db);

  const rs = await db.execute("SELECT id, nome FROM exercises WHERE source='catalogo'");
  const existentes = new Map(rs.rows.map((r) => [r.nome as string, r.id as number]));

  const stmts = CATALOGO.map((e) => {
    const gid = grupoId.get(e.grupo) ?? null;
    const id = existentes.get(e.nome);
    const secundarios = e.secundarios?.join(", ") ?? null;
    const aliases = e.aliases?.join(", ") ?? null;
    const instrucoes = e.instrucoes?.join("\n") ?? null;
    return id === undefined
      ? {
          sql: `INSERT INTO exercises
                  (user_id, nome, grupo_id, source, tipo, equipamento,
                   musculos_secundarios, aliases, instrucoes, met, fracao_corporal, medida, created_at)
                VALUES (NULL, ?, ?, 'catalogo', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [e.nome, gid, e.tipo, e.equipamento, secundarios, aliases, instrucoes,
                 e.met ?? null, e.fracao ?? null, e.medida ?? null, created_at],
        }
      : {
          // A ficha do catálogo é reescrita a cada seed de propósito: ela é
          // conteúdo NOSSO, versionado no código, e não edição do usuário —
          // linha de catálogo é somente-leitura na UI.
          // `met` NÃO entra no UPDATE: `seedExerciciosDeCardio` semeia o MET
          // do cardio por outro caminho, e escrever NULL aqui apagaria o MET
          // de toda bicicleta já cadastrada. Quem já existe recebe MET e
          // fração por `backfillCalistenia`, que só preenche o que está NULL.
          sql: `UPDATE exercises
                SET grupo_id=?, tipo=?, equipamento=?,
                    musculos_secundarios=?, aliases=?, instrucoes=?,
                    fracao_corporal=?, medida=?
                WHERE id=? AND source='catalogo'`,
          args: [gid, e.tipo, e.equipamento, secundarios, aliases, instrucoes,
                 e.fracao ?? null, e.medida ?? null, id],
        };
  });
  await db.batch(stmts, "write");
}

/**
 * Preenche MET e fração corporal dos exercícios de peso corporal que já
 * existiam antes da calistenia.
 *
 * Só onde está NULL: nunca sobrescreve valor já gravado — a mesma regra de
 * `backfillGrupos`, e o que protege o MET do cardio e qualquer correção feita
 * à mão. Devolve quantas linhas foram tocadas.
 */
export async function backfillCalistenia(db: Client): Promise<number> {
  const doCorpo = CATALOGO.filter((e) => e.equipamento === "peso_corporal");
  if (doCorpo.length === 0) return 0;

  const rs = await db.batch(
    doCorpo.map((e) => ({
      sql: `UPDATE exercises
            SET met = COALESCE(met, ?),
                fracao_corporal = COALESCE(fracao_corporal, ?),
                medida = COALESCE(medida, ?)
            WHERE nome = ? AND source = 'catalogo'
              AND (met IS NULL OR fracao_corporal IS NULL)`,
      args: [e.met ?? null, e.fracao ?? null, e.medida ?? null, e.nome] as (number | string | null)[],
    })),
    "write",
  );
  return rs.reduce((acc, r) => acc + r.rowsAffected, 0);
}

/**
 * Casa `grupo_muscular` (texto livre legado) → `grupo_id`, só onde `grupo_id`
 * ainda é NULL. Nunca sobrescreve grupo já definido — protege correção manual.
 * O que não casar fica NULL e aparece como pendente na UI.
 * Devolve quantos foram casados.
 */
export async function backfillGrupos(db: Client): Promise<number> {
  const mapa = mapaDeGrupos();
  const grupoId = await idsDosGrupos(db);

  const rs = await db.execute(
    "SELECT id, grupo_muscular FROM exercises WHERE grupo_id IS NULL AND grupo_muscular IS NOT NULL",
  );

  const stmts: { sql: string; args: (number | string)[] }[] = [];
  for (const r of rs.rows) {
    const canonico = mapa.get(normalizar(r.grupo_muscular as string));
    if (!canonico) continue;
    const gid = grupoId.get(canonico);
    if (gid === undefined) continue;
    stmts.push({
      sql: "UPDATE exercises SET grupo_id=? WHERE id=? AND grupo_id IS NULL",
      args: [gid, r.id as number],
    });
  }
  if (stmts.length > 0) await db.batch(stmts, "write");
  return stmts.length;
}

/**
 * Casa `user_id` (coluna aditiva, NULL em toda linha pré-existente) → dono
 * real, só onde `user_id` ainda é NULL **e** `source='custom'`. Nunca toca
 * `source='catalogo'`: essas linhas têm `user_id` NULL de propósito (é o que
 * as torna globais) — atribuir dono a elas destruiria o catálogo.
 *
 * Ordem de atribuição, nunca chutando:
 *  1. Uso real em `workout_sets` (coluna NOT NULL, então sempre reflete o
 *     dono de quem já treinou com o exercício). Exatamente 1 `user_id`
 *     distinto → é o dono. Mais de 1 → ambíguo (possível quando `exercises`
 *     ainda era global e dois usuários usaram o mesmo id) → fica NULL.
 *  2. Nunca usado: só dá para atribuir sem chutar se houver exatamente 1
 *     usuário cadastrado no banco inteiro. Com 2+ usuários, fica NULL.
 * Nunca sobrescreve `user_id` já definido. Devolve quantos foram casados.
 */
export async function backfillUserIds(db: Client): Promise<number> {
  const pendentes = await db.execute(
    "SELECT id FROM exercises WHERE source='custom' AND user_id IS NULL",
  );
  if (pendentes.rows.length === 0) return 0;

  const uso = await db.execute(
    "SELECT exercise_id, COUNT(DISTINCT user_id) AS n, MIN(user_id) AS uid FROM workout_sets GROUP BY exercise_id",
  );
  const usoPorExercicio = new Map<number, { n: number; uid: number }>();
  for (const r of uso.rows) {
    usoPorExercicio.set(r.exercise_id as number, { n: r.n as number, uid: r.uid as number });
  }

  const totais = await db.execute("SELECT COUNT(*) AS n, MIN(id) AS uid FROM users");
  const totalUsuarios = totais.rows[0].n as number;
  const usuarioUnico = totalUsuarios === 1 ? (totais.rows[0].uid as number) : null;

  const stmts: { sql: string; args: number[] }[] = [];
  for (const r of pendentes.rows) {
    const id = r.id as number;
    const usado = usoPorExercicio.get(id);
    const uid = usado ? (usado.n === 1 ? usado.uid : null) : usuarioUnico;
    if (uid === null) continue;
    stmts.push({
      sql: "UPDATE exercises SET user_id=? WHERE id=? AND user_id IS NULL AND source='custom'",
      args: [uid, id],
    });
  }
  if (stmts.length > 0) await db.batch(stmts, "write");
  return stmts.length;
}
