import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { DesambiguarPof } from "./desambiguar-pof";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Feijão, carioca, cozido', 'taco', 100, 76, 4.8, 13.6, 0.5, ?)`,
    args: [new Date().toISOString()],
  });
  await db.executeMultiple(`
    INSERT INTO food_measures (food_id, nome, qty_base, ordem, source, status, pof_codigo, pof_descricao)
      VALUES (1, 'concha', 140, 0, 'pof', 'candidata', '201', 'FEIJAO CARIOCA · CROZIDO(A)');
    INSERT INTO food_measures (food_id, nome, qty_base, ordem, source, status, pof_codigo, pof_descricao)
      VALUES (1, 'colher de sopa', 35, 1, 'pof', 'candidata', '202', 'FEIJAO TROPEIRO · CROZIDO(A)');
  `);
});

it("pergunta qual alimento da POF é, mostrando o NOME e as medidas de cada candidato", async () => {
  render(
    <DesambiguarPof foodId={1} foodNome="Feijão, carioca, cozido" baseUnit="g" onResolvido={() => {}} />,
    { wrapper: criarWrapper(db) },
  );
  // Espera pelo conteúdo que depende da query assíncrona (useCandidatos), não
  // pelo cabeçalho estático: o cabeçalho já está no DOM desde o 1º render
  // síncrono, então esperar por ele resolveria antes da query terminar e a
  // checagem seguinte (síncrona) correria na frente dos dados.
  expect(await screen.findByText(/FEIJAO CARIOCA/)).toBeInTheDocument();
  expect(screen.getByText(/qual destes/i)).toBeInTheDocument();
  // O nome da POF é o que discrimina (mockup aprovado, D3):
  expect(screen.getByText(/FEIJAO TROPEIRO/)).toBeInTheDocument();
  // E as medidas embaixo, como confirmação:
  expect(screen.getByText(/concha 140 g/)).toBeInTheDocument();
});

it("escolher um candidato pelo NOME confirma o dele e descarta os outros — sem deletar", async () => {
  const user = userEvent.setup();
  const onResolvido = vi.fn();
  render(
    <DesambiguarPof foodId={1} foodNome="Feijão" baseUnit="g" onResolvido={onResolvido} />,
    { wrapper: criarWrapper(db) },
  );
  await user.click(await screen.findByRole("button", { name: /FEIJAO CARIOCA/ }));

  await waitFor(async () => {
    const rs = await db.execute("SELECT nome, status FROM food_measures ORDER BY nome");
    expect(rs.rows).toHaveLength(2); // item 4: nada deletado
    expect(rs.rows.find((r) => r.nome === "concha")?.status).toBe("confirmada");
    expect(rs.rows.find((r) => r.nome === "colher de sopa")?.status).toBe("descartada");
  });
  expect(onResolvido).toHaveBeenCalled();
});

it("'nenhum destes' descarta todas e resolve", async () => {
  const user = userEvent.setup();
  const onResolvido = vi.fn();
  render(
    <DesambiguarPof foodId={1} foodNome="Feijão" baseUnit="g" onResolvido={onResolvido} />,
    { wrapper: criarWrapper(db) },
  );
  await user.click(await screen.findByRole("button", { name: /nenhum destes/i }));
  await waitFor(async () => {
    const rs = await db.execute("SELECT status FROM food_measures");
    expect(rs.rows.every((r) => r.status === "descartada")).toBe(true);
  });
  expect(onResolvido).toHaveBeenCalled();
});

it("ordena por relevância: o candidato que casa o qualificador da TACO vem antes", async () => {
  await db.execute({
    sql: `INSERT INTO foods (id, nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES (3, 'Carne, bovina, acém', 'taco', 100, 200, 20, 0, 12, ?)`,
    args: [new Date().toISOString()],
  });
  // ordem de inserção (por código) coloca o SUÍNO antes; a relevância tem que
  // subir o BOVINO/ACÉM pra frente mesmo assim.
  await db.executeMultiple(`
    INSERT INTO food_measures (food_id, nome, qty_base, ordem, source, status, pof_codigo, pof_descricao)
      VALUES (3, 'bife', 90, 0, 'pof', 'candidata', 'a1', 'CARNE SUINA · CROZIDO(A)');
    INSERT INTO food_measures (food_id, nome, qty_base, ordem, source, status, pof_codigo, pof_descricao)
      VALUES (3, 'bife', 100, 0, 'pof', 'candidata', 'a2', 'CARNE BOVINA ACEM · CROZIDO(A)');
  `);
  render(
    <DesambiguarPof foodId={3} foodNome="Carne, bovina, acém" baseUnit="g" onResolvido={() => {}} />,
    { wrapper: criarWrapper(db) },
  );
  // espera os candidatos carregarem (query async) antes de ler a ordem do DOM
  await screen.findByText(/CARNE BOVINA ACEM/);
  const candidatos = screen.getAllByRole("button").filter((b) => /CARNE/.test(b.textContent ?? ""));
  // primeiro botão de candidato = o que casa 'bovina' e 'acem', não o suíno
  expect(candidatos[0]).toHaveTextContent(/CARNE BOVINA ACEM/);
  expect(candidatos[1]).toHaveTextContent(/CARNE SUINA/);
});

it("lista longa: mostra 5 e esconde o resto atrás de 'ver todas'", async () => {
  const user = userEvent.setup();
  // 8 candidatos: 5 visíveis + 3 atrás do "ver todas"
  const stmts = Array.from({ length: 8 }, (_, i) =>
    `INSERT INTO food_measures (food_id, nome, qty_base, ordem, source, status, pof_codigo, pof_descricao)
       VALUES (2, 'porcao', ${50 + i}, ${i}, 'pof', 'candidata', 'c${i}', 'CANDIDATO NUMERO ${i}');`,
  ).join("\n");
  await db.execute({
    sql: `INSERT INTO foods (id, nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES (2, 'Carne, bovina', 'taco', 100, 200, 20, 0, 12, ?)`,
    args: [new Date().toISOString()],
  });
  await db.executeMultiple(stmts);

  render(
    <DesambiguarPof foodId={2} foodNome="Carne, bovina" baseUnit="g" onResolvido={() => {}} />,
    { wrapper: criarWrapper(db) },
  );
  await screen.findByText(/CANDIDATO NUMERO 0/);
  // 3 e 4 visíveis (dentro dos 5 primeiros), 5 e 7 escondidos
  expect(screen.getByText(/CANDIDATO NUMERO 4/)).toBeInTheDocument();
  expect(screen.queryByText(/CANDIDATO NUMERO 5/)).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /ver todas as 8/i }));
  expect(screen.getByText(/CANDIDATO NUMERO 7/)).toBeInTheDocument();
});
