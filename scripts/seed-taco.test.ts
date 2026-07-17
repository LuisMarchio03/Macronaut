import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../test/helpers/test-db";
import { importarTaco, backfillNutrientes, type TacoItem } from "./seed-taco";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

const itens = [
  { nome: "Arroz", base_qty_g: 100, kcal: 128, prot_g: 2.5, carb_g: 28, gord_g: 0.2 },
];

const comNutrientes: TacoItem[] = [
  { nome: "Arroz", base_qty_g: 100, kcal: 128, prot_g: 2.5, carb_g: 28, gord_g: 0.2,
    fibra_g: 2.7, sodio_mg: 1.2, categoria: "Cereais e derivados" },
];

describe("importarTaco", () => {
  it("importa itens da TACO como source=taco", async () => {
    const n = await importarTaco(db, itens);
    expect(n).toBe(1);
    const rs = await db.execute("SELECT source FROM foods WHERE nome='Arroz'");
    expect(rs.rows[0].source).toBe("taco");
  });

  it("é idempotente por nome (não duplica na segunda rodada)", async () => {
    await importarTaco(db, itens);
    const n2 = await importarTaco(db, itens);
    expect(n2).toBe(0);
    const rs = await db.execute("SELECT COUNT(*) AS n FROM foods");
    expect(rs.rows[0].n).toBe(1);
  });

  it("aplica defaults para campos ausentes (base_qty_g→100, macros→0)", async () => {
    // Simula uma linha real de JSON com chaves numéricas ausentes.
    const parcial = { nome: "Item Parcial" } as unknown as TacoItem;
    const n = await importarTaco(db, [parcial]);
    expect(n).toBe(1);
    const rs = await db.execute(
      "SELECT base_qty_g, kcal, prot_g, carb_g, gord_g FROM foods WHERE nome='Item Parcial'",
    );
    const row = rs.rows[0];
    expect(row.base_qty_g).toBe(100);
    expect(row.kcal).toBe(0);
    expect(row.prot_g).toBe(0);
    expect(row.carb_g).toBe(0);
    expect(row.gord_g).toBe(0);
  });

  it("importa nutrientes num banco vazio (fibra/sódio/categoria)", async () => {
    await importarTaco(db, comNutrientes);
    const rs = await db.execute("SELECT fibra_g, sodio_mg, categoria FROM foods WHERE nome='Arroz'");
    expect(rs.rows[0].fibra_g).toBe(2.7);
    expect(rs.rows[0].sodio_mg).toBe(1.2);
    expect(rs.rows[0].categoria).toBe("Cereais e derivados");
  });
});

describe("backfillNutrientes", () => {
  it("preenche linhas legadas que o seed idempotente pularia", async () => {
    // Simula o banco real do usuário: TACO já seedada ANTES das colunas existirem.
    await importarTaco(db, [
      { nome: "Arroz", base_qty_g: 100, kcal: 128, prot_g: 2.5, carb_g: 28, gord_g: 0.2 },
    ]);
    const antes = await db.execute("SELECT fibra_g FROM foods WHERE nome='Arroz'");
    expect(antes.rows[0].fibra_g).toBeNull();

    // O seed sozinho não conserta: ele pula o que já existe.
    expect(await importarTaco(db, comNutrientes)).toBe(0);
    const aindaNulo = await db.execute("SELECT fibra_g FROM foods WHERE nome='Arroz'");
    expect(aindaNulo.rows[0].fibra_g).toBeNull();

    // O backfill conserta.
    const n = await backfillNutrientes(db, comNutrientes);
    expect(n).toBe(1);
    const depois = await db.execute("SELECT fibra_g, categoria FROM foods WHERE nome='Arroz'");
    expect(depois.rows[0].fibra_g).toBe(2.7);
    expect(depois.rows[0].categoria).toBe("Cereais e derivados");
  });

  it("é idempotente: 2ª rodada não atualiza nada", async () => {
    await importarTaco(db, comNutrientes);
    expect(await backfillNutrientes(db, comNutrientes)).toBe(0);
  });

  it("não toca em alimentos custom do usuário", async () => {
    await db.execute({
      sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
            VALUES ('Arroz', 'custom', 100, 999, 9, 9, 9, ?)`,
      args: [new Date().toISOString()],
    });
    await backfillNutrientes(db, comNutrientes);
    const rs = await db.execute("SELECT fibra_g FROM foods WHERE nome='Arroz' AND source='custom'");
    expect(rs.rows[0].fibra_g).toBeNull();
  });

  it("preenche a coluna que falta sem sobrescrever a que você já corrigiu", async () => {
    // Estado parcial: você ajustou a fibra à mão; categoria nunca foi preenchida.
    await importarTaco(db, [
      { nome: "Arroz", base_qty_g: 100, kcal: 128, prot_g: 2.5, carb_g: 28, gord_g: 0.2 },
    ]);
    await db.execute("UPDATE foods SET fibra_g=99 WHERE nome='Arroz' AND source='taco'");

    const n = await backfillNutrientes(db, comNutrientes);
    expect(n).toBe(1);

    const rs = await db.execute("SELECT fibra_g, categoria FROM foods WHERE nome='Arroz'");
    expect(rs.rows[0].fibra_g).toBe(99);                          // sua correção sobrevive
    expect(rs.rows[0].categoria).toBe("Cereais e derivados");     // o que faltava entrou
  });

  it("fibra desconhecida fica NULL e NÃO impede a idempotência", async () => {
    // 37% da TACO real tem fiber_g="NA". numOuNulo devolve null nesses casos.
    // Se o WHERE perguntasse "falta algo?" em vez de "tem algo pra preencher?",
    // esses alimentos casariam em TODA rodada e o backfill nunca convergiria.
    const semFibra: TacoItem[] = [
      { nome: "Arroz", base_qty_g: 100, kcal: 128, prot_g: 2.5, carb_g: 28, gord_g: 0.2,
        fibra_g: null, sodio_mg: 1.2, categoria: "Cereais e derivados" },
    ];
    await importarTaco(db, [
      { nome: "Arroz", base_qty_g: 100, kcal: 128, prot_g: 2.5, carb_g: 28, gord_g: 0.2 },
    ]);

    expect(await backfillNutrientes(db, semFibra)).toBe(1);
    const rs = await db.execute("SELECT fibra_g, sodio_mg FROM foods WHERE nome='Arroz'");
    expect(rs.rows[0].fibra_g).toBeNull();   // continua desconhecida, não vira 0
    expect(rs.rows[0].sodio_mg).toBe(1.2);

    // A 2ª rodada não pode achar nada — mesmo com a fibra ainda NULL.
    expect(await backfillNutrientes(db, semFibra)).toBe(0);
  });
});
