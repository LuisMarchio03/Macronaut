import type { Client, Row } from "@libsql/client";
import type { Medida, SerieAvulsa } from "../domain/calistenia.js";
import type { ExerciseSource } from "../domain/types.js";

/**
 * O SQL da calistenia.
 *
 * Toda leitura junta `exercises` para trazer nome, grupo, fração corporal e
 * MET: o domínio recebe a série pronta e não precisa de uma segunda consulta
 * para saber quanto vale uma flexão.
 */

export interface RegistroCalistenia {
  data: string;
  exercise_id: number;
  reps: number | null;
  segundos: number | null;
  peso_extra_kg: number | null;
}

export interface ExercicioDeCalistenia {
  id: number;
  nome: string;
  grupo_nome: string | null;
  aliases: string | null;
  source: ExerciseSource;
  medida: Medida;
  fracao_corporal: number | null;
  met: number | null;
}

export interface UsoRecente {
  exercise_id: number;
  nome: string;
  medida: Medida;
  /** A quantidade da última vez — é com ela que o stepper abre. */
  ultima_qtd: number;
  vezes: number;
}

export interface MetaCalistenia {
  exercise_id: number;
  nome: string;
  medida: Medida;
  alvo_dia: number;
}

const SELECT_SERIE = `
  SELECT c.id, c.data, c.created_at, c.exercise_id, c.reps, c.segundos, c.peso_extra_kg,
         e.nome AS nome, g.nome AS grupo, e.fracao_corporal, e.met
  FROM calistenia_sets c
  JOIN exercises e ON e.id = c.exercise_id
  LEFT JOIN muscle_groups g ON g.id = e.grupo_id
`;

function mapSerie(r: Row): SerieAvulsa {
  return {
    id: r.id as number,
    data: r.data as string,
    created_at: r.created_at as string,
    exercise_id: r.exercise_id as number,
    nome: (r.nome as string | null) ?? "?",
    grupo: (r.grupo as string | null) ?? null,
    reps: (r.reps as number | null) ?? null,
    segundos: (r.segundos as number | null) ?? null,
    peso_extra_kg: (r.peso_extra_kg as number | null) ?? null,
    fracao_corporal: (r.fracao_corporal as number | null) ?? null,
    met: (r.met as number | null) ?? null,
  };
}

/** A coluna é texto livre no banco; só 'segundos' significa isometria. */
function medidaDaColuna(v: unknown): Medida {
  return v === "segundos" ? "segundos" : "reps";
}

export async function registrarSerie(
  db: Client,
  userId: number,
  r: RegistroCalistenia,
): Promise<number> {
  const rs = await db.execute({
    sql: `INSERT INTO calistenia_sets
            (user_id, data, exercise_id, reps, segundos, peso_extra_kg, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      userId, r.data, r.exercise_id, r.reps, r.segundos, r.peso_extra_kg,
      new Date().toISOString(),
    ],
  });
  return Number(rs.lastInsertRowid);
}

export async function apagarSerie(db: Client, userId: number, id: number): Promise<void> {
  await db.execute({
    sql: "DELETE FROM calistenia_sets WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
}

export async function seriesPorRange(
  db: Client,
  userId: number,
  inicio: string,
  fim: string,
): Promise<SerieAvulsa[]> {
  const rs = await db.execute({
    sql: `${SELECT_SERIE}
          WHERE c.user_id = ? AND c.data BETWEEN ? AND ?
          ORDER BY c.data, c.created_at`,
    args: [userId, inicio, fim],
  });
  return rs.rows.map(mapSerie);
}

export async function seriesDoDia(
  db: Client,
  userId: number,
  data: string,
): Promise<SerieAvulsa[]> {
  return seriesPorRange(db, userId, data, data);
}

/** Os de peso corporal do catálogo, mais os que o próprio usuário cadastrou. */
export async function exerciciosDeCalistenia(
  db: Client,
  userId: number,
): Promise<ExercicioDeCalistenia[]> {
  const rs = await db.execute({
    sql: `SELECT e.id, e.nome, e.aliases, e.source, g.nome AS grupo_nome,
                 e.medida, e.fracao_corporal, e.met
          FROM exercises e
          LEFT JOIN muscle_groups g ON g.id = e.grupo_id
          WHERE e.equipamento = 'peso_corporal'
            AND (e.user_id IS NULL OR e.user_id = ?)
          ORDER BY e.nome`,
    args: [userId],
  });
  return rs.rows.map((r) => ({
    id: r.id as number,
    nome: r.nome as string,
    aliases: (r.aliases as string | null) ?? null,
    grupo_nome: (r.grupo_nome as string | null) ?? null,
    source: r.source as ExerciseSource,
    medida: medidaDaColuna(r.medida),
    fracao_corporal: (r.fracao_corporal as number | null) ?? null,
    met: (r.met as number | null) ?? null,
  }));
}

/**
 * Os exercícios que viraram hábito, do mais frequente para o menos.
 *
 * São os chips do card: o que você registra sempre precisa estar a um toque, e
 * `ultima_qtd` é o número com que o stepper abre — quem faz 20 flexões toda
 * vez não deve ter que digitar 20 toda vez.
 */
export async function usadosRecentemente(
  db: Client,
  userId: number,
  desde: string,
  limite: number,
): Promise<UsoRecente[]> {
  const rs = await db.execute({
    sql: `SELECT c.exercise_id, e.nome, e.medida,
                 COUNT(*) AS vezes,
                 (SELECT COALESCE(u.reps, u.segundos) FROM calistenia_sets u
                  WHERE u.user_id = c.user_id AND u.exercise_id = c.exercise_id
                  ORDER BY u.data DESC, u.created_at DESC, u.id DESC LIMIT 1) AS ultima_qtd
          FROM calistenia_sets c
          JOIN exercises e ON e.id = c.exercise_id
          WHERE c.user_id = ? AND c.data >= ?
          GROUP BY c.exercise_id
          ORDER BY vezes DESC, e.nome
          LIMIT ?`,
    args: [userId, desde, limite],
  });
  return rs.rows.map((r) => ({
    exercise_id: r.exercise_id as number,
    nome: r.nome as string,
    medida: medidaDaColuna(r.medida),
    ultima_qtd: Number(r.ultima_qtd ?? 0),
    vezes: Number(r.vezes),
  }));
}

export async function listarMetas(db: Client, userId: number): Promise<MetaCalistenia[]> {
  const rs = await db.execute({
    sql: `SELECT m.exercise_id, e.nome, e.medida, m.alvo_dia
          FROM calistenia_metas m
          JOIN exercises e ON e.id = m.exercise_id
          WHERE m.user_id = ?
          ORDER BY e.nome`,
    args: [userId],
  });
  return rs.rows.map((r) => ({
    exercise_id: r.exercise_id as number,
    nome: r.nome as string,
    medida: medidaDaColuna(r.medida),
    alvo_dia: r.alvo_dia as number,
  }));
}

/** Uma meta por exercício: salvar de novo é ajustar o alvo, não criar outra. */
export async function salvarMeta(
  db: Client,
  userId: number,
  exerciseId: number,
  alvoDia: number,
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO calistenia_metas (user_id, exercise_id, alvo_dia)
          VALUES (?, ?, ?)
          ON CONFLICT (user_id, exercise_id) DO UPDATE SET alvo_dia = excluded.alvo_dia`,
    args: [userId, exerciseId, alvoDia],
  });
}

export async function apagarMeta(
  db: Client,
  userId: number,
  exerciseId: number,
): Promise<void> {
  await db.execute({
    sql: "DELETE FROM calistenia_metas WHERE user_id = ? AND exercise_id = ?",
    args: [userId, exerciseId],
  });
}
