import type { Client, Row } from "@libsql/client";
import { planejar, type Prescricao, type SeriePlanejada } from "../domain/prescricao";
import type { TipoSerie } from "../domain/types";
import { listExercicios, type ExercicioRotina } from "./rotina";
import { createSession, historicoExercicio } from "./workouts";

/**
 * Os padrões de um exercício escolhido no meio do treino.
 *
 * Ele não está na rotina, então não há prescrição guardada — mas há histórico,
 * e é dele que a carga sai. Só a faixa e o incremento são chute, e são o mesmo
 * chute que a rotina usa quando o exercício é novo.
 */
export const AVULSO = {
  series: 3,
  reps_min: 8,
  reps_max: 12,
  incremento_kg: 2.5,
  descanso_s: 90,
  duracao_min: 30,
  met_padrao: 6,
} as const;

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

/**
 * Cria a sessão e escreve o plano dela. Nasce RASCUNHO.
 *
 * Chamava-se `iniciarSessao`, e criar era o mesmo evento que começar. Separar
 * os dois é o que torna possível montar um treino avulso com calma antes de o
 * relógio correr — e o que impede um treino recém-criado de aparecer no
 * histórico como se já tivesse acontecido.
 */
export async function criarSessao(
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

/**
 * Rascunho → em andamento. Aqui o relógio começa a correr.
 *
 * Idempotente pela mesma razão que finalizar é: reiniciar não pode empurrar o
 * começo para frente e encolher a duração que já passou. O `user_id` no
 * `WHERE` é o que impede iniciar a sessão de outra pessoa.
 */
export async function iniciarSessao(
  db: Client,
  userId: number,
  sessionId: number,
): Promise<void> {
  await db.execute({
    sql: `UPDATE workout_sessions SET iniciado_em = ?
          WHERE id = ? AND user_id = ? AND iniciado_em IS NULL`,
    args: [new Date().toISOString(), sessionId, userId],
  });
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

  // Registrar é começar. Se uma série foi marcada como feita, o treino está
  // acontecendo — exigir "Iniciar" antes transformaria um passo de
  // conveniência numa armadilha: o treino correria sem aparecer na faixa e sem
  // duração nenhuma. Fica aqui, e não na tela, para valer venha o registro de
  // onde vier. `iniciarSessao` é idempotente, então não custa nada repetido.
  await iniciarSessao(db, userId, linha.session_id as number);
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
    sql: `SELECT p.session_id, p.activity_id, s.data AS data, e.nome AS nome
          FROM session_plan_sets p
          JOIN workout_sessions s ON s.id = p.session_id
          LEFT JOIN exercises e   ON e.id = p.exercise_id
          WHERE p.id = ? AND p.user_id = ?`,
    args: [planId, userId],
  });
  if (!rs.rows.length) return;
  const linha = rs.rows[0];

  // Registrar um cardio também começa o treino — ver `registrarSerie`.
  await iniciarSessao(db, userId, linha.session_id as number);

  // Já registrada: corrige a atividade existente em vez de criar uma segunda.
  // Sem isto, ajustar "30 min" para "22 min" somava 30 + 22 no balanço
  // energético do dia — o número que a correção existia para consertar.
  const jaFeita = (linha.activity_id as number | null) ?? null;
  if (jaFeita !== null) {
    await db.execute({
      sql: "UPDATE activity_sessions SET duracao_min = ?, kcal = ? WHERE id = ? AND user_id = ?",
      args: [v.duracao_min, v.kcal, jaFeita, userId],
    });
    return;
  }

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

/**
 * Um exercício escolhido no meio do treino, já com a carga de hoje.
 *
 * A mesma regra do caminho da rotina (`montarPlanoDoDia`): cruza o histórico
 * do exercício com a prescrição. A tela montava esse item sozinha e passava
 * histórico VAZIO, então todo exercício avulso nascia a zero quilo mesmo com
 * dez sessões dele no banco — e obrigava a redigitar a carga que o app já
 * sabia. Escolher "Bicicleta" continua dando cardio, não três séries de
 * bicicleta a zero quilo.
 */
export async function montarItemAvulso(
  db: Client,
  userId: number,
  exerciseId: number,
  data: string,
): Promise<ItemPlanejado> {
  const rs = await db.execute({
    sql: "SELECT nome, equipamento, met FROM exercises WHERE id = ?",
    args: [exerciseId],
  });
  const r = rs.rows[0];
  const nome = (r?.nome as string | null) ?? "Exercício";

  if ((r?.equipamento as string | null) === "cardio") {
    return {
      routine_exercise_id: null,
      exercise_id: exerciseId,
      nome,
      descanso_s: null,
      series: planejar(
        {
          tipo: "cardio",
          duracao_min: AVULSO.duracao_min,
          met: (r?.met as number | null) ?? AVULSO.met_padrao,
        },
        [],
      ),
    };
  }

  const anteriores = await historicoExercicio(db, userId, exerciseId, data);
  return {
    routine_exercise_id: null,
    exercise_id: exerciseId,
    nome,
    descanso_s: AVULSO.descanso_s,
    series: planejar(
      {
        tipo: "dupla",
        series: AVULSO.series,
        reps_min: AVULSO.reps_min,
        reps_max: AVULSO.reps_max,
        peso_inicial_kg: 0,
        incremento_kg: AVULSO.incremento_kg,
      },
      anteriores,
    ),
  };
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

/**
 * Marca a sessão como encerrada. Idempotente: reencerrar não muda a hora.
 *
 * Preenche `iniciado_em` junto quando ele está nulo. O botão "Finalizar" só
 * aparece em sessão já iniciada, mas o repositório não deve ser CAPAZ de
 * produzir um "concluído sem começo" — e a lista de treinos abertos finaliza
 * direto, sem passar pela tela da academia.
 */
export async function finalizarSessao(
  db: Client,
  userId: number,
  sessionId: number,
): Promise<void> {
  const agora = new Date().toISOString();
  await db.execute({
    sql: `UPDATE workout_sessions
             SET concluida_em = ?, iniciado_em = COALESCE(iniciado_em, ?)
           WHERE id = ? AND user_id = ? AND concluida_em IS NULL`,
    args: [agora, agora, sessionId, userId],
  });
}

/**
 * As sessões que ainda não foram encerradas — rascunhos e em andamento.
 *
 * Três decisões que este `SELECT` já errou:
 *
 * **`LEFT JOIN`, não `JOIN`.** Uma sessão sem nenhuma linha de plano
 * simplesmente não aparecia — e é exatamente assim que um treino avulso
 * nasce: a sessão é criada vazia e os exercícios entram depois. No intervalo
 * entre as duas coisas o treino era invisível ao hub, então sair da tela o
 * perdia para sempre e a tentativa seguinte criava mais uma sessão órfã.
 *
 * **Todas, não `LIMIT 1`.** Treinar duas vezes no mesmo dia é uma coisa que
 * acontece, e com uma sessão aberta o hub só sabia oferecer aquela.
 *
 * **Sem filtro de data.** Era `s.data = ?`, com o hub sempre passando hoje: um
 * treino começado às 22h e não finalizado deixava de existir para o app na
 * virada da meia-noite — irretomável, infinalizável, e fantasma no histórico
 * para sempre. Um treino aberto é aberto no dia em que você voltar.
 *
 * A `id` desempata a ordenação: duas sessões criadas no mesmo milissegundo têm
 * o mesmo `created_at`, e sem o desempate a ordem entre elas era a que o SQLite
 * resolvesse dar. A id é monotônica, então decide quem é a mais recente quando
 * o relógio não decide.
 */
export interface SessaoAberta {
  session_id: number;
  nome: string | null;
  data: string;
  iniciado_em: string | null;
  total: number;
  feitas: number;
}

export async function sessoesAbertas(db: Client, userId: number): Promise<SessaoAberta[]> {
  const rs = await db.execute({
    sql: `SELECT s.id AS session_id, s.nome AS nome, s.data AS data,
                 s.iniciado_em AS iniciado_em,
                 COUNT(p.id) AS total,
                 SUM(CASE WHEN p.set_id IS NOT NULL OR p.activity_id IS NOT NULL THEN 1 ELSE 0 END) AS feitas
          FROM workout_sessions s
          LEFT JOIN session_plan_sets p ON p.session_id = s.id
          WHERE s.user_id = ? AND s.concluida_em IS NULL
          GROUP BY s.id
          ORDER BY s.created_at DESC, s.id DESC`,
    args: [userId],
  });
  return rs.rows.map((r) => ({
    session_id: r.session_id as number,
    nome: (r.nome as string | null) ?? null,
    data: r.data as string,
    iniciado_em: (r.iniciado_em as string | null) ?? null,
    total: Number(r.total),
    feitas: Number(r.feitas ?? 0),
  }));
}

/**
 * O treino que está ACONTECENDO — o mais recente em andamento.
 *
 * A faixa e o dashboard perguntam isto, e a diferença para `sessoesAbertas` é
 * o rascunho: um treino montado e não iniciado existe, mas não está
 * acontecendo, e anunciá-lo como ativo faria os dois mentirem.
 */
export async function sessaoAtiva(db: Client, userId: number): Promise<SessaoAberta | null> {
  const abertas = await sessoesAbertas(db, userId);
  return abertas.find((s) => s.iniciado_em !== null) ?? null;
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

/* ══════════════════════════════════════════════════════════════════
   EDITAR A SESSÃO

   Até aqui a sessão só crescia. Remover, trocar e reordenar mexem no plano
   (`session_plan_sets`) e têm que arrastar o realizado junto — `workout_sets`
   e `activity_sessions` — senão sobra registro de um exercício que não está
   mais na sessão, contando volume e caloria de um treino que não houve.
   ══════════════════════════════════════════════════════════════════ */

type LinhaCrua = {
  id: number;
  exercise_id: number;
  ordem: number;
  serie_ordem: number;
  set_id: number | null;
};

async function linhasDoPlano(
  db: Client,
  userId: number,
  sessionId: number,
): Promise<LinhaCrua[]> {
  const rs = await db.execute({
    sql: `SELECT id, exercise_id, ordem, serie_ordem, set_id
          FROM session_plan_sets WHERE user_id = ? AND session_id = ?
          ORDER BY ordem`,
    args: [userId, sessionId],
  });
  return rs.rows.map((r) => ({
    id: r.id as number,
    exercise_id: r.exercise_id as number,
    ordem: r.ordem as number,
    serie_ordem: r.serie_ordem as number,
    set_id: (r.set_id as number | null) ?? null,
  }));
}

/**
 * Devolve `ordem` contígua na sessão e `serie_ordem` contígua dentro do bloco.
 *
 * Os blocos saem na ordem em que aparecem hoje, e linhas do mesmo exercício
 * espalhadas viram um bloco só — é o que faz "trocar por um exercício que já
 * está na sessão" dar um bloco de seis séries em vez de dois de três.
 *
 * `workout_sets.ordem` acompanha `serie_ordem`: as duas descrevem a mesma
 * posição, e `ultimaVezExercicio` ordena o histórico por ela.
 */
async function renumerarPlano(db: Client, userId: number, sessionId: number): Promise<void> {
  const linhas = await linhasDoPlano(db, userId, sessionId);
  if (linhas.length === 0) return;

  const blocos = new Map<number, LinhaCrua[]>();
  for (const l of linhas) {
    const atual = blocos.get(l.exercise_id);
    if (atual) atual.push(l);
    else blocos.set(l.exercise_id, [l]);
  }

  const comandos: { sql: string; args: (number | string | null)[] }[] = [];
  let ordem = 1;
  for (const doBloco of blocos.values()) {
    doBloco.forEach((l, i) => {
      const serieOrdem = i + 1;
      if (l.ordem !== ordem || l.serie_ordem !== serieOrdem) {
        comandos.push({
          sql: "UPDATE session_plan_sets SET ordem = ?, serie_ordem = ? WHERE id = ? AND user_id = ?",
          args: [ordem, serieOrdem, l.id, userId],
        });
        if (l.set_id !== null) {
          comandos.push({
            sql: "UPDATE workout_sets SET ordem = ? WHERE id = ? AND user_id = ?",
            args: [serieOrdem, l.set_id, userId],
          });
        }
      }
      ordem += 1;
    });
  }
  if (comandos.length > 0) await db.batch(comandos, "write");
}

/** As séries e atividades que estas linhas de plano registraram. */
async function apagarRealizado(
  db: Client,
  userId: number,
  sessionId: number,
  filtro: { sql: string; args: (number | string | null)[] },
): Promise<void> {
  const rs = await db.execute({
    sql: `SELECT set_id, activity_id FROM session_plan_sets
          WHERE user_id = ? AND session_id = ? AND ${filtro.sql}`,
    args: [userId, sessionId, ...filtro.args],
  });
  const comandos: { sql: string; args: (number | string | null)[] }[] = [];
  for (const r of rs.rows) {
    const setId = (r.set_id as number | null) ?? null;
    const activityId = (r.activity_id as number | null) ?? null;
    if (setId !== null) {
      comandos.push({
        sql: "DELETE FROM workout_sets WHERE id = ? AND user_id = ?",
        args: [setId, userId],
      });
    }
    if (activityId !== null) {
      comandos.push({
        sql: "DELETE FROM activity_sessions WHERE id = ? AND user_id = ?",
        args: [activityId, userId],
      });
    }
  }
  if (comandos.length > 0) await db.batch(comandos, "write");
}

export async function removerExercicioDaSessao(
  db: Client,
  userId: number,
  sessionId: number,
  exerciseId: number,
): Promise<void> {
  await apagarRealizado(db, userId, sessionId, { sql: "exercise_id = ?", args: [exerciseId] });
  await db.execute({
    sql: "DELETE FROM session_plan_sets WHERE user_id = ? AND session_id = ? AND exercise_id = ?",
    args: [userId, sessionId, exerciseId],
  });
  await renumerarPlano(db, userId, sessionId);
}

/**
 * Troca o exercício de um bloco, levando o que já foi registrado junto.
 *
 * O vínculo com a rotina morre na troca: ele descreve a prescrição do
 * exercício ANTIGO, e mantê-lo faria a progressão do exercício da rotina
 * contar séries de um exercício que não é ele.
 */
export async function trocarExercicioDaSessao(
  db: Client,
  userId: number,
  sessionId: number,
  de: number,
  para: number,
): Promise<void> {
  if (de === para) return;
  await db.batch(
    [
      {
        sql: `UPDATE workout_sets SET exercise_id = ?
              WHERE user_id = ? AND session_id = ? AND exercise_id = ?`,
        args: [para, userId, sessionId, de],
      },
      {
        sql: `UPDATE session_plan_sets SET exercise_id = ?, routine_exercise_id = NULL
              WHERE user_id = ? AND session_id = ? AND exercise_id = ?`,
        args: [para, userId, sessionId, de],
      },
    ],
    "write",
  );
  await renumerarPlano(db, userId, sessionId);
}

/**
 * Põe os blocos na ordem pedida. Exercício fora da lista vai para o fim, em
 * vez de sumir — a tela manda a ordem que conhece, e uma lista incompleta não
 * pode apagar treino.
 */
export async function reordenarExerciciosDaSessao(
  db: Client,
  userId: number,
  sessionId: number,
  exerciseIds: number[],
): Promise<void> {
  const linhas = await linhasDoPlano(db, userId, sessionId);
  if (linhas.length === 0) return;

  const rank = new Map<number, number>();
  exerciseIds.forEach((id, i) => rank.set(id, i));
  let proximo = exerciseIds.length;
  for (const l of linhas) if (!rank.has(l.exercise_id)) rank.set(l.exercise_id, proximo++);

  const ordenadas = [...linhas].sort(
    (a, b) =>
      rank.get(a.exercise_id)! - rank.get(b.exercise_id)! || a.serie_ordem - b.serie_ordem,
  );

  await db.batch(
    ordenadas.map((l, i) => ({
      sql: "UPDATE session_plan_sets SET ordem = ? WHERE id = ? AND user_id = ?",
      args: [i + 1, l.id, userId] as (number | string | null)[],
    })),
    "write",
  );
  await renumerarPlano(db, userId, sessionId);
}

/**
 * Uma série a mais no fim do bloco, com o peso e as reps da última.
 *
 * Copiar a última é o que o usuário faria: a série extra é sempre "mais uma
 * dessa". Cardio não entra — ali a medida é o tempo, e ajustar minutos é o
 * que a folha de cardio já faz.
 */
export async function adicionarSerie(
  db: Client,
  userId: number,
  sessionId: number,
  exerciseId: number,
): Promise<void> {
  const rs = await db.execute({
    sql: `SELECT * FROM session_plan_sets
          WHERE user_id = ? AND session_id = ? AND exercise_id = ?
          ORDER BY serie_ordem`,
    args: [userId, sessionId, exerciseId],
  });
  if (rs.rows.length === 0) return;

  const trabalho = rs.rows.filter((r) => r.tipo !== "aquecimento");
  const modelo = trabalho.at(-1) ?? rs.rows.at(-1)!;
  if ((modelo.duracao_min as number | null) !== null) return;

  const ordem = Math.max(...rs.rows.map((r) => r.ordem as number));
  const serieOrdem = Math.max(...rs.rows.map((r) => r.serie_ordem as number)) + 1;

  await db.batch(
    [
      {
        sql: `UPDATE session_plan_sets SET ordem = ordem + 1
              WHERE user_id = ? AND session_id = ? AND ordem > ?`,
        args: [userId, sessionId, ordem] as (number | string | null)[],
      },
      {
        sql: `INSERT INTO session_plan_sets
                (user_id, session_id, routine_exercise_id, exercise_id, ordem, serie_ordem,
                 peso_kg, reps_alvo, reps_min, tipo, amrap, pct, descanso_s, duracao_min)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, NULL)`,
        args: [
          userId, sessionId,
          (modelo.routine_exercise_id as number | null) ?? null,
          exerciseId, ordem + 1, serieOrdem,
          modelo.peso_kg as number,
          modelo.reps_alvo as number,
          (modelo.reps_min as number | null) ?? null,
          modelo.tipo as string,
          (modelo.descanso_s as number | null) ?? null,
        ] as (number | string | null)[],
      },
    ],
    "write",
  );
  await renumerarPlano(db, userId, sessionId);
}

/** Uma série a menos. Leva junto o que ela tiver registrado. */
export async function removerSerie(db: Client, userId: number, planId: number): Promise<void> {
  const rs = await db.execute({
    sql: "SELECT session_id FROM session_plan_sets WHERE id = ? AND user_id = ?",
    args: [planId, userId],
  });
  if (!rs.rows.length) return;
  const sessionId = rs.rows[0].session_id as number;

  await apagarRealizado(db, userId, sessionId, { sql: "id = ?", args: [planId] });
  await db.execute({
    sql: "DELETE FROM session_plan_sets WHERE id = ? AND user_id = ?",
    args: [planId, userId],
  });
  await renumerarPlano(db, userId, sessionId);
}
