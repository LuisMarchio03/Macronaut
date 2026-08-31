import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../../test/helpers/test-db";
import { criarWrapper } from "../../../test/helpers/query-wrapper";
import { SheetTrocas } from "./sheet-trocas";
import type { PlanBlock, PlanItem, PlanSwap, TrocaDeItem } from "@/domain/plano-types";

let db: Client;

beforeEach(async () => {
  db = await createTestDb();
  await db.executeMultiple(`
    INSERT INTO foods (nome, nome_norm, source, base_qty_g, base_unit, kcal, prot_g, carb_g, gord_g, created_at)
      VALUES ('Tapioca goma', 'tapioca goma', 'taco', 100, 'g', 240, 0, 60, 0, '2026-01-01T00:00:00.000Z');
    INSERT INTO food_measures (food_id, nome, qty_base, ordem, source, status, pof_codigo, pof_descricao)
      VALUES (1, 'colher de sopa', 15, 0, 'manual', 'confirmada', NULL, NULL);
  `);
});

const BLOCO: PlanBlock = {
  id: 10, plan_id: 1, tipo: "refeicao", nome: "Café da Manhã",
  hora_inicio: "07:00", hora_fim: "08:00", ancora: null,
  kcal_alvo: 400, ml_alvo: null, observacao: null, ordem: 0,
};

const item = (p: Partial<PlanItem> & { id: number }): PlanItem => ({
  block_id: 10, texto: `Item ${p.id}`, categoria: null,
  food_id: null, qty_g: null, ordem: p.id, ...p,
});

const ITENS = [
  item({ id: 1, texto: "3 ovos mexidos", categoria: "proteina" }),
  item({ id: 2, texto: "1 fatia de pão integral", categoria: "carboidrato" }),
  item({ id: 3, texto: "1 fruta média", categoria: "fruta" }),
];

const swap = (p: Partial<PlanSwap> & { id: number }): PlanSwap => ({
  plan_id: 1, block_nome: "Café da Manhã", categoria: "proteina",
  alimento: `Alimento ${p.id}`, porcao: "100g", qty_g: 100, kcal: 100, food_id: null, ...p,
});

const SWAPS = [
  swap({ id: 1, categoria: "proteina", alimento: "Ovos inteiros", porcao: "3 unidades (150g)", kcal: 210 }),
  swap({ id: 2, categoria: "proteina", alimento: "Queijo cottage", porcao: "60g", kcal: 70 }),
  swap({ id: 3, categoria: "carboidrato", alimento: "Tapioca", porcao: "2 col. sopa (30g)", kcal: 90 }),
  swap({ id: 4, categoria: "carboidrato", alimento: "Aveia", porcao: "3 col. sopa", kcal: 110 }),
  swap({ id: 5, categoria: "fruta", alimento: "Banana", porcao: "1 unidade", kcal: 90 }),
  swap({ id: 6, block_nome: "Janta", categoria: "proteina", alimento: "Peixe branco", kcal: 110 }),
];

const troca = (p: Partial<TrocaDeItem> & { item_id: number }): TrocaDeItem => ({
  id: p.item_id, data: "2026-08-31", block_id: 10, origem: "plano", swap_id: null,
  nome: "Tapioca", porcao: null, kcal: null,
  food_id: null, qty_g: null, measure_id: null, medidas: null, ...p,
});

function montar(props: Partial<Parameters<typeof SheetTrocas>[0]> = {}) {
  const onTrocar = vi.fn();
  const onDesfazer = vi.fn();
  const onMarcar = vi.fn();
  render(
    <SheetTrocas
      bloco={BLOCO}
      itens={ITENS}
      swaps={SWAPS}
      trocas={[]}
      feito={false}
      onTrocar={onTrocar}
      onDesfazer={onDesfazer}
      onMarcar={onMarcar}
      onClose={vi.fn()}
      {...props}
    />,
    { wrapper: criarWrapper(db) },
  );
  return { onTrocar, onDesfazer, onMarcar };
}

describe("SheetTrocas — a refeição", () => {
  it("lista os itens da refeição, não as substituições soltas", () => {
    montar();
    expect(screen.getByText("3 ovos mexidos")).toBeInTheDocument();
    expect(screen.getByText("1 fatia de pão integral")).toBeInTheDocument();
    expect(screen.getByText("1 fruta média")).toBeInTheDocument();
  });

  it("cada item é um alvo de troca", () => {
    montar();
    expect(screen.getByRole("button", { name: /trocar 1 fatia de pão integral/i })).toBeInTheDocument();
  });

  it("mostra o item trocado riscado, com a troca embaixo", () => {
    montar({
      trocas: [troca({ item_id: 2, nome: "Tapioca", porcao: "2 col. sopa (30g)", kcal: 90 })],
    });
    const original = screen.getByText("1 fatia de pão integral");
    expect(original.className).toContain("line-through");
    expect(screen.getByText("Tapioca · 2 col. sopa (30g) · 90 kcal")).toBeInTheDocument();
  });

  it("desfaz a troca de um item", async () => {
    const { onDesfazer } = montar({ trocas: [troca({ item_id: 2 })] });
    await userEvent.click(screen.getByRole("button", { name: /desfazer a troca de 1 fatia/i }));
    expect(onDesfazer).toHaveBeenCalledWith(2);
  });

  it("o desfazer só existe onde há troca", () => {
    montar({ trocas: [troca({ item_id: 2 })] });
    expect(screen.queryByRole("button", { name: /desfazer a troca de 3 ovos/i })).toBeNull();
  });

  it("marca a refeição como feita sem exigir troca nenhuma", async () => {
    // Trocar e comer viraram duas ações: escolher uma substituição não fecha
    // mais a refeição, que era o que impedia trocar a segunda linha.
    const { onMarcar } = montar();
    await userEvent.click(screen.getByRole("button", { name: "Comi" }));
    expect(onMarcar).toHaveBeenCalledWith(true);
  });

  it("refeição já marcada oferece desmarcar", () => {
    montar({ feito: true });
    expect(screen.getByRole("button", { name: "Desmarcar" })).toBeInTheDocument();
  });

  it("diz quais linhas não entram no balanço, e o que fazer", () => {
    // Silêncio pareceria zero. O app não sabe a caloria de "1 fruta média",
    // e o conserto — escolher pelo catálogo — está a um toque.
    montar();
    expect(screen.getAllByText(/não entra no balanço/i)).toHaveLength(3);
  });

  it("linha resolvida para um alimento não recebe o aviso", () => {
    montar({
      itens: [item({ id: 1, texto: "3 ovos", categoria: "proteina", food_id: 1, qty_g: 150 })],
    });
    expect(screen.queryByText(/não entra no balanço/i)).toBeNull();
  });

  it("a troca pelo catálogo tira a linha do aviso", () => {
    montar({
      trocas: [troca({ item_id: 2, origem: "catalogo", nome: "Tapioca goma", food_id: 1, qty_g: 30 })],
    });
    expect(screen.getAllByText(/não entra no balanço/i)).toHaveLength(2);
  });

  it("explica o vazio quando o bloco não tem itens", () => {
    montar({ itens: [] });
    expect(screen.getByText(/não tem itens no seu plano/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /trocar tudo/i })).toBeNull();
  });
});

describe("SheetTrocas — trocar um item", () => {
  it("abre as substituições da categoria do item", async () => {
    montar();
    await userEvent.click(screen.getByRole("button", { name: /trocar 1 fatia de pão integral/i }));

    expect(screen.getByText("Tapioca")).toBeInTheDocument();
    expect(screen.getByText("Aveia")).toBeInTheDocument();
    // Proteína é de outra linha: oferecer aqui seria a troca errada.
    expect(screen.queryByText("Queijo cottage")).toBeNull();
  });

  it("não oferece substituição de outra refeição", async () => {
    montar();
    await userEvent.click(screen.getByRole("button", { name: /trocar 3 ovos mexidos/i }));
    expect(screen.queryByText("Peixe branco")).toBeNull();
  });

  it("ordena as opções por caloria", async () => {
    montar();
    await userEvent.click(screen.getByRole("button", { name: /trocar 1 fatia de pão integral/i }));
    const opcoes = screen.getAllByRole("button").filter((b) => /kcal/.test(b.textContent ?? ""));
    expect(opcoes[0].textContent).toContain("Tapioca");
    expect(opcoes[1].textContent).toContain("Aveia");
  });

  it("escolher uma substituição do plano devolve o swap_id", async () => {
    const { onTrocar } = montar();
    await userEvent.click(screen.getByRole("button", { name: /trocar 1 fatia de pão integral/i }));
    await userEvent.click(screen.getByRole("button", { name: /tapioca/i }));
    expect(onTrocar).toHaveBeenCalledWith(2, { swap_id: 3 });
  });

  it("item sem categoria recebe todas as trocas do bloco", async () => {
    // Não ter categoria não pode virar um beco sem saída: melhor escolher
    // entre opções demais do que não ter caminho.
    montar({ itens: [item({ id: 9, texto: "Café preto" })] });
    await userEvent.click(screen.getByRole("button", { name: /trocar café preto/i }));
    expect(screen.getByText("Queijo cottage")).toBeInTheDocument();
    expect(screen.getByText("Tapioca")).toBeInTheDocument();
  });

  it("diz o que fazer quando o plano não prevê troca para a linha", async () => {
    montar({ itens: [item({ id: 9, texto: "Suplemento X", categoria: "vegetal" })] });
    await userEvent.click(screen.getByRole("button", { name: /trocar suplemento x/i }));
    expect(screen.getByText(/não lista substituição para esta linha/i)).toBeInTheDocument();
  });

  it("volta para a refeição", async () => {
    montar();
    await userEvent.click(screen.getByRole("button", { name: /trocar 3 ovos mexidos/i }));
    await userEvent.click(screen.getByRole("button", { name: /voltar para a refeição/i }));
    expect(screen.getByText("1 fatia de pão integral")).toBeInTheDocument();
  });
});

describe("SheetTrocas — fora da lista do plano", () => {
  it("troca por um alimento do catálogo, com medida caseira e caloria calculada", async () => {
    const user = userEvent.setup();
    const { onTrocar } = montar();
    await user.click(screen.getByRole("button", { name: /trocar 1 fatia de pão integral/i }));
    await user.click(screen.getByRole("tab", { name: "Catálogo" }));

    await user.type(screen.getByLabelText(/alimento/i), "tapioca");
    await user.click(await screen.findByRole("button", { name: /tapioca goma/i }));

    await user.clear(screen.getByLabelText(/quantidade/i));
    await user.type(screen.getByLabelText(/quantidade/i), "2");
    await user.click(screen.getByRole("button", { name: /trocar por tapioca goma/i }));

    // 2 colheres × 15 g = 30 g; 240 kcal/100 g → 72 kcal.
    expect(onTrocar).toHaveBeenCalledWith(2, {
      food_id: 1, qty_g: 30, measure_id: 1, medidas: 2, kcal: 72,
    });
  });

  it("troca por texto livre com caloria", async () => {
    const user = userEvent.setup();
    const { onTrocar } = montar();
    await user.click(screen.getByRole("button", { name: /trocar 3 ovos mexidos/i }));
    await user.click(screen.getByRole("tab", { name: "Escrever" }));

    await user.type(screen.getByLabelText(/o que você comeu/i), "Omelete da padaria");
    await user.type(screen.getByLabelText(/calorias/i), "180");
    await user.click(screen.getByRole("button", { name: /^trocar$/i }));

    expect(onTrocar).toHaveBeenCalledWith(1, { texto: "Omelete da padaria", kcal: 180 });
  });

  it("texto livre sem caloria avisa que não entra no balanço", async () => {
    const user = userEvent.setup();
    const { onTrocar } = montar();
    await user.click(screen.getByRole("button", { name: /trocar 3 ovos mexidos/i }));
    await user.click(screen.getByRole("tab", { name: "Escrever" }));

    expect(screen.getByText(/não entra no balanço do dia/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/o que você comeu/i), "o que tinha");
    await user.click(screen.getByRole("button", { name: /^trocar$/i }));

    expect(onTrocar).toHaveBeenCalledWith(1, { texto: "o que tinha", kcal: null });
  });

  it("não deixa gravar troca escrita sem texto", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /trocar 3 ovos mexidos/i }));
    await user.click(screen.getByRole("tab", { name: "Escrever" }));
    expect(screen.getByRole("button", { name: /^trocar$/i })).toBeDisabled();
  });
});

describe("SheetTrocas — trocar a refeição inteira", () => {
  it("percorre os itens em sequência, contando o passo", async () => {
    const user = userEvent.setup();
    const { onTrocar } = montar();
    await user.click(screen.getByRole("button", { name: /trocar tudo/i }));

    // Item 1 de 3.
    expect(screen.getByText(/item 1 de 3/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /queijo cottage/i }));

    // Confirmar avança sozinho para a linha seguinte.
    expect(screen.getByText(/item 2 de 3/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /tapioca/i }));

    expect(screen.getByText(/item 3 de 3/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /banana/i }));

    // Fim da fila: volta para a refeição.
    expect(screen.getByRole("button", { name: /trocar tudo/i })).toBeInTheDocument();
    expect(onTrocar).toHaveBeenCalledTimes(3);
    expect(onTrocar.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
  });

  it("dá para sair do meio do percurso", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /trocar tudo/i }));
    await user.click(screen.getByRole("button", { name: /voltar para a refeição/i }));
    expect(screen.getByRole("button", { name: /trocar tudo/i })).toBeInTheDocument();
  });
});

describe("SheetTrocas — mais de uma troca na mesma refeição", () => {
  it("duas linhas trocadas aparecem as duas", () => {
    // O bug que abriu esta frente: `plan_checks.swap_id` era uma coluna só, e
    // escolher a segunda troca apagava a primeira.
    montar({
      trocas: [
        troca({ item_id: 2, nome: "Tapioca", kcal: 90 }),
        troca({ item_id: 3, nome: "Banana", kcal: 90 }),
      ],
    });
    const lista = screen.getByRole("list");
    expect(within(lista).getByText("Tapioca · 90 kcal")).toBeInTheDocument();
    expect(within(lista).getByText("Banana · 90 kcal")).toBeInTheDocument();
  });
});
