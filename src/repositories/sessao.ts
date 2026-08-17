import type { Client, Row } from "@libsql/client";
import { planejar, type Prescricao, type SeriePlanejada } from "../domain/prescricao";
import type { TipoSerie } from "../domain/types";
import { listExercicios, type ExercicioRotina } from "./rotina";
import { createSession, historicoExercicio } from "./workouts";

/**
 * A sessão materializada: o plano congelado no banco no momento em que o
 * treino começou.
 *
 * O plano mora em `session_plan_sets`, separado de `workout_sets`, porque
 * `workout_sets` significa "o que foi feito" para meia dúzia de consultas que
 * não sabem que existe plano. Uma linha de plano sem `set_id` é, com precisão,
 * uma série que você não fez.
 */

export interface PlanoSerie {
  id: number;
  session_id: number;
  routine_exercise_id: number | null;
  exercise_id: number;
  nome: string;
  /** Posição na sessão inteira. */
  ordem: number;
  /** Posição dentro do exercício — é o que vai para `workout_sets.ordem`. */
  serie_ordem: number;
  peso_kg: number;
  reps_alvo: number;
  reps_min: number | null;
  tipo: TipoSerie;
  amrap: boolean;
  pct: number | null;
  descanso_s: number | null;
  set_id: number | null;
  /** O que foi efetivamente feito, quando já foi. */
  reps_feitas: number | null;
  peso_feito_kg: number | null;

  /* ── cardio ──
     Um item de cardio é uma linha só, com duração no lugar de reps e carga, e
     que ao ser confirmada grava em `activity_sessions` — não em `workout_sets`,
     onde vive levantamento de peso e onde uma linha de bike quebraria volume,
     1RM e progressão de uma vez. */
  /** Minutos prescritos. Não-nulo identifica a linha como cardio. */
  duracao_min: number | null;
  /** MET do exercício, do catálogo — o insumo da estimativa de calorias. */
  met: number | null;
  /** `activity_sessions` quando cumprida; NULL = pendente. */
  activity_id: number | null;
  duracao_feita_min: number | null;
  kcal_feita: number | null;
}

/** Uma linha de cardio é a que tem duração prescrita. */
export function ehCardio(p: PlanoSerie): boolean {
  return p.duracao_min !== null;
}

export interface ItemPlanejado {
  routine_exercise_id: number | null;
  exercise_id: number;
  /** O nome do exercício, para quem exibe o plano antes de ele virar sessão
   *  não precisar de um segundo join só para escrever "Supino reto". */
  nome: string;
  descanso_s: number | null;
  series: SeriePlanejada[];
}

function mapPlano(r: Row): PlanoSerie {
  return {
    id: r.id as number,
    session_id: r.session_id as number,
    routine_exercise_id: (r.routine_exercise_id as number | null) ?? null,
    exercise_id: r.exercise_id as number,
    nome: (r.exercicio_nome as string | null) ?? "?",
    ordem: r.ordem as number,
    serie_ordem: r.serie_ordem as number,
    peso_kg: r.peso_kg as number,
    reps_alvo: r.reps_alvo as number,
    reps_min: (r.reps_min as number | null) ?? null,
    tipo: r.tipo as TipoSerie,
    amrap: Number(r.amrap) === 1,
    pct: (r.pct as number | null) ?? null,
    descanso_s: (r.descanso_s as number | null) ?? null,
    set_id: (r.set_id as number | null) ?? null,
    reps_feitas: (r.reps_feitas as number | null) ?? null,
    peso_feito_kg: (r.peso_feito_kg as number | null) ?? null,
    duracao_min: (r.duracao_min as number | null) ?? null,
    met: (r.met as number | null) ?? null,
    activity_id: (r.activity_id as number | null) ?? null,
    duracao_feita_min: (r.duracao_feita_min as number | null) ?? null,
    kcal_feita: (r.kcal_feita as number | null) ?? null,
  };
}

/** As linhas de plano de um item, a partir do ponto onde a ordem global está. */
function linhasDoItem(
  userId: number,
  sessionId: number,
  item: ItemPlanejado,
  ordemInicial: number,
) {
  return item.series.map((s, i) => ({
    sql: `INSERT INTO session_plan_sets
            (user_id, session_id, routine_exercise_id, exercise_id, ordem, serie_ordem,
             peso_kg, reps_alvo, reps_min, tipo, amrap, pct, descanso_s, duracao_min)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      userId, sessionId, item.routine_exercise_id, item.exercise_id,
      ordemInicial + i, s.ordem,
      s.peso_kg, s.reps_alvo, s.reps_min, s.tipo, s.amrap ? 1 : 0, s.pct,
      item.descanso_s, s.duracao_min,
    ] as (number | string | null)[],
  }));
}

export async function iniciarSessao(
  db: Client,
  userId: number,
  entrada: { data: string; nome: string | null; itens: ItemPlanejado[] },
): Promise<number> {
  const sessao = await createSession(db, userId, { data: entrada.data, nome: entrada.nome });

  let ordem = 1;
  const comandos = entrada.itens.flatMap((item) => {
    const linhas = linhasDoItem(userId, sessao.id, item, ordem);
    ordem += item.series.length;
    return linhas;
  });
  if (comandos.length > 0) await db.batch(comandos, "write");

  return sessao.id;
}

export async function adicionarAoPlano(
  db: Client,
  userId: number,
  sessionId: number,
  item: ItemPlanejado,
): Promise<void> {
  // MAX(ordem)+1, não COUNT+1: nada apaga linha de plano hoje, mas COUNT+1
  // colidiria em silêncio no dia em que algo apagar.
  const rs = await db.execute({
    sql: `SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima
          FROM session_plan_sets WHERE user_id = ? AND session_id = ?`,
    args: [userId, sessionId],
  });
  const comandos = linhasDoItem(userId, sessionId, item, rs.rows[0].proxima as number);
  if (comandos.length > 0) await db.batch(comandos, "write");
}

export async function getPlano(
  db: Client,
  userId: number,
  sessionId: number,
): Promise<PlanoSerie[]> {
  const rs = await db.execute({
    sql: `SELECT p.*, e.nome AS exercicio_nome, e.met AS met,
                 ws.reps AS reps_feitas, ws.peso_kg AS peso_feito_kg,
                 a.duracao_min AS duracao_feita_min, a.kcal AS kcal_feita
          FROM session_plan_sets p
          LEFT JOIN exercises e          ON e.id  = p.exercise_id
          LEFT JOIN workout_sets ws      ON ws.id = p.set_id
          LEFT JOIN activity_sessions a  ON a.id  = p.activity_id
          WHERE p.user_id = ? AND p.session_id = ?
          ORDER BY p.ordem`,
    args: [userId, sessionId],
  });
  return rs.rows.map(mapPlano);
}

export async function registrarSerie(
  db: Client,
  userId: number,
  planId: number,
  v: { reps: number; peso_kg: number; tipo: TipoSerie; rir: number | null; nota: string | null },
): Promise<void> {
  const rs = await db.execute({
    sql: `SELECT session_id, exercise_id, serie_ordem, pct, amrap
          FROM session_plan_sets WHERE id = ? AND user_id = ?`,
    args: [planId, userId],
  });
  if (!rs.rows.length) return;
  const linha = rs.rows[0];

  const ins = await db.execute({
    sql: `INSERT INTO workout_sets
            (user_id, session_id, exercise_id, ordem, reps, peso_kg, tipo, rir, nota,
             prescribed_pct, amrap, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      userId,
      linha.session_id as number,
      linha.exercise_id as number,
      linha.serie_ordem as number,
      v.reps, v.peso_kg, v.tipo, v.rir, v.nota,
      (linha.pct as number | null) ?? null,
      Number(linha.amrap) === 1 ? 1 : 0,
      new Date().toISOString(),
    ],
  });

  await db.execute({
    sql: "UPDATE session_plan_sets SET set_id = ? WHERE id = ? AND user_id = ?",
    args: [Number(ins.lastInsertRowid), planId, userId],
  });
}

/**
 * Confirma um item de cardio.
 *
 * Grava em `activity_sessions` — a mesma tabela que o balanço energético e a
 * análise já leem — e não em `workout_sets`. Cardio dentro de um treino tem
 * que somar calorias no mesmo lugar que o cardio de sempre somava, senão o
 * balanço passa a depender de por onde você registrou.
 */
export async function registrarCardio(
  db: Client,
  userId: number,
  planId: number,
  v: { duracao_min: number; kcal: number },
): Promise<void> {
  const rs = await db.execute({
    sql: `SELECT p.session_id, s.data AS data, e.nome AS nome
          FROM session_plan_sets p
          JOIN workout_sessions s ON s.id = p.session_id
          LEFT JOIN exercises e   ON e.id = p.exercise_id
          WHERE p.id = ? AND p.user_id = ?`,
    args: [planId, userId],
  });
  if (!rs.rows.length) return;
  const linha = rs.rows[0];

  const ins = await db.execute({
    sql: `INSERT INTO activity_sessions (user_id, data, tipo, duracao_min, kcal, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      userId,
      linha.data as string,
      (linha.nome as string | null) ?? "Cardio",
      v.duracao_min,
      v.kcal,
      new Date().toISOString(),
    ],
  });

  await db.execute({
    sql: "UPDATE session_plan_sets SET activity_id = ? WHERE id = ? AND user_id = ?",
    args: [Number(ins.lastInsertRowid), planId, userId],
  });
}

export async function desfazerSerie(db: Client, userId: number, planId: number): Promise<void> {
  const rs = await db.execute({
    sql: "SELECT set_id, activity_id FROM session_plan_sets WHERE id = ? AND user_id = ?",
    args: [planId, userId],
  });
  if (!rs.rows.length) return;
  const setId = (rs.rows[0].set_id as number | null) ?? null;
  const activityId = (rs.rows[0].activity_id as number | null) ?? null;
  if (setId === null && activityId === null) return;

  // Um dos dois elos existe, nunca os dois: uma linha de plano é série OU
  // cardio. Desfazer apaga o registro e zera os dois por segurança.
  const comandos = [];
  if (setId !== null) {
    comandos.push({
      sql: "DELETE FROM workout_sets WHERE id = ? AND user_id = ?",
      args: [setId, userId] as (number | string | null)[],
    });
  }
  if (activityId !== null) {
    comandos.push({
      sql: "DELETE FROM activity_sessions WHERE id = ? AND user_id = ?",
      args: [activityId, userId] as (number | string | null)[],
    });
  }
  comandos.push({
    sql: "UPDATE session_plan_sets SET set_id = NULL, activity_id = NULL WHERE id = ? AND user_id = ?",
    args: [planId, userId] as (number | string | null)[],
  });
  await db.batch(comandos, "write");
}

/** Marca a sessão como encerrada. Idempotente: reencerrar não muda a hora. */
export async function finalizarSessao(
  db: Client,
  userId: number,
  sessionId: number,
): Promise<void> {
  await db.execute({
    sql: `UPDATE workout_sessions SET concluida_em = ?
          WHERE id = ? AND user_id = ? AND concluida_em IS NULL`,
    args: [new Date().toISOString(), sessionId, userId],
  });
}

/**
 * A sessão de hoje que ainda não foi encerrada.
 *
 * O filtro por `concluida_em` é o que impede o hub de oferecer "retomar" um
 * treino que já acabou — antes ele oferecia para sempre, inclusive com todas
 * as séries feitas.
 */
export async function sessaoEmAndamento(
  db: Client,
  userId: number,
  data: string,
): Promise<{ session_id: number; nome: string | null; total: number; feitas: number } | null> {
  const rs = await db.execute({
    sql: `SELECT s.id AS session_id, s.nome AS nome,
                 COUNT(p.id) AS total,
                 SUM(CASE WHEN p.set_id IS NOT NULL OR p.activity_id IS NOT NULL THEN 1 ELSE 0 END) AS feitas
          FROM workout_sessions s
          JOIN session_plan_sets p ON p.session_id = s.id
          WHERE s.user_id = ? AND s.data = ? AND s.concluida_em IS NULL
          GROUP BY s.id
          ORDER BY s.created_at DESC
          LIMIT 1`,
    args: [userId, data],
  });
  if (!rs.rows.length) return null;
  const r = rs.rows[0];
  return {
    session_id: r.session_id as number,
    nome: (r.nome as string | null) ?? null,
    total: Number(r.total),
    feitas: Number(r.feitas ?? 0),
  };
}

/**
 * Marcas de AMRAP do exercício — o recorde de repetições num peso.
 *
 * Veio de `repositories/programa.ts` sem mudança: a pergunta continua sendo
 * sobre `workout_sets`, só o dono do arquivo mudou.
 */
export async function marcasAmrap(
  db: Client,
  userId: number,
  exerciseId: number,
): Promise<{ peso_kg: number; reps: number }[]> {
  const rs = await db.execute({
    sql: `SELECT peso_kg, reps FROM workout_sets
          WHERE user_id=? AND exercise_id=? AND amrap=1
          ORDER BY id`,
    args: [userId, exerciseId],
  });
  return rs.rows.map((r) => ({ peso_kg: r.peso_kg as number, reps: r.reps as number }));
}

/** A prescrição guardada na rotina, no formato que o domínio entende. */
function prescricaoDe(e: ExercicioRotina): Prescricao {
  if (e.prescricao === "cardio") {
    return { tipo: "cardio", duracao_min: e.duracao_min ?? 30, met: e.met ?? 6 };
  }
  if (e.prescricao === "531") {
    return {
      tipo: "531",
      tm_kg: e.tm_kg ?? 0,
      parte: e.parte ?? "superior",
      incremento_kg: e.incremento_kg,
    };
  }
  if (e.prescricao === "fixa") {
    return { tipo: "fixa", series: e.series, reps: e.reps_max ?? 10, peso_kg: e.peso_kg ?? 0 };
  }
  return {
    tipo: "dupla",
    series: e.series,
    reps_min: e.reps_min ?? 8,
    reps_max: e.reps_max ?? 12,
    peso_inicial_kg: e.peso_kg ?? 0,
    incremento_kg: e.incremento_kg,
  };
}

/**
 * O treino de um dia da rotina, já com as cargas de hoje.
 *
 * Cruza a rotina com o histórico de cada exercício — orquestração de dados, não
 * regra: a conta em si é `planejar`, que continua pura. Fica aqui e não na tela
 * porque são N consultas por dia, e uma tela orquestrando N consultas vira uma
 * tela que sabe SQL.
 */
export async function montarPlanoDoDia(
  db: Client,
  userId: number,
  dayId: number,
  data: string,
): Promise<ItemPlanejado[]> {
  const exercicios = await listExercicios(db, userId, dayId);
  return Promise.all(
    exercicios.map(async (e) => ({
      routine_exercise_id: e.id,
      exercise_id: e.exercise_id,
      nome: e.nome,
      descanso_s: e.descanso_s,
      series: planejar(prescricaoDe(e), await historicoExercicio(db, userId, e.exercise_id, data)),
    })),
  );
}
