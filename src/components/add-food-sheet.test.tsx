import { it, expect, beforeEach, describe } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { AddFoodSheet } from "./add-food-sheet";
import { createEntry, listEntriesByDate } from "../repositories/entries";
import { getFoodsByIds } from "../repositories/foods";

let db: Client;

// Fixture base: 3 alimentos.
//  - Arroz (id 1): sem medida cadastrada — cobre o fallback "registrar na base".
//  - Pão de forma (id 2): base 100 g + medida 'fatia' = 25 g, já confirmada.
//  - Feijão (id 3): 2 medidas 'candidata' com códigos POF diferentes — ainda
//    não se sabe qual linha da POF é esse alimento (desambiguação pendente).
// meals id=1 é o "café da manhã".
//
// Histórico de uso (pão registrado na refeição) fica de propósito FORA deste
// beforeEach e só entra no describe aninhado abaixo: vários testes aqui usam
// `SELECT ... FROM food_entries` sem WHERE e leem `rows[0]` esperando que seja
// o registro que ELES acabaram de criar. Linhas de histórico inseridas antes,
// no beforeEach, sempre têm rowid menor e viram `rows[0]` num SELECT sem
// ORDER BY — misturar as duas coisas na mesma tabela quebraria esses testes.
beforeEach(async () => {
  db = await createTestDb();
  await db.executeMultiple(`
    INSERT INTO foods (nome, source, base_qty_g, base_unit, kcal, prot_g, carb_g, gord_g, created_at)
      VALUES ('Arroz', 'taco', 100, 'g', 128, 2.5, 28, 0.2, '2026-01-01T00:00:00.000Z');

    INSERT INTO foods (nome, source, base_qty_g, base_unit, kcal, prot_g, carb_g, gord_g, created_at)
      VALUES ('Pão de forma', 'taco', 100, 'g', 265, 9, 49, 3.3, '2026-01-01T00:00:00.000Z');
    INSERT INTO food_measures (food_id, nome, qty_base, ordem, source, status, pof_codigo, pof_descricao)
      VALUES (2, 'fatia', 25, 0, 'manual', 'confirmada', NULL, NULL);

    INSERT INTO foods (nome, source, base_qty_g, base_unit, kcal, prot_g, carb_g, gord_g, created_at)
      VALUES ('Feijão', 'taco', 100, 'g', 76, 4.8, 13.6, 0.5, '2026-01-01T00:00:00.000Z');
    INSERT INTO food_measures (food_id, nome, qty_base, ordem, source, status, pof_codigo, pof_descricao)
      VALUES (3, 'concha', 140, 0, 'pof', 'candidata', '301', 'FEIJAO CARIOCA · CROZIDO(A)');
    INSERT INTO food_measures (food_id, nome, qty_base, ordem, source, status, pof_codigo, pof_descricao)
      VALUES (3, 'colher de sopa', 35, 1, 'pof', 'candidata', '302', 'FEIJAO TROPEIRO · CROZIDO(A)');

    INSERT INTO meals (id, user_id, nome, horario, ordem) VALUES (1, 1, 'Café da manhã', '07:00', 0);
  `);
});

it("busca alimento, informa quantidade e registra", async () => {
  const user = userEvent.setup();
  render(<AddFoodSheet data="2026-07-06" mealId={null} open onClose={() => {}} />, {
    wrapper: criarWrapper(db),
  });
  await user.type(screen.getByPlaceholderText(/buscar/i), "arroz");
  await user.click(await screen.findByText("Arroz"));
  await user.clear(screen.getByLabelText(/quantidade/i));
  await user.type(screen.getByLabelText(/quantidade/i), "150");
  await user.click(screen.getByRole("button", { name: /^adicionar$/i }));

  await waitFor(async () =>
    expect(await listEntriesByDate(db, 1, "2026-07-06")).toHaveLength(1),
  );
});

it("modo edição: salvar altera a quantidade do entry", async () => {
  const entry = await createEntry(db, 1, {
    data: "2026-07-06", meal_id: null, food_id: 1, qty_g: 100,
    measure_id: null, measure_count: null, label: null,
  });
  const food = (await getFoodsByIds(db, [1])).get(1)!;

  render(
    <AddFoodSheet data="2026-07-06" mealId={null} open onClose={() => {}} entryEdit={{ entry, food }} />,
    { wrapper: criarWrapper(db) },
  );

  const input = await screen.findByLabelText(/quantidade/i);
  await userEvent.clear(input);
  await userEvent.type(input, "250");
  await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

  await waitFor(async () => {
    expect((await listEntriesByDate(db, 1, "2026-07-06"))[0].qty_g).toBe(250);
  });
});

// Editar um registro que TEM medida: a medida sobrevive ao save. Sem a fiação
// de measure_id/measure_count no useUpdateEntry, "2 fatias" viraria grama nua
// ao editar a quantidade. (O teste acima usa Arroz sem medida e não pegaria.)
it("modo edição: editar um registro com medida preserva a medida", async () => {
  // Pão de forma (id 2) tem a medida 'fatia'=25g. Registro inicial: 2 fatias.
  const fatia = (await db.execute("SELECT id FROM food_measures WHERE nome='fatia' AND food_id=2")).rows[0].id as number;
  const entry = await createEntry(db, 1, {
    data: "2026-07-06", meal_id: null, food_id: 2, qty_g: 50,
    measure_id: fatia, measure_count: 2, label: null,
  });
  const food = (await getFoodsByIds(db, [2])).get(2)!;

  render(
    <AddFoodSheet data="2026-07-06" mealId={null} open onClose={() => {}} entryEdit={{ entry, food }} />,
    { wrapper: criarWrapper(db) },
  );

  // abre mostrando "2" (contagem de fatias), não "50"
  const input = await screen.findByDisplayValue("2");
  await userEvent.clear(input);
  await userEvent.type(input, "3"); // vira 3 fatias
  await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

  await waitFor(async () => {
    const e = (await listEntriesByDate(db, 1, "2026-07-06"))[0];
    expect(e.measure_id).toBe(fatia);      // a medida NÃO virou null
    expect(e.measure_count).toBe(3);
    expect(e.qty_g).toBe(75);              // 25 × 3
  });
});

it("quantidade abre em '1 fatia', não em 100", async () => {
  const user = userEvent.setup();
  render(<AddFoodSheet data="2026-07-17" mealId={1} open onClose={() => {}} />, {
    wrapper: criarWrapper(db),
  });
  await user.type(screen.getByPlaceholderText(/buscar/i), "pão");
  await user.click(await screen.findByRole("button", { name: /Pão de forma ·/ }));
  expect(await screen.findByDisplayValue("1")).toBeInTheDocument();
  // A opção selecionada mostra "fatia" (o texto que o usuário vê). O value do
  // select é o id da medida, não o nome — robusto a nomes de medida repetidos.
  const select = screen.getByRole("combobox", { name: /medida/i }) as HTMLSelectElement;
  expect(select.selectedOptions[0].textContent).toBe("fatia");
});

it("registrar 2 fatias grava qty_g=50 e a medida", async () => {
  const user = userEvent.setup();
  render(<AddFoodSheet data="2026-07-17" mealId={1} open onClose={() => {}} />, {
    wrapper: criarWrapper(db),
  });
  await user.type(screen.getByPlaceholderText(/buscar/i), "pão");
  await user.click(await screen.findByRole("button", { name: /Pão de forma ·/ }));
  const qtd = screen.getByLabelText(/quantidade/i);
  await user.clear(qtd);
  await user.type(qtd, "2");
  await user.click(screen.getByRole("button", { name: /^adicionar$/i }));
  await waitFor(async () => {
    const rs = await db.execute("SELECT qty_g, measure_count FROM food_entries");
    expect(rs.rows[0].qty_g).toBe(50);
    expect(rs.rows[0].measure_count).toBe(2);
  });
});

it("toggle para grama registra sem medida", async () => {
  const user = userEvent.setup();
  render(<AddFoodSheet data="2026-07-17" mealId={1} open onClose={() => {}} />, {
    wrapper: criarWrapper(db),
  });
  await user.type(screen.getByPlaceholderText(/buscar/i), "pão");
  await user.click(await screen.findByRole("button", { name: /Pão de forma ·/ }));
  await user.selectOptions(screen.getByRole("combobox", { name: /medida/i }), "__base__");
  const qtd = screen.getByLabelText(/quantidade/i);
  await user.clear(qtd);
  await user.type(qtd, "30");
  await user.click(screen.getByRole("button", { name: /^adicionar$/i }));
  await waitFor(async () => {
    const rs = await db.execute("SELECT qty_g, measure_id FROM food_entries");
    expect(rs.rows[0].qty_g).toBe(30);
    expect(rs.rows[0].measure_id).toBeNull();
  });
});

it("alimento com candidatas pede desambiguação antes da quantidade", async () => {
  const user = userEvent.setup();
  render(<AddFoodSheet data="2026-07-17" mealId={1} open onClose={() => {}} />, {
    wrapper: criarWrapper(db),
  });
  await user.type(screen.getByPlaceholderText(/buscar/i), "feijão");
  await user.click(await screen.findByRole("button", { name: /Feijão ·/ }));
  expect(await screen.findByText(/qual destes/i)).toBeInTheDocument();
});

it("aceita meia fatia (0,5)", async () => {
  const user = userEvent.setup();
  render(<AddFoodSheet data="2026-07-17" mealId={1} open onClose={() => {}} />, {
    wrapper: criarWrapper(db),
  });
  await user.type(screen.getByPlaceholderText(/buscar/i), "pão");
  await user.click(await screen.findByRole("button", { name: /Pão de forma ·/ }));
  const qtd = screen.getByLabelText(/quantidade/i);
  await user.clear(qtd);
  await user.type(qtd, "0.5");
  await user.click(screen.getByRole("button", { name: /^adicionar$/i }));
  await waitFor(async () => {
    const rs = await db.execute("SELECT qty_g FROM food_entries");
    expect(rs.rows[0].qty_g).toBe(12.5);
  });
});

describe("com histórico de uso na refeição", () => {
  // Pão registrado 3x no café (meal_id=1), sempre "2 fatias" (50 g): dá
  // frequência (D6, 2 toques) e uma porção default determinística pro botão
  // [+]. Isolado num describe aninhado — ver nota no beforeEach externo.
  beforeEach(async () => {
    await db.executeMultiple(`
      INSERT INTO food_entries (user_id, data, meal_id, food_id, qty_g, measure_id, measure_count, label, created_at)
        VALUES (1, '2026-06-20', 1, 2, 50, 1, 2, NULL, '2026-06-20T08:00:00.000Z');
      INSERT INTO food_entries (user_id, data, meal_id, food_id, qty_g, measure_id, measure_count, label, created_at)
        VALUES (1, '2026-07-01', 1, 2, 50, 1, 2, NULL, '2026-07-01T08:00:00.000Z');
      INSERT INTO food_entries (user_id, data, meal_id, food_id, qty_g, measure_id, measure_count, label, created_at)
        VALUES (1, '2026-07-10', 1, 2, 50, 1, 2, NULL, '2026-07-10T08:00:00.000Z');
    `);
  });

  it("abre com frequentes da refeição, sem digitar nada", async () => {
    render(<AddFoodSheet data="2026-07-17" mealId={1} open onClose={() => {}} />, {
      wrapper: criarWrapper(db),
    });
    expect(await screen.findByText(/frequentes/i)).toBeInTheDocument();
    expect(screen.getByText("Pão de forma")).toBeInTheDocument();
  });

  it("[+] no frequente registra a porção sugerida em 1 toque", async () => {
    const user = userEvent.setup();
    render(<AddFoodSheet data="2026-07-17" mealId={1} open onClose={() => {}} />, {
      wrapper: criarWrapper(db),
    });
    await user.click(await screen.findByRole("button", { name: /adicionar pão de forma/i }));
    await waitFor(async () => {
      const rs = await db.execute("SELECT qty_g, measure_count FROM food_entries WHERE data='2026-07-17'");
      expect(rs.rows).toHaveLength(1);
      expect(rs.rows[0].measure_count).toBe(2);
      expect(rs.rows[0].qty_g).toBe(50);
    });
  });
});
