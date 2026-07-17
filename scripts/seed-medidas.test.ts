import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../test/helpers/test-db";
import { semearMedidas } from "./seed-medidas";
import type { MedidasDeAlimento } from "./build-medidas";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Arroz, integral, cozido', 'taco', 100, 124, 2.6, 25.8, 1, ?)`,
    args: [new Date().toISOString()],
  });
  await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Feijão, carioca, cozido', 'taco', 100, 76, 4.8, 13.6, 0.5, ?)`,
    args: [new Date().toISOString()],
  });
});

const confirmada: MedidasDeAlimento = {
  alimento: "Arroz, integral, cozido",
  status: "confirmada",
  candidatos: [{
    pof_codigo: "101", pof_descricao: "ARROZ (POLIDO, PARBOILIZADO)",
    medidas: [
      { nome: "colher de sopa", qty_base: 25, pof_codigo: "101" },
      { nome: "concha", qty_base: 100, pof_codigo: "101" },
    ],
  }],
};

// ATENÇÃO ao desenho deste fixture: os dois candidatos têm uma medida de MESMO
// NOME com gramas diferentes ("concha": 140 vs 35). É o caso real — medido, os
// 313 alimentos candidatos TODOS têm colisão de nome — e é exatamente o que uma
// versão anterior deste seed quebrava, dedupando por nome e descartando 73,5%
// das medidas. Um fixture com nomes distintos passaria e não provaria nada.
const candidata: MedidasDeAlimento = {
  alimento: "Feijão, carioca, cozido",
  status: "candidata",
  candidatos: [
    { pof_codigo: "201|crozido(a)", pof_descricao: "FEIJAO CARIOCA/CARIOQUINHA · CROZIDO(A)",
      medidas: [
        { nome: "concha", qty_base: 140, pof_codigo: "201|crozido(a)" },
        { nome: "colher de sopa", qty_base: 25, pof_codigo: "201|crozido(a)" },
      ] },
    { pof_codigo: "202|crozido(a)", pof_descricao: "FEIJAO TROPEIRO · CROZIDO(A)",
      medidas: [
        { nome: "concha", qty_base: 35, pof_codigo: "202|crozido(a)" },
      ] },
  ],
};

describe("semearMedidas", () => {
  it("insere medidas confirmadas com source=pof", async () => {
    const n = await semearMedidas(db, [confirmada]);
    expect(n).toBe(2);
    const rs = await db.execute("SELECT nome, qty_base, source, status, pof_codigo FROM food_measures ORDER BY nome");
    expect(rs.rows).toHaveLength(2);
    expect(rs.rows[0].nome).toBe("colher de sopa");
    expect(rs.rows[0].source).toBe("pof");
    expect(rs.rows[0].status).toBe("confirmada");
    expect(rs.rows[0].pof_codigo).toBe("101");
  });

  it("insere medidas de TODOS os candidatos como 'candidata'", async () => {
    const n = await semearMedidas(db, [candidata]);
    expect(n).toBe(3); // 2 do candidato 201 + 1 do 202
    const rs = await db.execute("SELECT status FROM food_measures");
    expect(rs.rows.every((r) => r.status === "candidata")).toBe(true);
  });

  // REGRESSÃO: a versão anterior dedupava por NOME entre candidatos, então a
  // "concha" do tropeiro sumia. O usuário escolhia tropeiro na desambiguação e
  // recebia a concha do carioca (140 g em vez de 35 g), calado. Medido no dado
  // real: 18.268 das 24.838 medidas descartadas assim (73,5%).
  it("REGRESSÃO: guarda a MESMA medida de candidatos diferentes, com gramas diferentes", async () => {
    await semearMedidas(db, [candidata]);
    const rs = await db.execute(
      "SELECT qty_base, pof_codigo FROM food_measures WHERE nome='concha' ORDER BY qty_base",
    );
    expect(rs.rows).toHaveLength(2); // as duas conchas sobrevivem
    expect(rs.rows[0].qty_base).toBe(35);
    expect(rs.rows[0].pof_codigo).toBe("202|crozido(a)");
    expect(rs.rows[1].qty_base).toBe(140);
    expect(rs.rows[1].pof_codigo).toBe("201|crozido(a)");
  });

  it("é idempotente por (food_id, nome, pof_codigo)", async () => {
    const n1 = await semearMedidas(db, [candidata]);
    const n2 = await semearMedidas(db, [candidata]);
    expect(n1).toBe(3);
    expect(n2).toBe(0);
    const rs = await db.execute("SELECT COUNT(*) AS n FROM food_measures");
    expect(rs.rows[0].n).toBe(3);
  });

  it("ignora alimento que não existe no banco", async () => {
    const n = await semearMedidas(db, [{ ...confirmada, alimento: "Não Existe" }]);
    expect(n).toBe(0);
  });

  it("não sobrescreve medida manual do usuário com a da POF", async () => {
    await db.execute(
      `INSERT INTO food_measures (food_id, nome, qty_base, ordem, source, status)
       VALUES (1, 'concha', 999, 0, 'manual', 'confirmada')`,
    );
    await semearMedidas(db, [confirmada]);
    const rs = await db.execute("SELECT qty_base, source FROM food_measures WHERE nome='concha'");
    expect(rs.rows).toHaveLength(1);
    expect(rs.rows[0].qty_base).toBe(999);
    expect(rs.rows[0].source).toBe("manual");
  });

  // A regra da medida manual vale contra TODOS os candidatos, não só o primeiro:
  // se a "concha" é sua, nenhuma concha da POF entra, venha de onde vier.
  it("medida manual bloqueia a mesma medida de todos os candidatos", async () => {
    await db.execute({
      sql: `INSERT INTO food_measures (food_id, nome, qty_base, ordem, source, status)
            VALUES (?, 'concha', 999, 0, 'manual', 'confirmada')`,
      args: [2], // Feijão
    });
    const n = await semearMedidas(db, [candidata]);
    expect(n).toBe(1); // só a "colher de sopa" do 201; as duas conchas ficam de fora
    const rs = await db.execute({
      sql: "SELECT nome, qty_base, source FROM food_measures WHERE food_id=? ORDER BY nome",
      args: [2],
    });
    expect(rs.rows.map((r) => r.nome)).toEqual(["colher de sopa", "concha"]);
    expect(rs.rows.find((r) => r.nome === "concha")?.qty_base).toBe(999);
    expect(rs.rows.find((r) => r.nome === "concha")?.source).toBe("manual");
  });
});
