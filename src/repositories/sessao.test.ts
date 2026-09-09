import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  adicionarAoPlano,
  adicionarSerie,
  desfazerSerie,
  getPlano,
  criarSessao,
  iniciarSessao,
  finalizarSessao,
  marcasAmrap,
  registrarCardio,
  ehCardio,
  montarPlanoDoDia,
  registrarSerie,
  removerExercicioDaSessao,
  removerSerie,
  reordenarExerciciosDaSessao,
  sessaoAtiva,
  sessoesAbertas,
  trocarExercicioDaSessao,
  type ItemPlanejado,
} from "./sessao";
import { addSet, createSession, getSession, listSetsBySession } from "./workouts";
import { adicionarExercicio, criarRotina, salvarDia } from "./rotina";
import { planejar } from "../domain/prescricao";
import { sessaoEmCurso } from "../../test/helpers/sessao";
import { listActivitySessionsByRange } from "./activities";
import { balancoEnergetico } from "../domain/analise-balanco";
import { kcalGastaPorDia } from "../domain/analise-atividade";
import { estimativaKcal } from "../domain/treino";

const USER = 1;
const OUTRO = 2;
let db: Client;

async function exercicio(nome: string): Promise<number> {
  const rs = await db.execute({
    sql: "INSERT INTO exercises (nome, source, created_at) VALUES (?, 'custom', ?)",
    args: [nome, new Date().toISOString()],
  });
  return Number(rs.lastInsertRowid);
}

function item(exercise_id: number, peso = 40, nome = "Exercício"): ItemPlanejado {
  return {
    routine_exercise_id: null,
    exercise_id,
    nome,
    descanso_s: 90,
    series: planejar(
      { tipo: "dupla", series: 3, reps_min: 8, reps_max: 12, peso_inicial_kg: peso, incremento_kg: 2.5 },
      [],
    ),
  };
}

beforeEach(async () => {
  db = await createTestDb();
});

describe("iniciarSessao", () => {
  it("materializa o plano com ordem global contínua e serie_ordem por exercício", async () => {
    const supino = await exercicio("Supino");
    const crucifixo = await exercicio("Crucifixo");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17",
      nome: "Peito",
      itens: [item(supino), item(crucifixo, 15)],
    });

    const plano = await getPlano(db, USER, sid);
    expect(plano).toHaveLength(6);
    expect(plano.map((p) => p.ordem)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(plano.map((p) => p.serie_ordem)).toEqual([1, 2, 3, 1, 2, 3]);
    expect(plano.map((p) => p.nome)).toEqual(
      ["Supino", "Supino", "Supino", "Crucifixo", "Crucifixo", "Crucifixo"],
    );
    expect(plano[0].peso_kg).toBe(40);
    expect(plano[3].peso_kg).toBe(15);
    expect(plano[0].reps_alvo).toBe(12);
    expect(plano[0].descanso_s).toBe(90);
  });

  // O ponto do desenho: enquanto nada foi confirmado, o registro está vazio.
  it("não escreve nada em workout_sets ao materializar", async () => {
    const supino = await exercicio("Supino");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    expect(await listSetsBySession(db, USER, sid)).toHaveLength(0);
  });

  it("o plano de um usuário não vaza para outro", async () => {
    const supino = await exercicio("Supino");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    expect(await getPlano(db, OUTRO, sid)).toHaveLength(0);
  });
});

describe("registrarSerie", () => {
  it("cria a série em workout_sets e liga o plano a ela", async () => {
    const supino = await exercicio("Supino");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    const plano = await getPlano(db, USER, sid);

    await registrarSerie(db, USER, plano[0].id, {
      reps: 12, peso_kg: 40, tipo: "valida", rir: 1, nota: null,
    });

    const sets = await listSetsBySession(db, USER, sid);
    expect(sets).toHaveLength(1);
    expect(sets[0].reps).toBe(12);
    expect(sets[0].peso_kg).toBe(40);
    expect(sets[0].rir).toBe(1);
    // workout_sets.ordem é a posição DENTRO do exercício.
    expect(sets[0].ordem).toBe(1);

    const depois = await getPlano(db, USER, sid);
    expect(depois[0].set_id).toBe(sets[0].id);
    expect(depois[0].reps_feitas).toBe(12);
    expect(depois[1].set_id).toBeNull();
  });

  it("registra o que foi feito, não o que foi planejado", async () => {
    const supino = await exercicio("Supino");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    const plano = await getPlano(db, USER, sid);

    await registrarSerie(db, USER, plano[0].id, {
      reps: 9, peso_kg: 37.5, tipo: "falha", rir: 0, nota: "ombro doeu",
    });

    const [set] = await listSetsBySession(db, USER, sid);
    expect(set.reps).toBe(9);
    expect(set.peso_kg).toBe(37.5);
    expect(set.tipo).toBe("falha");
    expect(set.nota).toBe("ombro doeu");

    const [linha] = await getPlano(db, USER, sid);
    expect(linha.peso_kg).toBe(40); // o prescrito não muda
    expect(linha.peso_feito_kg).toBe(37.5);
  });

  it("guarda percentual e AMRAP quando a série é de 5/3/1", async () => {
    const agacho = await exercicio("Agachamento");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17",
      nome: "Perna",
      itens: [{
        routine_exercise_id: null,
        exercise_id: agacho,
        nome: "Agachamento",
        descanso_s: 180,
        series: planejar({ tipo: "531", tm_kg: 100, parte: "inferior", incremento_kg: 2.5 }, []),
      }],
    });
    const plano = await getPlano(db, USER, sid);
    const amrap = plano.find((p) => p.amrap)!;
    expect(amrap.pct).toBe(85);

    await registrarSerie(db, USER, amrap.id, {
      reps: 8, peso_kg: 85, tipo: "valida", rir: null, nota: null,
    });
    expect(await marcasAmrap(db, USER, agacho)).toEqual([{ peso_kg: 85, reps: 8 }]);
  });

  it("um usuário não registra série no plano do outro", async () => {
    const supino = await exercicio("Supino");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    const plano = await getPlano(db, USER, sid);
    await registrarSerie(db, OUTRO, plano[0].id, {
      reps: 12, peso_kg: 40, tipo: "valida", rir: null, nota: null,
    });
    expect(await listSetsBySession(db, USER, sid)).toHaveLength(0);
  });
});

describe("desfazerSerie", () => {
  it("apaga a série e desfaz o elo", async () => {
    const supino = await exercicio("Supino");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    const plano = await getPlano(db, USER, sid);
    await registrarSerie(db, USER, plano[0].id, {
      reps: 12, peso_kg: 40, tipo: "valida", rir: null, nota: null,
    });

    await desfazerSerie(db, USER, plano[0].id);

    expect(await listSetsBySession(db, USER, sid)).toHaveLength(0);
    expect((await getPlano(db, USER, sid))[0].set_id).toBeNull();
  });

  it("desfazer uma série nunca registrada não faz nada", async () => {
    const supino = await exercicio("Supino");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    const plano = await getPlano(db, USER, sid);
    await desfazerSerie(db, USER, plano[0].id);
    expect(await getPlano(db, USER, sid)).toHaveLength(3);
  });
});

describe("adicionarAoPlano", () => {
  it("acrescenta um exercício avulso no fim, sem routine_exercise_id", async () => {
    const supino = await exercicio("Supino");
    const rosca = await exercicio("Rosca direta");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });

    await adicionarAoPlano(db, USER, sid, item(rosca, 12));

    const plano = await getPlano(db, USER, sid);
    expect(plano).toHaveLength(6);
    expect(plano.map((p) => p.ordem)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(plano[3].nome).toBe("Rosca direta");
    expect(plano[3].serie_ordem).toBe(1);
    expect(plano[3].routine_exercise_id).toBeNull();
  });
});

describe("sessaoAtiva", () => {
  it("não há treino acontecendo quando nada está aberto", async () => {
    expect(await sessaoAtiva(db, USER)).toBeNull();
  });

  it("conta quantas séries do plano já foram feitas", async () => {
    const supino = await exercicio("Supino");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    const plano = await getPlano(db, USER, sid);
    await registrarSerie(db, USER, plano[0].id, {
      reps: 12, peso_kg: 40, tipo: "valida", rir: null, nota: null,
    });

    expect(await sessaoAtiva(db, USER)).toMatchObject({
      session_id: sid, nome: "Peito", data: "2026-08-17", total: 3, feitas: 1,
    });
  });

  it("uma sessão SEM exercício nenhum continua existindo", async () => {
    // O `JOIN` com `session_plan_sets` a fazia sumir — e é assim que todo
    // treino avulso nasce. Sair da tela perdia o treino, e a tentativa
    // seguinte criava outra sessão órfã.
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Treino avulso", itens: [],
    });

    expect(await sessaoAtiva(db, USER)).toMatchObject({
      session_id: sid, nome: "Treino avulso", total: 0, feitas: 0,
    });
  });

  it("ignora rascunho: um treino que não começou não está acontecendo", async () => {
    await criarSessao(db, USER, { data: "2026-08-17", nome: "Rascunho", itens: [] });
    expect(await sessaoAtiva(db, USER)).toBeNull();
  });

  it("devolve a mais recente em andamento", async () => {
    const antiga = await sessaoEmCurso(db, USER, { data: "2026-08-16", nome: "Costas", itens: [] });
    await new Promise((r) => setTimeout(r, 5));
    const nova = await sessaoEmCurso(db, USER, { data: "2026-08-17", nome: "Peito", itens: [] });

    expect((await sessaoAtiva(db, USER))!.session_id).toBe(nova);
    expect(antiga).not.toBe(nova);
  });
});

describe("sessoesAbertas", () => {
  it("devolve TODAS as sessões abertas, da mais recente para a mais antiga", async () => {
    // Treinar duas vezes no mesmo dia é uma coisa que acontece; o hub só
    // sabia oferecer a última.
    const supino = await exercicio("Supino");
    const primeira = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Manhã", itens: [item(supino)],
    });
    const segunda = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Noite", itens: [],
    });

    const abertas = await sessoesAbertas(db, USER);
    expect(abertas.map((s) => s.session_id)).toEqual([segunda, primeira]);
    expect(abertas[0]).toMatchObject({ nome: "Noite", total: 0, feitas: 0 });
    expect(abertas[1]).toMatchObject({ nome: "Manhã", total: 3 });
  });

  it("o treino aberto ONTEM continua aberto hoje", async () => {
    // O filtro por data fazia o treino das 22h desaparecer na virada da
    // meia-noite: irretomável, infinalizável, e fantasma no histórico.
    const sid = await sessaoEmCurso(db, USER, { data: "2026-08-16", nome: "Costas", itens: [] });

    const abertas = await sessoesAbertas(db, USER);

    expect(abertas.map((s) => s.session_id)).toContain(sid);
    expect(abertas[0].data).toBe("2026-08-16");
  });

  it("inclui o rascunho, com iniciado_em nulo", async () => {
    const sid = await criarSessao(db, USER, { data: "2026-08-17", nome: "Avulso", itens: [] });
    const abertas = await sessoesAbertas(db, USER);
    expect(abertas).toHaveLength(1);
    expect(abertas[0].session_id).toBe(sid);
    expect(abertas[0].iniciado_em).toBeNull();
  });

  it("a encerrada sai da lista, as outras ficam", async () => {
    const a = await sessaoEmCurso(db, USER, { data: "2026-08-17", nome: "A", itens: [] });
    const b = await sessaoEmCurso(db, USER, { data: "2026-08-17", nome: "B", itens: [] });

    await finalizarSessao(db, USER, b);

    expect((await sessoesAbertas(db, USER)).map((s) => s.session_id)).toEqual([a]);
  });

  it("não enxerga sessão de outro usuário", async () => {
    await sessaoEmCurso(db, OUTRO, { data: "2026-08-17", nome: "Alheia", itens: [] });
    expect(await sessoesAbertas(db, USER)).toEqual([]);
  });
});

describe("finalizarSessao", () => {
  // O hub oferecia "retomar" para sempre, inclusive com todas as séries feitas:
  // não havia como uma sessão acabar.
  it("encerrada, a sessão some do 'em andamento' mesmo com séries pendentes", async () => {
    const supino = await exercicio("Supino");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    expect(await sessaoAtiva(db, USER)).not.toBeNull();

    await finalizarSessao(db, USER, sid);
    expect(await sessaoAtiva(db, USER)).toBeNull();
  });

  it("um usuário não encerra a sessão do outro", async () => {
    const supino = await exercicio("Supino");
    await sessaoEmCurso(db, USER, { data: "2026-08-17", nome: "Peito", itens: [item(supino)] });
    const alvo = (await sessaoAtiva(db, USER))!.session_id;
    await finalizarSessao(db, OUTRO, alvo);
    expect(await sessaoAtiva(db, USER)).not.toBeNull();
  });

  it("encerrar duas vezes não muda a hora do encerramento", async () => {
    const supino = await exercicio("Supino");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    await finalizarSessao(db, USER, sid);
    const hora = async () =>
      (await db.execute({ sql: "SELECT concluida_em FROM workout_sessions WHERE id=?", args: [sid] }))
        .rows[0].concluida_em as string;
    const primeira = await hora();
    await finalizarSessao(db, USER, sid);
    expect(await hora()).toBe(primeira);
  });
});

describe("montarPlanoDoDia", () => {
  it("planeja cada exercício do dia na ordem da rotina", async () => {
    const supino = await exercicio("Supino");
    const crucifixo = await exercicio("Crucifixo");
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    const re1 = await adicionarExercicio(db, USER, d.id, {
      exercise_id: supino, prescricao: "dupla", series: 3, reps_min: 8, reps_max: 12,
      peso_kg: 40, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: 120, duracao_min: null,
    });
    await adicionarExercicio(db, USER, d.id, {
      exercise_id: crucifixo, prescricao: "fixa", series: 4, reps_min: null, reps_max: 15,
      peso_kg: 12, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: 60, duracao_min: null,
    });

    const itens = await montarPlanoDoDia(db, USER, d.id, "2026-08-17");
    expect(itens).toHaveLength(2);
    expect(itens[0].exercise_id).toBe(supino);
    expect(itens[0].nome).toBe("Supino");
    expect(itens[0].routine_exercise_id).toBe(re1);
    expect(itens[0].descanso_s).toBe(120);
    expect(itens[0].series).toHaveLength(3);
    expect(itens[0].series[0].peso_kg).toBe(40);
    expect(itens[1].series).toHaveLength(4);
    expect(itens[1].series[0].reps_alvo).toBe(15);
  });

  // O ponto do desenho: a carga de hoje sai do que foi feito, não da rotina.
  it("a dupla progressão sobe a carga a partir do histórico", async () => {
    const supino = await exercicio("Supino");
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    await adicionarExercicio(db, USER, d.id, {
      exercise_id: supino, prescricao: "dupla", series: 3, reps_min: 8, reps_max: 12,
      peso_kg: 40, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: 90, duracao_min: null,
    });

    const s = await createSession(db, USER, { data: "2026-08-10", nome: null });
    for (const ordem of [1, 2, 3]) {
      await addSet(db, USER, {
        session_id: s.id, exercise_id: supino, ordem,
        reps: 12, peso_kg: 40, tipo: "valida", rir: null, nota: null,
      });
    }

    const itens = await montarPlanoDoDia(db, USER, d.id, "2026-08-17");
    expect(itens[0].series[0].peso_kg).toBe(42.5);
  });

  it("dia sem exercício devolve lista vazia", async () => {
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    expect(await montarPlanoDoDia(db, USER, d.id, "2026-08-17")).toEqual([]);
  });
});

describe("cardio dentro da sessão", () => {
  /** Um item de cardio de 30 min, MET 7,5 (bicicleta). */
  async function comCardio() {
    const bike = await exercicio("Bicicleta");
    await db.execute({ sql: "UPDATE exercises SET met = 7.5, equipamento = 'cardio' WHERE id = ?", args: [bike] });
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17",
      nome: "Cardio",
      itens: [{
        routine_exercise_id: null, exercise_id: bike, nome: "Bicicleta", descanso_s: null,
        series: planejar({ tipo: "cardio", duracao_min: 30, met: 7.5 }, []),
      }],
    });
    return { bike, sid };
  }

  it("materializa uma linha só, reconhecível como cardio", async () => {
    const { sid } = await comCardio();
    const plano = await getPlano(db, USER, sid);
    expect(plano).toHaveLength(1);
    expect(plano[0].duracao_min).toBe(30);
    expect(plano[0].met).toBe(7.5);
    expect(ehCardio(plano[0])).toBe(true);
  });

  // O ponto do desenho: cardio soma calorias no mesmo lugar que o cardio de
  // sempre somava, e não contamina a tabela de levantamento de peso.
  it("registrar grava em activity_sessions e NÃO em workout_sets", async () => {
    const { sid } = await comCardio();
    const [linha] = await getPlano(db, USER, sid);

    await registrarCardio(db, USER, linha.id, { duracao_min: 30, kcal: 308 });

    expect(await listSetsBySession(db, USER, sid)).toHaveLength(0);
    const rs = await db.execute({
      sql: "SELECT tipo, data, duracao_min, kcal FROM activity_sessions WHERE user_id = ?",
      args: [USER],
    });
    expect(rs.rows).toHaveLength(1);
    expect(rs.rows[0].tipo).toBe("Bicicleta");
    expect(rs.rows[0].data).toBe("2026-08-17");
    expect(Number(rs.rows[0].kcal)).toBe(308);

    const depois = await getPlano(db, USER, sid);
    expect(depois[0].activity_id).not.toBeNull();
    expect(depois[0].duracao_feita_min).toBe(30);
    expect(depois[0].kcal_feita).toBe(308);
  });

  /**
   * O critério de aceite da spec, e a razão de cardio existir como item da
   * sessão: 30 minutos de bicicleta registrados dentro do treino têm que valer
   * no balanço energético o mesmo que valiam pela tela de cardio avulsa.
   *
   * Este teste liga as duas pontas — a escrita da sessão e a leitura que a
   * `/analise` faz — porque nenhuma das duas sozinha prova isso.
   */
  it("o cardio da sessão chega ao balanço energético da análise", async () => {
    const { sid } = await comCardio();
    const [linha] = await getPlano(db, USER, sid);
    const kcal = Math.round(estimativaKcal(7.5, 80, 30));

    await registrarCardio(db, USER, linha.id, { duracao_min: 30, kcal });

    const doPeriodo = await listActivitySessionsByRange(db, USER, "2026-08-01", "2026-08-31");
    const balanco = balancoEnergetico(new Map([["2026-08-17", 2000]]), kcalGastaPorDia(doPeriodo));
    expect(balanco.gasto).toBe(300);
    expect(balanco.saldo).toBe(1700);
  });

  it("desfazer apaga a atividade e zera o elo", async () => {
    const { sid } = await comCardio();
    const [linha] = await getPlano(db, USER, sid);
    await registrarCardio(db, USER, linha.id, { duracao_min: 30, kcal: 308 });

    await desfazerSerie(db, USER, linha.id);

    const rs = await db.execute({ sql: "SELECT COUNT(*) AS n FROM activity_sessions WHERE user_id = ?", args: [USER] });
    expect(Number(rs.rows[0].n)).toBe(0);
    expect((await getPlano(db, USER, sid))[0].activity_id).toBeNull();
  });

  it("cardio conta no progresso da sessão em andamento", async () => {
    const { sid } = await comCardio();
    const [linha] = await getPlano(db, USER, sid);
    expect((await sessaoAtiva(db, USER))).toMatchObject({
      session_id: sid, nome: "Cardio", total: 1, feitas: 0,
    });
    await registrarCardio(db, USER, linha.id, { duracao_min: 30, kcal: 308 });
    expect((await sessaoAtiva(db, USER))!.feitas).toBe(1);
  });

  it("um usuário não registra cardio no plano do outro", async () => {
    const { sid } = await comCardio();
    const [linha] = await getPlano(db, USER, sid);
    await registrarCardio(db, OUTRO, linha.id, { duracao_min: 30, kcal: 308 });
    const rs = await db.execute("SELECT COUNT(*) AS n FROM activity_sessions");
    expect(Number(rs.rows[0].n)).toBe(0);
  });

  it("a rotina planeja cardio a partir da prescrição gravada", async () => {
    const bike = await exercicio("Bicicleta");
    await db.execute({ sql: "UPDATE exercises SET met = 7.5, equipamento = 'cardio' WHERE id = ?", args: [bike] });
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 4, "Cardio");
    await adicionarExercicio(db, USER, d.id, {
      exercise_id: bike, prescricao: "cardio", series: 1, reps_min: null, reps_max: null,
      peso_kg: null, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: null,
      duracao_min: 45,
    });

    const itens = await montarPlanoDoDia(db, USER, d.id, "2026-08-17");
    expect(itens).toHaveLength(1);
    expect(itens[0].series).toHaveLength(1);
    expect(itens[0].series[0].duracao_min).toBe(45);
  });
});

/* ══════════════════════════════════════════════════════════════════
   EDITAR A SESSÃO

   Até aqui a sessão só crescia: dava para adicionar exercício e corrigir
   série, nunca para remover, trocar ou reordenar. Um exercício escolhido por
   engano ficava na sessão para sempre.
   ══════════════════════════════════════════════════════════════════ */

describe("removerExercicioDaSessao", () => {
  it("tira o bloco inteiro e renumera a ordem do que sobrou", async () => {
    const supino = await exercicio("Supino");
    const rosca = await exercicio("Rosca direta");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino), item(rosca, 12)],
    });

    await removerExercicioDaSessao(db, USER, sid, supino);

    const plano = await getPlano(db, USER, sid);
    expect(plano.map((p) => p.nome)).toEqual(["Rosca direta", "Rosca direta", "Rosca direta"]);
    expect(plano.map((p) => p.ordem)).toEqual([1, 2, 3]);
    expect(plano.map((p) => p.serie_ordem)).toEqual([1, 2, 3]);
  });

  it("apaga também as séries já registradas do exercício removido", async () => {
    const supino = await exercicio("Supino");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    const plano = await getPlano(db, USER, sid);
    await registrarSerie(db, USER, plano[0].id, {
      reps: 12, peso_kg: 40, tipo: "valida", rir: null, nota: null,
    });

    await removerExercicioDaSessao(db, USER, sid, supino);

    expect(await listSetsBySession(db, USER, sid)).toHaveLength(0);
  });

  // Cardio grava em activity_sessions, e uma atividade órfã continuaria
  // contando calorias de um exercício que não está mais na sessão.
  it("apaga a atividade do cardio removido", async () => {
    const bike = await exercicio("Bicicleta");
    await db.execute({
      sql: "UPDATE exercises SET met = 7.5, equipamento = 'cardio' WHERE id = ?",
      args: [bike],
    });
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17",
      nome: "Cardio",
      itens: [{
        routine_exercise_id: null, exercise_id: bike, nome: "Bicicleta", descanso_s: null,
        series: planejar({ tipo: "cardio", duracao_min: 30, met: 7.5 }, []),
      }],
    });
    const [linha] = await getPlano(db, USER, sid);
    await registrarCardio(db, USER, linha.id, { duracao_min: 30, kcal: 308 });

    await removerExercicioDaSessao(db, USER, sid, bike);

    expect(await listActivitySessionsByRange(db, USER, "2026-08-17", "2026-08-17")).toHaveLength(0);
  });

  it("um usuário não remove exercício da sessão do outro", async () => {
    const supino = await exercicio("Supino");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    await removerExercicioDaSessao(db, OUTRO, sid, supino);
    expect(await getPlano(db, USER, sid)).toHaveLength(3);
  });
});

describe("trocarExercicioDaSessao", () => {
  it("o bloco passa a ser do exercício novo, na mesma posição", async () => {
    const supino = await exercicio("Supino");
    const rosca = await exercicio("Rosca direta");
    const inclinado = await exercicio("Supino inclinado");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino), item(rosca, 12)],
    });

    await trocarExercicioDaSessao(db, USER, sid, supino, inclinado);

    const plano = await getPlano(db, USER, sid);
    expect(plano.map((p) => p.nome)).toEqual([
      "Supino inclinado", "Supino inclinado", "Supino inclinado",
      "Rosca direta", "Rosca direta", "Rosca direta",
    ]);
    expect(plano.map((p) => p.ordem)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  // É o caso que motiva a troca: registrei três séries no exercício errado.
  // Se o realizado não vier junto, o histórico fica no exercício que eu não fiz.
  it("as séries já registradas passam a ser do exercício novo", async () => {
    const supino = await exercicio("Supino");
    const inclinado = await exercicio("Supino inclinado");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    const plano = await getPlano(db, USER, sid);
    await registrarSerie(db, USER, plano[0].id, {
      reps: 12, peso_kg: 40, tipo: "valida", rir: null, nota: null,
    });

    await trocarExercicioDaSessao(db, USER, sid, supino, inclinado);

    const sets = await listSetsBySession(db, USER, sid);
    expect(sets).toHaveLength(1);
    expect(sets[0].exercise_id).toBe(inclinado);
  });

  // O vínculo com a rotina descreve a prescrição do exercício ANTIGO. Mantê-lo
  // faria a progressão do exercício da rotina comer o que foi feito noutro.
  it("o exercício trocado deixa de apontar para a rotina", async () => {
    const supino = await exercicio("Supino");
    const inclinado = await exercicio("Supino inclinado");
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    await adicionarExercicio(db, USER, d.id, {
      exercise_id: supino, prescricao: "dupla", series: 3, reps_min: 8, reps_max: 12,
      peso_kg: 40, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: 90,
      duracao_min: null,
    });
    const itens = await montarPlanoDoDia(db, USER, d.id, "2026-08-17");
    const sid = await sessaoEmCurso(db, USER, { data: "2026-08-17", nome: "Peito", itens });
    expect((await getPlano(db, USER, sid))[0].routine_exercise_id).not.toBeNull();

    await trocarExercicioDaSessao(db, USER, sid, supino, inclinado);

    expect((await getPlano(db, USER, sid))[0].routine_exercise_id).toBeNull();
  });
});

describe("reordenarExerciciosDaSessao", () => {
  it("põe os blocos na ordem pedida, cada um com suas séries", async () => {
    const supino = await exercicio("Supino");
    const rosca = await exercicio("Rosca direta");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino), item(rosca, 12)],
    });

    await reordenarExerciciosDaSessao(db, USER, sid, [rosca, supino]);

    const plano = await getPlano(db, USER, sid);
    expect(plano.map((p) => p.nome)).toEqual([
      "Rosca direta", "Rosca direta", "Rosca direta",
      "Supino", "Supino", "Supino",
    ]);
    expect(plano.map((p) => p.ordem)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(plano.map((p) => p.serie_ordem)).toEqual([1, 2, 3, 1, 2, 3]);
  });

  it("exercício de fora da lista vai para o fim, sem sumir", async () => {
    const supino = await exercicio("Supino");
    const rosca = await exercicio("Rosca direta");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino), item(rosca, 12)],
    });

    await reordenarExerciciosDaSessao(db, USER, sid, [rosca]);

    const plano = await getPlano(db, USER, sid);
    expect(plano).toHaveLength(6);
    expect(plano[0].nome).toBe("Rosca direta");
    expect(plano[3].nome).toBe("Supino");
  });
});

describe("adicionarSerie", () => {
  it("a série nova entra no fim do bloco, copiando peso e reps da última", async () => {
    const supino = await exercicio("Supino");
    const rosca = await exercicio("Rosca direta");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino), item(rosca, 12)],
    });

    await adicionarSerie(db, USER, sid, supino);

    const plano = await getPlano(db, USER, sid);
    expect(plano).toHaveLength(7);
    const doSupino = plano.filter((p) => p.exercise_id === supino);
    expect(doSupino).toHaveLength(4);
    expect(doSupino[3].serie_ordem).toBe(4);
    expect(doSupino[3].peso_kg).toBe(40);
    expect(doSupino[3].reps_alvo).toBe(12);
    // A ordem global continua contígua: o bloco da rosca foi empurrado.
    expect(plano.map((p) => p.ordem)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(plano[4].nome).toBe("Rosca direta");
  });

  it("a série nova nasce por fazer", async () => {
    const supino = await exercicio("Supino");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    await adicionarSerie(db, USER, sid, supino);
    expect((await getPlano(db, USER, sid))[3].set_id).toBeNull();
  });
});

describe("removerSerie", () => {
  it("tira a linha do plano e renumera as séries do bloco", async () => {
    const supino = await exercicio("Supino");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    const plano = await getPlano(db, USER, sid);

    await removerSerie(db, USER, plano[1].id);

    const depois = await getPlano(db, USER, sid);
    expect(depois).toHaveLength(2);
    expect(depois.map((p) => p.serie_ordem)).toEqual([1, 2]);
    expect(depois.map((p) => p.ordem)).toEqual([1, 2]);
  });

  it("apaga junto a série que já tinha sido registrada", async () => {
    const supino = await exercicio("Supino");
    const sid = await sessaoEmCurso(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    const plano = await getPlano(db, USER, sid);
    await registrarSerie(db, USER, plano[1].id, {
      reps: 10, peso_kg: 40, tipo: "valida", rir: null, nota: null,
    });

    await removerSerie(db, USER, plano[1].id);

    expect(await listSetsBySession(db, USER, sid)).toHaveLength(0);
  });
});

describe("o ciclo de vida da sessão", () => {
  it("criarSessao nasce rascunho: sem início e sem fim", async () => {
    const sid = await criarSessao(db, USER, { data: "2026-09-01", nome: "Avulso", itens: [] });
    const s = await getSession(db, USER, sid);
    expect(s!.iniciado_em).toBeNull();
    expect(s!.concluida_em).toBeNull();
  });

  it("iniciarSessao marca o começo", async () => {
    const sid = await criarSessao(db, USER, { data: "2026-09-01", nome: "Avulso", itens: [] });
    await iniciarSessao(db, USER, sid);
    const s = await getSession(db, USER, sid);
    expect(s!.iniciado_em).not.toBeNull();
    expect(s!.concluida_em).toBeNull();
  });

  it("iniciar duas vezes não move o começo", async () => {
    const sid = await criarSessao(db, USER, { data: "2026-09-01", nome: "Avulso", itens: [] });
    await iniciarSessao(db, USER, sid);
    const primeiro = (await getSession(db, USER, sid))!.iniciado_em;
    await new Promise((r) => setTimeout(r, 5));
    await iniciarSessao(db, USER, sid);
    expect((await getSession(db, USER, sid))!.iniciado_em).toBe(primeiro);
  });

  it("iniciar a sessão de outro dono não faz nada", async () => {
    const sid = await criarSessao(db, USER, { data: "2026-09-01", nome: "Avulso", itens: [] });
    await iniciarSessao(db, OUTRO, sid);
    expect((await getSession(db, USER, sid))!.iniciado_em).toBeNull();
  });

  it("registrar uma série num rascunho inicia o treino", async () => {
    const ex = await exercicio("Supino");
    const sid = await criarSessao(db, USER, { data: "2026-09-01", nome: "Peito", itens: [item(ex)] });
    const plano = await getPlano(db, USER, sid);

    await registrarSerie(db, USER, plano[0].id, {
      reps: 10, peso_kg: 40, tipo: "valida", rir: null, nota: null,
    });

    expect((await getSession(db, USER, sid))!.iniciado_em).not.toBeNull();
  });

  it("finalizar um rascunho preenche início e fim — nunca fim sem início", async () => {
    const sid = await criarSessao(db, USER, { data: "2026-09-01", nome: "Avulso", itens: [] });
    await finalizarSessao(db, USER, sid);
    const s = await getSession(db, USER, sid);
    expect(s!.iniciado_em).not.toBeNull();
    expect(s!.concluida_em).not.toBeNull();
  });

  it("finalizar não move o início de quem já tinha um", async () => {
    const sid = await criarSessao(db, USER, { data: "2026-09-01", nome: "Avulso", itens: [] });
    await iniciarSessao(db, USER, sid);
    const inicio = (await getSession(db, USER, sid))!.iniciado_em;
    await finalizarSessao(db, USER, sid);
    expect((await getSession(db, USER, sid))!.iniciado_em).toBe(inicio);
  });
});

