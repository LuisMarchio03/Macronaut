import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { EditorMedidas } from "./editor-medidas";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Pão', 'custom', 100, 250, 8, 48, 3, ?)`,
    args: [new Date().toISOString()],
  });
});

it("lista as medidas existentes com o peso na unidade base", async () => {
  await db.execute(
    "INSERT INTO food_measures (food_id, nome, qty_base, ordem) VALUES (1, 'fatia', 25, 0)",
  );
  render(<EditorMedidas foodId={1} baseUnit="g" />, { wrapper: criarWrapper(db) });
  expect(await screen.findByText(/fatia/)).toBeInTheDocument();
  expect(screen.getByText(/25 g/)).toBeInTheDocument();
});

it("adiciona uma medida nova", async () => {
  const user = userEvent.setup();
  render(<EditorMedidas foodId={1} baseUnit="g" />, { wrapper: criarWrapper(db) });
  await user.type(screen.getByLabelText(/nome da medida/i), "fatia");
  await user.type(screen.getByLabelText(/equivale a/i), "25");
  await user.click(screen.getByRole("button", { name: /adicionar medida/i }));
  await waitFor(async () => {
    const rs = await db.execute("SELECT nome, qty_base, source FROM food_measures");
    expect(rs.rows).toHaveLength(1);
    expect(rs.rows[0].nome).toBe("fatia");
    expect(rs.rows[0].qty_base).toBe(25);
    expect(rs.rows[0].source).toBe("manual");
  });
});

it("não adiciona medida com peso zero ou negativo", async () => {
  const user = userEvent.setup();
  render(<EditorMedidas foodId={1} baseUnit="g" />, { wrapper: criarWrapper(db) });
  await user.type(screen.getByLabelText(/nome da medida/i), "fatia");
  await user.type(screen.getByLabelText(/equivale a/i), "0");
  expect(screen.getByRole("button", { name: /adicionar medida/i })).toBeDisabled();
});

it("mostra a unidade base correta (ml)", async () => {
  render(<EditorMedidas foodId={1} baseUnit="ml" />, { wrapper: criarWrapper(db) });
  expect(screen.getByLabelText(/equivale a \(ml\)/i)).toBeInTheDocument();
});
