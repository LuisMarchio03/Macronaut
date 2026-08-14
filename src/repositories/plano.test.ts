import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { montarRascunho } from "../domain/plano-parse";
import type { Grade, RascunhoPlano } from "../domain/plano-types";
import {
  addAguaNoBloco,
  aguaPorBloco,
  ativarPlano,
  contarChecksPorDia,
  deletarPlano,
  getPlanoAtivo,
  importarPlano,
  listBlocos,
  listChecksDoDia,
  listItensPorBloco,
  listMacros,
  listPlanos,
  listSubstituicoes,
  marcarBloco,
} from "./plano";

const AQUI = fileURLToPath(import.meta.url);
const REAL = JSON.parse(
  readFileSync(resolve(dirname(AQUI), "../../test/fixtures/plano-cutting-real.json"), "utf-8"),
) as Record<string, Grade>;

const rascunhoReal = (): RascunhoPlano =>
  montarRascunho({
    plano: REAL["Plano"],
    macros: REAL["Macros"],
    substituicoes: REAL["Substituicoes"],
  }).rascunho;

const USER = 1;
let db: Client;

beforeEach(async () => {
  db = await createTestDb();
});

describe("importarPlano", () => {
  it("grava o plano inteiro e o deixa ativo", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");

    expect(plano.nome).toBe("PLANO DE CUTTING - LUÍS GABRIEL");
    expect(plano.ativo).toBe(true);
    expect(plano).toMatchObject({ kcal_min: 1700, kcal_max: 2000, agua_ml_alvo: 3000 });

    const ativo = await getPlanoAtivo(db, USER);
    expect(ativo?.id).toBe(plano.id);
  });

  it("grava blocos, itens, macros e substituições", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");

    const blocos = await listBlocos(db, plano.id);
    expect(blocos).toHaveLength(9); // 4 refeições + 4 águas + 1 suplemento

    const itens = await listItensPorBloco(db, plano.id);
    const porNome = Object.fromEntries(
      blocos.map((b) => [`${b.nome} ${b.hora_inicio ?? b.ancora}`, itens.get(b.id)?.length ?? 0]),
    );
    expect(porNome).toEqual({
      "Café da Manhã 07:00": 5,
      "ÁGUA 08:00": 1,
      "Almoço 12:00": 4,
      "ÁGUA 13:00": 1,
      "Lanche da Tarde 15:00": 3,
      "ÁGUA 17:00": 1,
      "Janta 19:00": 3,
      "ÁGUA 20:00": 1,
      "CREATINA Após almoço": 1,
    });

    expect(await listMacros(db, plano.id)).toHaveLength(4);
    expect(await listSubstituicoes(db, plano.id)).toHaveLength(39);
  });

  it("ordena os blocos pelo relógio, com os ancorados no fim", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const blocos = await listBlocos(db, plano.id);

    const comHora = blocos.filter((b) => b.hora_inicio !== null).map((b) => b.hora_inicio!);
    expect(comHora).toEqual([...comHora].sort());

    // "Após almoço" não tem relógio; vai para o fim em vez de ser inventado
    // um horário para ele.
    expect(blocos.at(-1)?.tipo).toBe("suplemento");
    expect(blocos.at(-1)?.ancora).toBe("Após almoço");
  });

  it("desativa o plano anterior sem apagá-lo", async () => {
    // Apagar reescreveria o histórico de aderência de quem troca de dieta.
    const antigo = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const novo = await importarPlano(db, USER, rascunhoReal(), "csv");

    expect((await getPlanoAtivo(db, USER))?.id).toBe(novo.id);

    const todos = await listPlanos(db, USER);
    expect(todos).toHaveLength(2);
    expect(todos.find((p) => p.id === antigo.id)?.ativo).toBe(false);
  });

  it("não mistura planos de usuários diferentes", async () => {
    await importarPlano(db, USER, rascunhoReal(), "xlsx");
    expect(await getPlanoAtivo(db, 99)).toBeNull();
    expect(await listPlanos(db, 99)).toEqual([]);
  });

  it("devolve null quando o usuário não tem plano", async () => {
    expect(await getPlanoAtivo(db, USER)).toBeNull();
  });
});

describe("ativarPlano", () => {
  it("troca qual plano está ativo", async () => {
    const a = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const b = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    expect((await getPlanoAtivo(db, USER))?.id).toBe(b.id);

    await ativarPlano(db, USER, a.id);
    expect((await getPlanoAtivo(db, USER))?.id).toBe(a.id);

    const todos = await listPlanos(db, USER);
    expect(todos.filter((p) => p.ativo)).toHaveLength(1);
  });

  it("não deixa outro usuário ativar um plano alheio", async () => {
    const a = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    await ativarPlano(db, 99, a.id);
    expect(await getPlanoAtivo(db, 99)).toBeNull();
  });
});

describe("deletarPlano", () => {
  it("apaga o plano e, em cascata, blocos, itens, macros e trocas", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    await deletarPlano(db, USER, plano.id);

    expect(await listPlanos(db, USER)).toEqual([]);
    expect(await listBlocos(db, plano.id)).toEqual([]);
    expect(await listMacros(db, plano.id)).toEqual([]);
    expect(await listSubstituicoes(db, plano.id)).toEqual([]);
    expect([...(await listItensPorBloco(db, plano.id)).keys()]).toEqual([]);
  });

  it("não apaga plano de outro usuário", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    await deletarPlano(db, 99, plano.id);
    expect(await listPlanos(db, USER)).toHaveLength(1);
  });
});

describe("marcarBloco", () => {
  const DIA = "2026-08-14";

  it("marca um bloco como feito", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const bloco = (await listBlocos(db, plano.id))[0];

    await marcarBloco(db, USER, plano.id, DIA, bloco.id, true);

    const checks = await listChecksDoDia(db, USER, DIA);
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ block_id: bloco.id, feito: true, swap_id: null });
  });

  it("atualiza em vez de duplicar quando marca de novo", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const bloco = (await listBlocos(db, plano.id))[0];
    const swap = (await listSubstituicoes(db, plano.id))[0];

    await marcarBloco(db, USER, plano.id, DIA, bloco.id, true);
    await marcarBloco(db, USER, plano.id, DIA, bloco.id, true, swap.id);
    await marcarBloco(db, USER, plano.id, DIA, bloco.id, false);

    const checks = await listChecksDoDia(db, USER, DIA);
    expect(checks).toHaveLength(1);
    expect(checks[0].feito).toBe(false);
  });

  it("guarda qual substituição foi escolhida", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const bloco = (await listBlocos(db, plano.id))[0];
    const swap = (await listSubstituicoes(db, plano.id))[0];

    await marcarBloco(db, USER, plano.id, DIA, bloco.id, true, swap.id);
    expect((await listChecksDoDia(db, USER, DIA))[0].swap_id).toBe(swap.id);
  });

  it("separa os dias", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const bloco = (await listBlocos(db, plano.id))[0];

    await marcarBloco(db, USER, plano.id, DIA, bloco.id, true);
    await marcarBloco(db, USER, plano.id, "2026-08-15", bloco.id, true);

    expect(await listChecksDoDia(db, USER, DIA)).toHaveLength(1);
    expect(await listChecksDoDia(db, USER, "2026-08-15")).toHaveLength(1);
  });
});

describe("contarChecksPorDia", () => {
  it("conta só refeições cumpridas, ignorando água e suplemento", async () => {
    // A aderência que interessa é a das refeições; contar água junto inflaria
    // o número e faria "4 de 4" significar coisas diferentes a cada dia.
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const blocos = await listBlocos(db, plano.id);
    const refeicao = blocos.find((b) => b.tipo === "refeicao")!;
    const agua = blocos.find((b) => b.tipo === "agua")!;
    const suplemento = blocos.find((b) => b.tipo === "suplemento")!;

    await marcarBloco(db, USER, plano.id, "2026-08-14", refeicao.id, true);
    await marcarBloco(db, USER, plano.id, "2026-08-14", agua.id, true);
    await marcarBloco(db, USER, plano.id, "2026-08-14", suplemento.id, true);

    const mapa = await contarChecksPorDia(db, USER, "2026-08-01", "2026-08-31");
    expect(mapa.get("2026-08-14")).toBe(1);
  });

  it("não conta bloco desmarcado", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const refeicao = (await listBlocos(db, plano.id)).find((b) => b.tipo === "refeicao")!;
    await marcarBloco(db, USER, plano.id, "2026-08-14", refeicao.id, false);

    const mapa = await contarChecksPorDia(db, USER, "2026-08-01", "2026-08-31");
    expect(mapa.get("2026-08-14")).toBeUndefined();
  });

  it("respeita o intervalo pedido", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const refeicao = (await listBlocos(db, plano.id)).find((b) => b.tipo === "refeicao")!;
    await marcarBloco(db, USER, plano.id, "2026-07-01", refeicao.id, true);

    const mapa = await contarChecksPorDia(db, USER, "2026-08-01", "2026-08-31");
    expect(mapa.size).toBe(0);
  });
});

describe("água por período", () => {
  const DIA = "2026-08-14";

  it("credita a água ao bloco do período", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const aguas = (await listBlocos(db, plano.id)).filter((b) => b.tipo === "agua");

    await addAguaNoBloco(db, USER, DIA, 200, aguas[0].id);
    await addAguaNoBloco(db, USER, DIA, 300, aguas[0].id);
    await addAguaNoBloco(db, USER, DIA, 500, aguas[1].id);

    const mapa = await aguaPorBloco(db, USER, DIA);
    expect(mapa.get(aguas[0].id)).toBe(500);
    expect(mapa.get(aguas[1].id)).toBe(500);
  });

  it("ignora água registrada sem período", async () => {
    // Registro avulso continua contando no total do dia (`water_log`), mas não
    // pode ser atribuído a um período que o usuário não escolheu.
    await importarPlano(db, USER, rascunhoReal(), "xlsx");
    await addAguaNoBloco(db, USER, DIA, 250, null);

    expect((await aguaPorBloco(db, USER, DIA)).size).toBe(0);

    const rs = await db.execute({
      sql: "SELECT COALESCE(SUM(ml),0) AS t FROM water_log WHERE user_id=? AND data=?",
      args: [USER, DIA],
    });
    expect(rs.rows[0].t).toBe(250);
  });

  it("separa os dias", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const agua = (await listBlocos(db, plano.id)).find((b) => b.tipo === "agua")!;

    await addAguaNoBloco(db, USER, DIA, 200, agua.id);
    await addAguaNoBloco(db, USER, "2026-08-15", 800, agua.id);

    expect((await aguaPorBloco(db, USER, DIA)).get(agua.id)).toBe(200);
    expect((await aguaPorBloco(db, USER, "2026-08-15")).get(agua.id)).toBe(800);
  });
});
