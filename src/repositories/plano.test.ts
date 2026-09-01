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
  listTrocasDoDia,
  marcarBloco,
  migrarTrocasDeBloco,
  removerTroca,
  adicionarTroca,
  dispensarItem,
  removerUmaTroca,
  salvarTroca,
} from "./plano";
import { createEntry, listEntriesByDate } from "./entries";
import { listMeals } from "./meals";

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

    const blocos = await listBlocos(db, USER, plano.id);
    expect(blocos).toHaveLength(9); // 4 refeições + 4 águas + 1 suplemento

    const itens = await listItensPorBloco(db, USER, plano.id);
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

    expect(await listMacros(db, USER, plano.id)).toHaveLength(4);
    expect(await listSubstituicoes(db, USER, plano.id)).toHaveLength(39);
  });

  it("ordena os blocos pelo relógio, com os ancorados no fim", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const blocos = await listBlocos(db, USER, plano.id);

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
    expect(await listBlocos(db, USER, plano.id)).toEqual([]);
    expect(await listMacros(db, USER, plano.id)).toEqual([]);
    expect(await listSubstituicoes(db, USER, plano.id)).toEqual([]);
    expect([...(await listItensPorBloco(db, USER, plano.id)).keys()]).toEqual([]);
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
    const bloco = (await listBlocos(db, USER, plano.id))[0];

    await marcarBloco(db, USER, plano.id, DIA, bloco.id, true);

    const checks = await listChecksDoDia(db, USER, DIA);
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ block_id: bloco.id, feito: true, swap_id: null });
  });

  it("atualiza em vez de duplicar quando marca de novo", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const bloco = (await listBlocos(db, USER, plano.id))[0];
    const swap = (await listSubstituicoes(db, USER, plano.id))[0];

    await marcarBloco(db, USER, plano.id, DIA, bloco.id, true);
    await marcarBloco(db, USER, plano.id, DIA, bloco.id, true, swap.id);
    await marcarBloco(db, USER, plano.id, DIA, bloco.id, false);

    const checks = await listChecksDoDia(db, USER, DIA);
    expect(checks).toHaveLength(1);
    expect(checks[0].feito).toBe(false);
  });

  it("guarda qual substituição foi escolhida", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const bloco = (await listBlocos(db, USER, plano.id))[0];
    const swap = (await listSubstituicoes(db, USER, plano.id))[0];

    await marcarBloco(db, USER, plano.id, DIA, bloco.id, true, swap.id);
    expect((await listChecksDoDia(db, USER, DIA))[0].swap_id).toBe(swap.id);
  });

  it("separa os dias", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const bloco = (await listBlocos(db, USER, plano.id))[0];

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
    const blocos = await listBlocos(db, USER, plano.id);
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
    const refeicao = (await listBlocos(db, USER, plano.id)).find((b) => b.tipo === "refeicao")!;
    await marcarBloco(db, USER, plano.id, "2026-08-14", refeicao.id, false);

    const mapa = await contarChecksPorDia(db, USER, "2026-08-01", "2026-08-31");
    expect(mapa.get("2026-08-14")).toBeUndefined();
  });

  it("respeita o intervalo pedido", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const refeicao = (await listBlocos(db, USER, plano.id)).find((b) => b.tipo === "refeicao")!;
    await marcarBloco(db, USER, plano.id, "2026-07-01", refeicao.id, true);

    const mapa = await contarChecksPorDia(db, USER, "2026-08-01", "2026-08-31");
    expect(mapa.size).toBe(0);
  });
});

describe("água por período", () => {
  const DIA = "2026-08-14";

  it("credita a água ao bloco do período", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
    const aguas = (await listBlocos(db, USER, plano.id)).filter((b) => b.tipo === "agua");

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
    const agua = (await listBlocos(db, USER, plano.id)).find((b) => b.tipo === "agua")!;

    await addAguaNoBloco(db, USER, DIA, 200, agua.id);
    await addAguaNoBloco(db, USER, "2026-08-15", 800, agua.id);

    expect((await aguaPorBloco(db, USER, DIA)).get(agua.id)).toBe(200);
    expect((await aguaPorBloco(db, USER, "2026-08-15")).get(agua.id)).toBe(800);
  });
});

/* ══════════════════════════════════════════════════════════════════
   TROCA POR ITEM
   ══════════════════════════════════════════════════════════════════ */

const DIA_T = "2026-08-31";

/** Plano importado + o Café da Manhã com seus itens, que é o cenário de todos. */
async function cenario(db: Client) {
  const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");
  const blocos = await listBlocos(db, USER, plano.id);
  const cafe = blocos.find((b) => b.nome === "Café da Manhã")!;
  const itens = (await listItensPorBloco(db, USER, plano.id)).get(cafe.id)!;
  const swaps = await listSubstituicoes(db, USER, plano.id);
  return { plano, cafe, itens, swaps };
}

async function criarAlimento(db: Client, nome: string, kcal = 100): Promise<number> {
  const rs = await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES (?, 'custom', 100, ?, 0, 0, 0, '')`,
    args: [nome, kcal],
  });
  return Number(rs.lastInsertRowid);
}

describe("trocas por item", () => {
  it("grava uma troca por substituição do plano e a lê com nome e porção", async () => {
    const { cafe, itens, swaps } = await cenario(db);
    const carbo = itens.find((i) => i.categoria === "carboidrato")!;
    const tapioca = swaps.find((s) => s.alimento.includes("Tapioca"))!;

    await salvarTroca(db, USER, {
      data: DIA_T, block_id: cafe.id, item_id: carbo.id, swap_id: tapioca.id,
    });

    const trocas = await listTrocasDoDia(db, USER, DIA_T);
    expect(trocas).toHaveLength(1);
    expect(trocas[0]).toMatchObject({
      item_id: carbo.id,
      origem: "plano",
      swap_id: tapioca.id,
      nome: tapioca.alimento,
      porcao: tapioca.porcao,
      kcal: tapioca.kcal,
    });
  });

  it("mais de um item da MESMA refeição pode ser trocado", async () => {
    // É o bug que abriu esta frente: `plan_checks.swap_id` era uma coluna só.
    const { cafe, itens, swaps } = await cenario(db);
    const carbo = itens.find((i) => i.categoria === "carboidrato")!;
    const fruta = itens.find((i) => i.categoria === "fruta")!;

    await salvarTroca(db, USER, {
      data: DIA_T, block_id: cafe.id, item_id: carbo.id,
      swap_id: swaps.find((s) => s.categoria === "carboidrato")!.id,
    });
    await salvarTroca(db, USER, {
      data: DIA_T, block_id: cafe.id, item_id: fruta.id,
      swap_id: swaps.find((s) => s.categoria === "fruta")!.id,
    });

    expect(await listTrocasDoDia(db, USER, DIA_T)).toHaveLength(2);
  });

  it("trocar o mesmo item de novo corrige, não acumula", async () => {
    const { cafe, itens, swaps } = await cenario(db);
    const carbo = itens.find((i) => i.categoria === "carboidrato")!;
    const doCarbo = swaps.filter((s) => s.categoria === "carboidrato" && s.block_nome === "Café da Manhã");

    await salvarTroca(db, USER, { data: DIA_T, block_id: cafe.id, item_id: carbo.id, swap_id: doCarbo[0].id });
    await salvarTroca(db, USER, { data: DIA_T, block_id: cafe.id, item_id: carbo.id, swap_id: doCarbo[1].id });

    const trocas = await listTrocasDoDia(db, USER, DIA_T);
    expect(trocas).toHaveLength(1);
    expect(trocas[0].swap_id).toBe(doCarbo[1].id);
  });

  it("grava uma troca por alimento do catálogo, com medida e quantidade", async () => {
    const { cafe, itens } = await cenario(db);
    const foodId = await criarAlimento(db, "Tapioca goma", 240);

    await salvarTroca(db, USER, {
      data: DIA_T, block_id: cafe.id, item_id: itens[0].id,
      food_id: foodId, qty_g: 50, medidas: 2, kcal: 120,
    });

    const t = (await listTrocasDoDia(db, USER, DIA_T))[0];
    expect(t).toMatchObject({ origem: "catalogo", nome: "Tapioca goma", food_id: foodId, qty_g: 50, kcal: 120 });
    expect(t.porcao).toBe("50 g");
  });

  it("grava uma troca escrita à mão, com e sem caloria", async () => {
    const { cafe, itens } = await cenario(db);

    await salvarTroca(db, USER, { data: DIA_T, block_id: cafe.id, item_id: itens[0].id, texto: "Pão da padaria", kcal: 140 });
    await salvarTroca(db, USER, { data: DIA_T, block_id: cafe.id, item_id: itens[1].id, texto: "O que tinha na geladeira" });

    const trocas = await listTrocasDoDia(db, USER, DIA_T);
    expect(trocas.find((t) => t.item_id === itens[0].id)).toMatchObject({ origem: "texto", nome: "Pão da padaria", kcal: 140 });
    expect(trocas.find((t) => t.item_id === itens[1].id)).toMatchObject({ origem: "texto", kcal: null, food_id: null });
  });

  it("remover a troca devolve o item ao plano", async () => {
    const { cafe, itens, swaps } = await cenario(db);
    await salvarTroca(db, USER, { data: DIA_T, block_id: cafe.id, item_id: itens[0].id, swap_id: swaps[0].id });

    await removerTroca(db, USER, DIA_T, itens[0].id);

    expect(await listTrocasDoDia(db, USER, DIA_T)).toEqual([]);
  });

  it("a troca é do dia: outro dia não a enxerga", async () => {
    const { cafe, itens, swaps } = await cenario(db);
    await salvarTroca(db, USER, { data: DIA_T, block_id: cafe.id, item_id: itens[0].id, swap_id: swaps[0].id });

    expect(await listTrocasDoDia(db, USER, "2026-09-01")).toEqual([]);
  });

  it("a troca é do usuário: outro usuário não a enxerga", async () => {
    const { cafe, itens, swaps } = await cenario(db);
    await salvarTroca(db, USER, { data: DIA_T, block_id: cafe.id, item_id: itens[0].id, swap_id: swaps[0].id });

    expect(await listTrocasDoDia(db, 99, DIA_T)).toEqual([]);
  });
});

describe("marcarBloco lança no diário", () => {
  it("grava entries dos itens que resolvem para alimento, e ignora os que não", async () => {
    const { plano, cafe, itens } = await cenario(db);
    const foodId = await criarAlimento(db, "Ovo de galinha");
    // Só o primeiro item ganha alimento casado; os outros quatro não têm.
    await db.execute({ sql: "UPDATE plan_items SET food_id=?, qty_g=? WHERE id=?", args: [foodId, 150, itens[0].id] });

    await marcarBloco(db, USER, plano.id, DIA_T, cafe.id, true);

    const entries = await listEntriesByDate(db, USER, DIA_T);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ food_id: foodId, qty_g: 150, label: itens[0].texto });
  });

  it("a troca do dia é o que vai para o diário, não o item original", async () => {
    const { plano, cafe, itens } = await cenario(db);
    const original = await criarAlimento(db, "Pão integral");
    const trocado = await criarAlimento(db, "Tapioca goma");
    await db.execute({ sql: "UPDATE plan_items SET food_id=?, qty_g=? WHERE id=?", args: [original, 30, itens[0].id] });

    await salvarTroca(db, USER, {
      data: DIA_T, block_id: cafe.id, item_id: itens[0].id, food_id: trocado, qty_g: 50, kcal: 120,
    });
    await marcarBloco(db, USER, plano.id, DIA_T, cafe.id, true);

    const entries = await listEntriesByDate(db, USER, DIA_T);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ food_id: trocado, qty_g: 50 });
  });

  it("desmarcar apaga o que aquele bloco lançou, e só isso", async () => {
    const { plano, cafe, itens } = await cenario(db);
    const foodId = await criarAlimento(db, "Ovo de galinha");
    await db.execute({ sql: "UPDATE plan_items SET food_id=?, qty_g=? WHERE id=?", args: [foodId, 150, itens[0].id] });
    // Um registro digitado à mão, que não pode ser tocado.
    await createEntry(db, USER, {
      data: DIA_T, meal_id: null, food_id: foodId, qty_g: 42,
      measure_id: null, measure_count: null, label: "à mão",
    });

    await marcarBloco(db, USER, plano.id, DIA_T, cafe.id, true);
    expect(await listEntriesByDate(db, USER, DIA_T)).toHaveLength(2);

    await marcarBloco(db, USER, plano.id, DIA_T, cafe.id, false);
    const sobrou = await listEntriesByDate(db, USER, DIA_T);
    expect(sobrou).toHaveLength(1);
    expect(sobrou[0].label).toBe("à mão");
  });

  it("marcar duas vezes não duplica os lançamentos", async () => {
    const { plano, cafe, itens } = await cenario(db);
    const foodId = await criarAlimento(db, "Ovo de galinha");
    await db.execute({ sql: "UPDATE plan_items SET food_id=?, qty_g=? WHERE id=?", args: [foodId, 150, itens[0].id] });

    await marcarBloco(db, USER, plano.id, DIA_T, cafe.id, true);
    await marcarBloco(db, USER, plano.id, DIA_T, cafe.id, true);

    expect(await listEntriesByDate(db, USER, DIA_T)).toHaveLength(1);
  });

  it("credita o lançamento à refeição de mesmo nome, criando-a se não existir", async () => {
    const { plano, cafe, itens } = await cenario(db);
    const foodId = await criarAlimento(db, "Ovo de galinha");
    await db.execute({ sql: "UPDATE plan_items SET food_id=?, qty_g=? WHERE id=?", args: [foodId, 150, itens[0].id] });

    await marcarBloco(db, USER, plano.id, DIA_T, cafe.id, true);

    const entries = await listEntriesByDate(db, USER, DIA_T);
    const refeicoes = await listMeals(db, USER);
    const daVez = refeicoes.find((m) => m.id === entries[0].meal_id);
    expect(daVez?.nome).toBe("Café da Manhã");

    // De novo: reaproveita a refeição, não cria uma segunda.
    await marcarBloco(db, USER, plano.id, DIA_T, cafe.id, false);
    await marcarBloco(db, USER, plano.id, DIA_T, cafe.id, true);
    expect((await listMeals(db, USER)).filter((m) => m.nome === "Café da Manhã")).toHaveLength(1);
  });

  it("bloco sem nenhum item casado marca como feito e não lança nada", async () => {
    const { plano, cafe } = await cenario(db);

    await marcarBloco(db, USER, plano.id, DIA_T, cafe.id, true);

    expect((await listChecksDoDia(db, USER, DIA_T))[0]).toMatchObject({ feito: true });
    expect(await listEntriesByDate(db, USER, DIA_T)).toEqual([]);
  });
});

describe("migrarTrocasDeBloco", () => {
  it("converte a troca antiga de bloco na troca do item de mesma categoria", async () => {
    const { plano, cafe, itens, swaps } = await cenario(db);
    const carboSwap = swaps.find((s) => s.block_nome === "Café da Manhã" && s.categoria === "carboidrato")!;
    // O jeito antigo: uma troca por bloco, gravada em `plan_checks`.
    await marcarBloco(db, USER, plano.id, DIA_T, cafe.id, true, carboSwap.id);

    expect(await migrarTrocasDeBloco(db)).toBe(1);

    const trocas = await listTrocasDoDia(db, USER, DIA_T);
    expect(trocas).toHaveLength(1);
    expect(trocas[0]).toMatchObject({
      item_id: itens.find((i) => i.categoria === "carboidrato")!.id,
      swap_id: carboSwap.id,
      origem: "plano",
    });
  });

  it("é idempotente: rodar de novo não migra nada", async () => {
    const { plano, cafe, swaps } = await cenario(db);
    const s = swaps.find((x) => x.block_nome === "Café da Manhã" && x.categoria === "fruta")!;
    await marcarBloco(db, USER, plano.id, DIA_T, cafe.id, true, s.id);

    expect(await migrarTrocasDeBloco(db)).toBe(1);
    expect(await migrarTrocasDeBloco(db)).toBe(0);
    expect(await listTrocasDoDia(db, USER, DIA_T)).toHaveLength(1);
  });

  it("não sobrescreve uma troca que já existe para aquele item", async () => {
    const { plano, cafe, itens, swaps } = await cenario(db);
    const carbo = itens.find((i) => i.categoria === "carboidrato")!;
    const doCarbo = swaps.filter((x) => x.block_nome === "Café da Manhã" && x.categoria === "carboidrato");
    await marcarBloco(db, USER, plano.id, DIA_T, cafe.id, true, doCarbo[0].id);
    await salvarTroca(db, USER, { data: DIA_T, block_id: cafe.id, item_id: carbo.id, texto: "escolhi outra coisa" });

    expect(await migrarTrocasDeBloco(db)).toBe(0);
    expect((await listTrocasDoDia(db, USER, DIA_T))[0].nome).toBe("escolhi outra coisa");
  });

  it("bloco sem item da categoria do swap é ignorado, sem quebrar", async () => {
    const { plano, cafe, swaps } = await cenario(db);
    // "vegetal" não existe no Café da Manhã — o swap é da Janta.
    const vegetal = swaps.find((x) => x.categoria === "vegetal")!;
    await marcarBloco(db, USER, plano.id, DIA_T, cafe.id, true, vegetal.id);

    expect(await migrarTrocasDeBloco(db)).toBe(0);
    expect(await listTrocasDoDia(db, USER, DIA_T)).toEqual([]);
  });
});

describe("o plano é do dono, mesmo com o id na mão", () => {
  const OUTRO = 99;

  it("as quatro leituras do plano não atravessam para outro usuário", async () => {
    // O `plan_id` vinha do cliente e nada dizia de quem ele era: qualquer
    // sessão lia o plano de qualquer um chutando o id.
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");

    expect(await listBlocos(db, OUTRO, plano.id)).toEqual([]);
    expect((await listItensPorBloco(db, OUTRO, plano.id)).size).toBe(0);
    expect(await listMacros(db, OUTRO, plano.id)).toEqual([]);
    expect(await listSubstituicoes(db, OUTRO, plano.id)).toEqual([]);
  });

  it("o dono continua vendo o que é dele", async () => {
    const plano = await importarPlano(db, USER, rascunhoReal(), "xlsx");

    expect((await listBlocos(db, USER, plano.id)).length).toBeGreaterThan(0);
    expect((await listItensPorBloco(db, USER, plano.id)).size).toBeGreaterThan(0);
    expect((await listMacros(db, USER, plano.id)).length).toBeGreaterThan(0);
    expect((await listSubstituicoes(db, USER, plano.id)).length).toBeGreaterThan(0);
  });
});

describe("trocas: N por linha e a dispensa", () => {
  it("duas chamadas no mesmo item deixam duas linhas", async () => {
    const { cafe, itens } = await cenario(db);
    const alvo = itens[0];

    await adicionarTroca(db, USER, {
      data: DIA_T, block_id: cafe.id, item_id: alvo.id, texto: "Pão na chapa", kcal: 210,
    });
    await adicionarTroca(db, USER, {
      data: DIA_T, block_id: cafe.id, item_id: alvo.id, texto: "Suco de laranja", kcal: 90,
    });

    const t = await listTrocasDoDia(db, USER, DIA_T);
    expect(t.filter((x) => x.item_id === alvo.id).map((x) => x.nome))
      .toEqual(["Pão na chapa", "Suco de laranja"]);
  });

  it("dispensar apaga as trocas da linha", async () => {
    const { cafe, itens } = await cenario(db);
    const alvo = itens[0];
    await adicionarTroca(db, USER, {
      data: DIA_T, block_id: cafe.id, item_id: alvo.id, texto: "Pão na chapa", kcal: 210,
    });

    await dispensarItem(db, USER, DIA_T, cafe.id, alvo.id);

    const t = await listTrocasDoDia(db, USER, DIA_T);
    expect(t).toHaveLength(1);
    expect(t[0].dispensado).toBe(true);
  });

  it("trocar apaga a dispensa: as duas afirmações não coexistem", async () => {
    const { cafe, itens } = await cenario(db);
    const alvo = itens[0];
    await dispensarItem(db, USER, DIA_T, cafe.id, alvo.id);

    await adicionarTroca(db, USER, {
      data: DIA_T, block_id: cafe.id, item_id: alvo.id, texto: "Pão na chapa", kcal: 210,
    });

    const t = await listTrocasDoDia(db, USER, DIA_T);
    expect(t).toHaveLength(1);
    expect(t[0].dispensado).toBe(false);
  });

  it("dispensar duas vezes não acumula", async () => {
    const { cafe, itens } = await cenario(db);
    await dispensarItem(db, USER, DIA_T, cafe.id, itens[0].id);
    await dispensarItem(db, USER, DIA_T, cafe.id, itens[0].id);

    expect(await listTrocasDoDia(db, USER, DIA_T)).toHaveLength(1);
  });

  it("removerUmaTroca tira uma e deixa as outras", async () => {
    const { cafe, itens } = await cenario(db);
    const alvo = itens[0];
    await adicionarTroca(db, USER, { data: DIA_T, block_id: cafe.id, item_id: alvo.id, texto: "Pão", kcal: 210 });
    await adicionarTroca(db, USER, { data: DIA_T, block_id: cafe.id, item_id: alvo.id, texto: "Suco", kcal: 90 });
    const antes = await listTrocasDoDia(db, USER, DIA_T);

    await removerUmaTroca(db, USER, antes[0].id);

    expect((await listTrocasDoDia(db, USER, DIA_T)).map((x) => x.nome)).toEqual(["Suco"]);
  });

  it("um usuário não apaga a troca do outro", async () => {
    const { cafe, itens } = await cenario(db);
    await adicionarTroca(db, USER, { data: DIA_T, block_id: cafe.id, item_id: itens[0].id, texto: "Pão", kcal: 210 });
    const [t] = await listTrocasDoDia(db, USER, DIA_T);

    await removerUmaTroca(db, 2, t.id);

    expect(await listTrocasDoDia(db, USER, DIA_T)).toHaveLength(1);
  });

  it("marcarBloco lança uma entry por alimento escolhido", async () => {
    const { plano, cafe, itens } = await cenario(db);
    const alvo = itens[0];
    const f1 = await criarAlimento(db, "Pão na chapa", 260);
    const f2 = await criarAlimento(db, "Suco de laranja", 45);
    await adicionarTroca(db, USER, {
      data: DIA_T, block_id: cafe.id, item_id: alvo.id, food_id: f1, qty_g: 80, kcal: 210,
    });
    await adicionarTroca(db, USER, {
      data: DIA_T, block_id: cafe.id, item_id: alvo.id, food_id: f2, qty_g: 200, kcal: 90,
    });

    await marcarBloco(db, USER, plano.id, DIA_T, cafe.id, true);

    const rs = await db.execute({
      sql: "SELECT food_id, qty_g, label FROM food_entries WHERE user_id=? AND data=? AND plan_block_id=? ORDER BY id",
      args: [USER, DIA_T, cafe.id],
    });
    const lancadas = rs.rows.map((r) => r.label as string);
    expect(lancadas).toContain("Pão na chapa");
    expect(lancadas).toContain("Suco de laranja");
  });
});
