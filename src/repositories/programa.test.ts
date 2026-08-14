import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  atualizarIncremento,
  atualizarTM,
  concluirSessao,
  criarPrograma,
  desfazerSessao,
  getProgramaAtivo,
  listLevantamentos,
  listSessoesDoPrograma,
  marcasAmrap,
  posicaoAtual,
} from "./programa";
import { sessaoPrescrita } from "../domain/531";

const USER = 1;
let db: Client;

/** Cria os quatro levantamentos clássicos no catálogo e devolve os ids. */
async function exercicios(): Promise<Record<string, number>> {
  const nomes = ["Agachamento", "Supino", "Terra", "Desenvolvimento"];
  const out: Record<string, number> = {};
  for (const nome of nomes) {
    const rs = await db.execute({
      sql: "INSERT INTO exercises (nome, source, created_at) VALUES (?, 'custom', ?)",
      args: [nome, new Date().toISOString()],
    });
    out[nome] = Number(rs.lastInsertRowid);
  }
  return out;
}

async function programaPadrao() {
  const ex = await exercicios();
  const p = await criarPrograma(db, USER, {
    nome: "5/3/1",
    incremento_kg: 2.5,
    levantamentos: [
      { exercise_id: ex.Agachamento, tm_kg: 130, parte: "inferior" },
      { exercise_id: ex.Supino, tm_kg: 90, parte: "superior" },
      { exercise_id: ex.Terra, tm_kg: 160, parte: "inferior" },
      { exercise_id: ex.Desenvolvimento, tm_kg: 55, parte: "superior" },
    ],
  });
  return { programa: p, ex };
}

/** Conclui a posição atual do programa, sem séries — para andar o estado. */
async function andar(programa: Awaited<ReturnType<typeof programaPadrao>>["programa"]) {
  const pos = await posicaoAtual(db, USER, programa);
  if (!pos.levantamento) throw new Error("sem levantamento");
  await concluirSessao(db, USER, {
    programId: programa.id,
    liftId: pos.levantamento.id,
    ciclo: pos.ciclo,
    semana: pos.semana,
    tm_kg: pos.levantamento.tm_kg,
    data: "2026-08-14",
    nome: pos.levantamento.nome,
    series: [],
  });
  return pos;
}

beforeEach(async () => {
  db = await createTestDb();
});

describe("criar programa", () => {
  it("grava o programa e os levantamentos na ordem", async () => {
    const { programa } = await programaPadrao();

    expect(await getProgramaAtivo(db, USER)).toMatchObject({
      id: programa.id,
      tipo: "531",
      incremento_kg: 2.5,
      ativo: true,
    });

    const lifts = await listLevantamentos(db, USER, programa);
    expect(lifts.map((l) => l.nome)).toEqual([
      "Agachamento",
      "Supino",
      "Terra",
      "Desenvolvimento",
    ]);
    expect(lifts.map((l) => l.parte)).toEqual([
      "inferior",
      "superior",
      "inferior",
      "superior",
    ]);
  });

  it("desativa o programa anterior sem apagá-lo", async () => {
    // As sessões antigas apontam para os levantamentos dele.
    const { programa: antigo } = await programaPadrao();
    const { programa: novo } = await programaPadrao();

    expect((await getProgramaAtivo(db, USER))?.id).toBe(novo.id);
    const rs = await db.execute({
      sql: "SELECT ativo FROM strength_programs WHERE id=?",
      args: [antigo.id],
    });
    expect(rs.rows[0].ativo).toBe(0);
  });

  it("não vaza entre usuários", async () => {
    await programaPadrao();
    expect(await getProgramaAtivo(db, 99)).toBeNull();
  });
});

describe("posição no programa", () => {
  it("programa novo começa no ciclo 1, semana 1, primeiro levantamento", async () => {
    const { programa } = await programaPadrao();
    const pos = await posicaoAtual(db, USER, programa);
    expect(pos).toMatchObject({ ciclo: 1, semana: 1, ciclosFechados: 0 });
    expect(pos.levantamento?.nome).toBe("Agachamento");
  });

  it("anda um levantamento a cada sessão concluída", async () => {
    const { programa } = await programaPadrao();
    await andar(programa);
    expect((await posicaoAtual(db, USER, programa)).levantamento?.nome).toBe("Supino");
    await andar(programa);
    expect((await posicaoAtual(db, USER, programa)).levantamento?.nome).toBe("Terra");
  });

  it("completada a semana, passa para a próxima", async () => {
    const { programa } = await programaPadrao();
    for (let i = 0; i < 4; i++) await andar(programa);
    const pos = await posicaoAtual(db, USER, programa);
    expect(pos).toMatchObject({ ciclo: 1, semana: 2 });
    expect(pos.levantamento?.nome).toBe("Agachamento");
  });

  it("completado o ciclo, sobe o TM de cada levantamento pela sua parte", async () => {
    const { programa } = await programaPadrao();
    for (let i = 0; i < 16; i++) await andar(programa); // 4 levantamentos × 4 semanas

    const pos = await posicaoAtual(db, USER, programa);
    expect(pos).toMatchObject({ ciclo: 2, semana: 1, ciclosFechados: 1 });

    const lifts = await listLevantamentos(db, USER, programa);
    const porNome = Object.fromEntries(lifts.map((l) => [l.nome, l]));
    // Inferior sobe 5 kg, superior sobe 2,5 kg.
    expect(porNome.Agachamento.tm_kg).toBe(135);
    expect(porNome.Terra.tm_kg).toBe(165);
    expect(porNome.Supino.tm_kg).toBe(92.5);
    expect(porNome.Desenvolvimento.tm_kg).toBe(57.5);
    // O inicial não é reescrito.
    expect(porNome.Agachamento.tm_inicial_kg).toBe(130);
  });
});

describe("concluir sessão", () => {
  it("grava as séries com percentual e marca a AMRAP", async () => {
    const { programa } = await programaPadrao();
    const pos = await posicaoAtual(db, USER, programa);
    const lift = pos.levantamento!;
    const prescrito = sessaoPrescrita(lift.tm_kg, 1, programa.incremento_kg);

    await concluirSessao(db, USER, {
      programId: programa.id,
      liftId: lift.id,
      ciclo: 1,
      semana: 1,
      tm_kg: lift.tm_kg,
      data: "2026-08-14",
      nome: "Agachamento",
      series: prescrito.map((s, i) => ({
        exercise_id: lift.exercise_id,
        ordem: i + 1,
        reps: s.amrap ? 8 : s.reps,
        peso_kg: s.peso_kg,
        tipo: s.tipo === "aquecimento" ? "aquecimento" : "valida",
        prescribed_pct: s.pct,
        amrap: s.amrap,
      })),
    });

    const rs = await db.execute({
      sql: "SELECT reps, peso_kg, tipo, prescribed_pct, amrap FROM workout_sets WHERE user_id=? ORDER BY ordem",
      args: [USER],
    });
    expect(rs.rows).toHaveLength(6);
    expect(rs.rows[0]).toMatchObject({ tipo: "aquecimento", prescribed_pct: 40, amrap: 0 });
    // Última: AMRAP a 85%, com as 8 reps que foram feitas de verdade.
    expect(rs.rows[5]).toMatchObject({ prescribed_pct: 85, amrap: 1, reps: 8 });
  });

  it("refazer a mesma posição atualiza em vez de empurrar o programa", async () => {
    const { programa } = await programaPadrao();
    const pos = await posicaoAtual(db, USER, programa);

    for (const data of ["2026-08-14", "2026-08-15"]) {
      await concluirSessao(db, USER, {
        programId: programa.id,
        liftId: pos.levantamento!.id,
        ciclo: 1,
        semana: 1,
        tm_kg: 130,
        data,
        nome: "Agachamento",
        series: [],
      });
    }

    const sessoes = await listSessoesDoPrograma(db, USER, programa.id);
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0].data).toBe("2026-08-15");
    expect((await posicaoAtual(db, USER, programa)).levantamento?.nome).toBe("Supino");
  });

  it("guarda o TM da época, não o de hoje", async () => {
    // Sem isso, uma sessão antiga mostraria percentuais sobre o TM atual e o
    // histórico contaria uma mentira.
    const { programa } = await programaPadrao();
    for (let i = 0; i < 16; i++) await andar(programa);

    const primeira = (await listSessoesDoPrograma(db, USER, programa.id))[0];
    expect(primeira.tm_kg).toBe(130);

    const agora = await posicaoAtual(db, USER, programa);
    expect(agora.levantamento?.tm_kg).toBe(135);
  });
});

describe("desfazer sessão", () => {
  it("volta a posição e apaga as séries", async () => {
    const { programa } = await programaPadrao();
    await andar(programa);
    await andar(programa);
    expect((await posicaoAtual(db, USER, programa)).levantamento?.nome).toBe("Terra");

    const sessoes = await listSessoesDoPrograma(db, USER, programa.id);
    await desfazerSessao(db, USER, sessoes[1].id);

    // O estado é derivado: some a sessão, volta a posição.
    expect((await posicaoAtual(db, USER, programa)).levantamento?.nome).toBe("Supino");
    const restantes = await listSessoesDoPrograma(db, USER, programa.id);
    expect(restantes).toHaveLength(1);
  });

  it("não deixa outro usuário desfazer sessão alheia", async () => {
    const { programa } = await programaPadrao();
    await andar(programa);
    const sessoes = await listSessoesDoPrograma(db, USER, programa.id);

    await desfazerSessao(db, 99, sessoes[0].id);
    expect(await listSessoesDoPrograma(db, USER, programa.id)).toHaveLength(1);
  });
});

describe("marcas de AMRAP", () => {
  it("lê só as séries marcadas como AMRAP", async () => {
    const { programa, ex } = await programaPadrao();
    const pos = await posicaoAtual(db, USER, programa);

    await concluirSessao(db, USER, {
      programId: programa.id,
      liftId: pos.levantamento!.id,
      ciclo: 1,
      semana: 1,
      tm_kg: 130,
      data: "2026-08-14",
      nome: "Agachamento",
      series: [
        { exercise_id: ex.Agachamento, ordem: 1, reps: 5, peso_kg: 85, tipo: "valida", prescribed_pct: 65, amrap: false },
        { exercise_id: ex.Agachamento, ordem: 2, reps: 9, peso_kg: 110, tipo: "valida", prescribed_pct: 85, amrap: true },
      ],
    });

    expect(await marcasAmrap(db, USER, ex.Agachamento)).toEqual([{ peso_kg: 110, reps: 9 }]);
  });

  it("devolve vazio para exercício sem histórico", async () => {
    const { ex } = await programaPadrao();
    expect(await marcasAmrap(db, USER, ex.Supino)).toEqual([]);
  });
});

describe("ajustes", () => {
  it("atualiza o TM inicial de um levantamento", async () => {
    const { programa } = await programaPadrao();
    const lifts = await listLevantamentos(db, USER, programa);

    await atualizarTM(db, lifts[0].id, 137.5);
    const depois = await listLevantamentos(db, USER, programa);
    expect(depois[0].tm_kg).toBe(137.5);
  });

  it("atualiza o incremento de anilha", async () => {
    const { programa } = await programaPadrao();
    await atualizarIncremento(db, USER, programa.id, 5);
    expect((await getProgramaAtivo(db, USER))?.incremento_kg).toBe(5);
  });

  it("o incremento novo muda o arredondamento do TM vigente", async () => {
    const { programa } = await programaPadrao();
    await atualizarIncremento(db, USER, programa.id, 5);
    const atualizado = (await getProgramaAtivo(db, USER))!;
    const lifts = await listLevantamentos(db, USER, atualizado);
    expect(lifts.every((l) => l.tm_kg % 5 === 0 || l.tm_kg === l.tm_inicial_kg)).toBe(true);
  });
});
