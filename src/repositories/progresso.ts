import type { Client, Row } from "@libsql/client";

/**
 * "O que eu já fiz" — as consultas por trás de `/treino/progresso`.
 *
 * Separado de `sessao.ts` de propósito: lá vive a sessão de hoje, aqui vive a
 * leitura do passado. Os dois leem `workout_sets`, mas com perguntas opostas —
 * uma escreve, a outra só olha.
 */

export interface SessaoResumida {
  id: number;
  data: string;
  nome: string | null;
  concluida: boolean;
  /** Dia da rotina a que a sessão pertenceu, derivado do plano. */
  day_id: number | null;
  /** Séries efetivas — aquecimento fora. */
  series: number;
  /** Séries de aquecimento, para distinguir "só aquecimento" de "vazia". */
  aquecimento: number;
  volume_kg: number;
  /** Atividades de cardio registradas dentro da sessão. */
  cardio: number;
  kcal_cardio: number;
}

/**
 * As sessões passadas com o resumo que o histórico mostra.
 *
 * `aquecimento` existe para a tela conseguir dizer "só aquecimento" em vez de
 * não dizer nada — uma sessão em que só o aquecimento foi registrado aparecia
 * como nome e data, sem explicação.
 */
export async function sessoesComResumo(
  db: Client,
  userId: number,
  limite = 50,
): Promise<SessaoResumida[]> {
  const rs = await db.execute({
    sql: `
      SELECT s.id, s.data, s.nome, s.concluida_em,
             (SELECT re.day_id
                FROM session_plan_sets p
                JOIN routine_exercises re ON re.id = p.routine_exercise_id
               WHERE p.session_id = s.id AND p.user_id = s.user_id
               LIMIT 1) AS day_id,
             COALESCE(SUM(CASE WHEN ws.tipo <> 'aquecimento' THEN 1 ELSE 0 END), 0) AS series,
             COALESCE(SUM(CASE WHEN ws.tipo  = 'aquecimento' THEN 1 ELSE 0 END), 0) AS aquecimento,
             COALESCE(SUM(CASE WHEN ws.tipo <> 'aquecimento'
                               THEN ws.peso_kg * ws.reps ELSE 0 END), 0) AS volume_kg
      FROM workout_sessions s
      LEFT JOIN workout_sets ws ON ws.session_id = s.id AND ws.user_id = s.user_id
      WHERE s.user_id = ?
      GROUP BY s.id
      ORDER BY s.data DESC, s.created_at DESC
      LIMIT ?`,
    args: [userId, limite],
  });
  if (rs.rows.length === 0) return [];

  // O cardio da sessão sai de activity_sessions pelo elo do plano — uma
  // subconsulta na query acima multiplicaria as linhas do JOIN de séries.
  const ids = rs.rows.map((r) => r.id as number);
  const marcadores = ids.map(() => "?").join(", ");
  const rsCardio = await db.execute({
    sql: `SELECT p.session_id, COUNT(*) AS n, COALESCE(SUM(a.kcal), 0) AS kcal
          FROM session_plan_sets p
          JOIN activity_sessions a ON a.id = p.activity_id
          WHERE p.user_id = ? AND p.session_id IN (${marcadores})
          GROUP BY p.session_id`,
    args: [userId, ...ids],
  });
  const porSessao = new Map(
    rsCardio.rows.map((r) => [
      r.session_id as number,
      { n: Number(r.n), kcal: Number(r.kcal) },
    ]),
  );

  return rs.rows.map((r) => {
    const c = porSessao.get(r.id as number);
    return {
      id: r.id as number,
      data: r.data as string,
      nome: (r.nome as string | null) ?? null,
      concluida: (r.concluida_em as string | null) != null,
      day_id: (r.day_id as number | null) ?? null,
      series: Number(r.series),
      aquecimento: Number(r.aquecimento),
      volume_kg: Number(r.volume_kg),
      cardio: c?.n ?? 0,
      kcal_cardio: c?.kcal ?? 0,
    };
  });
}

export interface ExercicioComHistorico {
  exercise_id: number;
  nome: string;
  grupo: string | null;
  /** Data da última sessão efetiva deste exercício. */
  ultima: string;
  sessoes: number;
  /** Maior carga já usada em série efetiva. */
  melhor_peso_kg: number;
  /** Melhor 1RM estimado (Epley) entre todas as séries efetivas. */
  melhor_e1rm: number;
}

function mapExercicioHist(r: Row): ExercicioComHistorico {
  return {
    exercise_id: r.exercise_id as number,
    nome: (r.nome as string | null) ?? "?",
    grupo: (r.grupo as string | null) ?? null,
    ultima: r.ultima as string,
    sessoes: Number(r.sessoes),
    melhor_peso_kg: Number(r.melhor_peso_kg),
    melhor_e1rm: Math.round(Number(r.melhor_e1rm)),
  };
}

/**
 * Os exercícios que já foram treinados, do mais recente para o mais antigo.
 *
 * É esta lista que substitui o `<select>` da progressão antiga: ela **é** o
 * conteúdo da tela, então a tela nunca começa vazia esperando uma escolha.
 *
 * O 1RM estimado é Epley — `peso × (1 + reps/30)` — calculado em SQL para não
 * trazer todas as séries de todos os exercícios para a memória só para achar o
 * máximo. A mesma fórmula está em `domain/treino.e1RM`, e as duas são
 * comparadas por teste.
 */
export async function exerciciosComHistorico(
  db: Client,
  userId: number,
): Promise<ExercicioComHistorico[]> {
  const rs = await db.execute({
    sql: `
      SELECT ws.exercise_id AS exercise_id,
             e.nome AS nome,
             mg.nome AS grupo,
             MAX(s.data) AS ultima,
             COUNT(DISTINCT s.id) AS sessoes,
             MAX(ws.peso_kg) AS melhor_peso_kg,
             MAX(ws.peso_kg * (1.0 + ws.reps / 30.0)) AS melhor_e1rm
      FROM workout_sets ws
      JOIN workout_sessions s ON s.id = ws.session_id
      LEFT JOIN exercises e      ON e.id  = ws.exercise_id
      LEFT JOIN muscle_groups mg ON mg.id = e.grupo_id
      WHERE ws.user_id = ? AND ws.tipo <> 'aquecimento'
      GROUP BY ws.exercise_id
      ORDER BY ultima DESC, e.nome`,
    args: [userId],
  });
  return rs.rows.map(mapExercicioHist);
}

/**
 * Séries efetivas por grupo muscular no período.
 *
 * Séries, não volume em quilos: comparar o volume do agachamento com o da
 * rosca direta em quilos diz que você negligencia o bíceps mesmo treinando
 * bíceps toda semana. Contagem de séries é a métrica que a pergunta pede.
 */
export async function seriesPorGrupo(
  db: Client,
  userId: number,
  inicio: string,
  fim: string,
): Promise<{ grupo: string; series: number }[]> {
  const rs = await db.execute({
    sql: `
      SELECT COALESCE(mg.nome, 'Sem grupo') AS grupo, COUNT(*) AS series
      FROM workout_sets ws
      JOIN workout_sessions s   ON s.id  = ws.session_id
      LEFT JOIN exercises e      ON e.id  = ws.exercise_id
      LEFT JOIN muscle_groups mg ON mg.id = e.grupo_id
      WHERE ws.user_id = ? AND ws.tipo <> 'aquecimento'
        AND s.data BETWEEN ? AND ?
      GROUP BY grupo
      ORDER BY series DESC, grupo`,
    args: [userId, inicio, fim],
  });
  return rs.rows.map((r) => ({ grupo: r.grupo as string, series: Number(r.series) }));
}
