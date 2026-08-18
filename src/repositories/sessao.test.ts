import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  adicionarAoPlano,
  desfazerSerie,
  getPlano,
  iniciarSessao,
  finalizarSessao,
  marcasAmrap,
  registrarCardio,
  ehCardio,
  montarPlanoDoDia,
  registrarSerie,
  sessaoEmAndamento,
  type ItemPlanejado,
} from "./sessao";
import { addSet, createSession, listSetsBySession } from "./workouts";
import { adicionarExercicio, criarRotina, salvarDia } from "./rotina";
import { planejar } from "../domain/prescricao";
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
    const sid = await iniciarSessao(db, USER, {
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
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    expect(await listSetsBySession(db, USER, sid)).toHaveLength(0);
  });

  it("o plano de um usuário não vaza para outro", async () => {
    const supino = await exercicio("Supino");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    expect(await getPlano(db, OUTRO, sid)).toHaveLength(0);
  });
});

describe("registrarSerie", () => {
  it("cria a série em workout_sets e liga o plano a ela", async () => {
    const supino = await exercicio("Supino");
    const sid = await iniciarSessao(db, USER, {
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
    const sid = await iniciarSessao(db, USER, {
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
    const sid = await iniciarSessao(db, USER, {
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
    const sid = await iniciarSessao(db, USER, {
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
    const sid = await iniciarSessao(db, USER, {
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
    const sid = await iniciarSessao(db, USER, {
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
    const sid = await iniciarSessao(db, USER, {
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

describe("sessaoEmAndamento", () => {
  it("não há sessão num dia sem sessão", async () => {
    expect(await sessaoEmAndamento(db, USER, "2026-08-17")).toBeNull();
  });

  it("conta quantas séries do plano já foram feitas", async () => {
    const supino = await exercicio("Supino");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    const plano = await getPlano(db, USER, sid);
    await registrarSerie(db, USER, plano[0].id, {
      reps: 12, peso_kg: 40, tipo: "valida", rir: null, nota: null,
    });

    const em = await sessaoEmAndamento(db, USER, "2026-08-17");
    expect(em).toEqual({ session_id: sid, nome: "Peito", total: 3, feitas: 1 });
  });
});

describe("finalizarSessao", () => {
  // O hub oferecia "retomar" para sempre, inclusive com todas as séries feitas:
  // não havia como uma sessão acabar.
  it("encerrada, a sessão some do 'em andamento' mesmo com séries pendentes", async () => {
    const supino = await exercicio("Supino");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    expect(await sessaoEmAndamento(db, USER, "2026-08-17")).not.toBeNull();

    await finalizarSessao(db, USER, sid);
    expect(await sessaoEmAndamento(db, USER, "2026-08-17")).toBeNull();
  });

  it("um usuário não encerra a sessão do outro", async () => {
    const supino = await exercicio("Supino");
    await iniciarSessao(db, USER, { data: "2026-08-17", nome: "Peito", itens: [item(supino)] });
    const alvo = (await sessaoEmAndamento(db, USER, "2026-08-17"))!.session_id;
    await finalizarSessao(db, OUTRO, alvo);
    expect(await sessaoEmAndamento(db, USER, "2026-08-17")).not.toBeNull();
  });

  it("encerrar duas vezes não muda a hora do encerramento", async () => {
    const supino = await exercicio("Supino");
    const sid = await iniciarSessao(db, USER, {
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
    const sid = await iniciarSessao(db, USER, {
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
    expect((await sessaoEmAndamento(db, USER, "2026-08-17"))).toEqual({
      session_id: sid, nome: "Cardio", total: 1, feitas: 0,
    });
    await registrarCardio(db, USER, linha.id, { duracao_min: 30, kcal: 308 });
    expect((await sessaoEmAndamento(db, USER, "2026-08-17"))!.feitas).toBe(1);
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
