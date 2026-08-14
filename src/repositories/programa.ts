import type { Client, Row } from "@libsql/client";
import {
  ciclosConcluidos,
  proximaSessao,
  tmVigente,
  type Parte,
  type Semana,
  type SessaoConcluida,
} from "../domain/531";

export interface Programa {
  id: number;
  nome: string;
  tipo: string;
  incremento_kg: number;
  ativo: boolean;
  created_at: string;
}

export interface Levantamento {
  id: number;
  program_id: number;
  exercise_id: number;
  /** Nome do exercício, vindo do catálogo. */
  nome: string;
  /** Training Max INICIAL, como configurado. */
  tm_inicial_kg: number;
  /** Training Max de hoje: o inicial mais os ciclos já fechados. */
  tm_kg: number;
  parte: Parte;
  ordem: number;
}

export interface SessaoDoPrograma {
  id: number;
  lift_id: number;
  ciclo: number;
  semana: number;
  tm_kg: number;
  data: string;
  session_id: number | null;
}

function mapPrograma(r: Row): Programa {
  return {
    id: r.id as number,
    nome: r.nome as string,
    tipo: r.tipo as string,
    incremento_kg: r.incremento_kg as number,
    ativo: Boolean(r.ativo),
    created_at: r.created_at as string,
  };
}

/* ── leitura ────────────────────────────────────────────────────── */

export async function getProgramaAtivo(db: Client, userId: number): Promise<Programa | null> {
  const rs = await db.execute({
    sql: "SELECT * FROM strength_programs WHERE user_id=? AND ativo=1 ORDER BY id DESC LIMIT 1",
    args: [userId],
  });
  return rs.rows[0] ? mapPrograma(rs.rows[0]) : null;
}

export async function listSessoesDoPrograma(
  db: Client,
  userId: number,
  programId: number,
): Promise<SessaoDoPrograma[]> {
  const rs = await db.execute({
    sql: `SELECT * FROM program_sessions
          WHERE user_id=? AND program_id=?
          ORDER BY ciclo, semana, id`,
    args: [userId, programId],
  });
  return rs.rows.map((r) => ({
    id: r.id as number,
    lift_id: r.lift_id as number,
    ciclo: r.ciclo as number,
    semana: r.semana as number,
    tm_kg: r.tm_kg as number,
    data: r.data as string,
    session_id: (r.session_id as number | null) ?? null,
  }));
}

/**
 * Levantamentos do programa com o Training Max JÁ ATUALIZADO pelos ciclos
 * fechados.
 *
 * O TM guardado é o inicial; o vigente é derivado. Guardar o vigente exigiria
 * um UPDATE a cada ciclo fechado, e um ciclo apagado depois deixaria o número
 * alto para sempre.
 */
export async function listLevantamentos(
  db: Client,
  userId: number,
  programa: Programa,
): Promise<Levantamento[]> {
  const rs = await db.execute({
    sql: `SELECT l.*, e.nome AS exercicio_nome
          FROM program_lifts l
          JOIN exercises e ON e.id = l.exercise_id
          WHERE l.program_id = ?
          ORDER BY l.ordem`,
    args: [programa.id],
  });

  const feitas = await listSessoesDoPrograma(db, userId, programa.id);
  const ids = rs.rows.map((r) => r.id as number);
  const fechados = ciclosConcluidos(ids, feitas);

  return rs.rows.map((r) => {
    const tmInicial = r.tm_kg as number;
    const parte = r.parte as Parte;
    return {
      id: r.id as number,
      program_id: r.program_id as number,
      exercise_id: r.exercise_id as number,
      nome: r.exercicio_nome as string,
      tm_inicial_kg: tmInicial,
      tm_kg: tmVigente(tmInicial, parte, fechados, programa.incremento_kg),
      parte,
      ordem: r.ordem as number,
    };
  });
}

export interface PosicaoAtual {
  ciclo: number;
  semana: Semana;
  levantamento: Levantamento | null;
  ciclosFechados: number;
}

/** Onde o programa está agora — tudo derivado das sessões já concluídas. */
export async function posicaoAtual(
  db: Client,
  userId: number,
  programa: Programa,
): Promise<PosicaoAtual> {
  const lifts = await listLevantamentos(db, userId, programa);
  const feitas: SessaoConcluida[] = await listSessoesDoPrograma(db, userId, programa.id);
  const ids = lifts.map((l) => l.id);
  const p = proximaSessao(ids, feitas);

  return {
    ciclo: p.ciclo,
    semana: p.semana,
    levantamento: lifts.find((l) => l.id === p.lift_id) ?? null,
    ciclosFechados: ciclosConcluidos(ids, feitas),
  };
}

/** Marcas de AMRAP de um levantamento, para saber o recorde a bater. */
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

/* ── escrita ────────────────────────────────────────────────────── */

export interface LevantamentoInput {
  exercise_id: number;
  tm_kg: number;
  parte: Parte;
}

/**
 * Cria o programa e desativa o anterior.
 *
 * O anterior não é apagado: `program_sessions` aponta para os levantamentos
 * dele, e apagar reescreveria o histórico de quem trocou de programa.
 */
export async function criarPrograma(
  db: Client,
  userId: number,
  entrada: { nome: string; incremento_kg: number; levantamentos: LevantamentoInput[] },
): Promise<Programa> {
  const created_at = new Date().toISOString();

  await db.execute({
    sql: "UPDATE strength_programs SET ativo=0 WHERE user_id=? AND ativo=1",
    args: [userId],
  });

  const rs = await db.execute({
    sql: `INSERT INTO strength_programs (user_id, nome, tipo, incremento_kg, ativo, created_at)
          VALUES (?, ?, '531', ?, 1, ?)`,
    args: [userId, entrada.nome, entrada.incremento_kg, created_at],
  });
  const id = Number(rs.lastInsertRowid);

  if (entrada.levantamentos.length > 0) {
    await db.batch(
      entrada.levantamentos.map((l, i) => ({
        sql: `INSERT INTO program_lifts (program_id, exercise_id, tm_kg, parte, ordem)
              VALUES (?, ?, ?, ?, ?)`,
        args: [id, l.exercise_id, l.tm_kg, l.parte, i],
      })),
      "write",
    );
  }

  return {
    id,
    nome: entrada.nome,
    tipo: "531",
    incremento_kg: entrada.incremento_kg,
    ativo: true,
    created_at,
  };
}

/** Ajusta o Training Max inicial de um levantamento. */
export async function atualizarTM(
  db: Client,
  liftId: number,
  tm_kg: number,
): Promise<void> {
  await db.execute({
    sql: "UPDATE program_lifts SET tm_kg=? WHERE id=?",
    args: [tm_kg, liftId],
  });
}

export async function atualizarIncremento(
  db: Client,
  userId: number,
  programId: number,
  incremento_kg: number,
): Promise<void> {
  await db.execute({
    sql: "UPDATE strength_programs SET incremento_kg=? WHERE id=? AND user_id=?",
    args: [incremento_kg, programId, userId],
  });
}

export interface SerieRegistrada {
  exercise_id: number;
  ordem: number;
  reps: number;
  peso_kg: number;
  tipo: "aquecimento" | "valida";
  prescribed_pct: number | null;
  amrap: boolean;
}

/**
 * Grava a sessão do programa: cria a sessão de treino, as séries, e o registro
 * que faz o programa avançar.
 *
 * `UNIQUE (user_id, program_id, lift_id, ciclo, semana)` garante que refazer a
 * mesma posição atualize em vez de duplicar — repetir uma sessão não deve
 * empurrar o programa duas posições para a frente.
 */
export async function concluirSessao(
  db: Client,
  userId: number,
  entrada: {
    programId: number;
    liftId: number;
    ciclo: number;
    semana: number;
    tm_kg: number;
    data: string;
    nome: string;
    series: SerieRegistrada[];
  },
): Promise<{ sessionId: number }> {
  const created_at = new Date().toISOString();

  const rs = await db.execute({
    sql: "INSERT INTO workout_sessions (user_id, data, nome, created_at) VALUES (?, ?, ?, ?)",
    args: [userId, entrada.data, entrada.nome, created_at],
  });
  const sessionId = Number(rs.lastInsertRowid);

  if (entrada.series.length > 0) {
    await db.batch(
      entrada.series.map((s) => ({
        sql: `INSERT INTO workout_sets
                (user_id, session_id, exercise_id, ordem, reps, peso_kg, tipo,
                 rir, nota, prescribed_pct, amrap, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
        args: [
          userId,
          sessionId,
          s.exercise_id,
          s.ordem,
          s.reps,
          s.peso_kg,
          s.tipo,
          s.prescribed_pct,
          s.amrap ? 1 : 0,
          created_at,
        ],
      })),
      "write",
    );
  }

  await db.execute({
    sql: `INSERT INTO program_sessions
            (user_id, program_id, lift_id, ciclo, semana, tm_kg, data, session_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (user_id, program_id, lift_id, ciclo, semana)
          DO UPDATE SET tm_kg=excluded.tm_kg, data=excluded.data, session_id=excluded.session_id`,
    args: [
      userId,
      entrada.programId,
      entrada.liftId,
      entrada.ciclo,
      entrada.semana,
      entrada.tm_kg,
      entrada.data,
      sessionId,
      created_at,
    ],
  });

  return { sessionId };
}

/** Desfaz uma sessão do programa: o estado derivado volta sozinho. */
export async function desfazerSessao(
  db: Client,
  userId: number,
  programSessionId: number,
): Promise<void> {
  const rs = await db.execute({
    sql: "SELECT session_id FROM program_sessions WHERE id=? AND user_id=?",
    args: [programSessionId, userId],
  });
  const sessionId = rs.rows[0]?.session_id as number | null | undefined;

  await db.execute({
    sql: "DELETE FROM program_sessions WHERE id=? AND user_id=?",
    args: [programSessionId, userId],
  });

  if (sessionId != null) {
    await db.execute({
      sql: "DELETE FROM workout_sets WHERE session_id=? AND user_id=?",
      args: [sessionId, userId],
    });
    await db.execute({
      sql: "DELETE FROM workout_sessions WHERE id=? AND user_id=?",
      args: [sessionId, userId],
    });
  }
}
