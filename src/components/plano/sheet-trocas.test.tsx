import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  food_id: null, qty_g: null, measure_id: null, medidas: null, dispensado: false, ...p,
});

function montar(props: Partial<Parameters<typeof SheetTrocas>[0]> = {}) {
  const onTrocar = vi.fn();
  const onAdicionar = vi.fn();
  const onRemoverUma = vi.fn();
  const onDispensar = vi.fn();
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
      onAdicionar={onAdicionar}
      onRemoverUma={onRemoverUma}
      onDispensar={onDispensar}
      onDesfazer={onDesfazer}
      onMarcar={onMarcar}
      onClose={vi.fn()}
      {...props}
    />,
    { wrapper: criarWrapper(db) },
  );
  return { onTrocar, onAdicionar, onRemoverUma, onDispensar, onDesfazer, onMarcar };
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
    await userEvent.click(screen.getByRole("button", { name: /devolver 1 fatia de pão integral ao plano/i }));
    expect(onDesfazer).toHaveBeenCalledWith(2);
  });

  it("o devolver ao plano só existe onde a linha foi mexida", () => {
    montar({ trocas: [troca({ item_id: 2 })] });
    expect(screen.queryByRole("button", { name: /devolver 3 ovos mexidos ao plano/i })).toBeNull();
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
    const { onAdicionar } = montar();
    await user.click(screen.getByRole("button", { name: /trocar 1 fatia de pão integral/i }));
    await user.click(screen.getByRole("tab", { name: "Catálogo" }));

    await user.type(screen.getByLabelText(/alimento/i), "tapioca");
    await user.click(await screen.findByRole("button", { name: /tapioca goma/i }));

    // Espera a sugestão de porção chegar antes de limpar: as medidas vêm do
    // servidor, e limpar um campo que ainda vai ser preenchido faz o dígito
    // digitado virar sufixo da sugestão.
    const qtd = screen.getByLabelText(/quantidade/i);
    await waitFor(() => expect(qtd).toHaveValue("1"));
    await user.clear(qtd);
    await user.type(qtd, "2");
    await user.click(screen.getByRole("button", { name: /trocar por tapioca goma/i }));

    // 2 colheres × 15 g = 30 g; 240 kcal/100 g → 72 kcal.
    expect(onAdicionar).toHaveBeenCalledWith(2, {
      food_id: 1, qty_g: 30, measure_id: 1, medidas: 2, kcal: 72,
    });
  });

  it("troca por texto livre com caloria", async () => {
    const user = userEvent.setup();
    const { onAdicionar } = montar();
    await user.click(screen.getByRole("button", { name: /trocar 3 ovos mexidos/i }));
    await user.click(screen.getByRole("tab", { name: "Escrever" }));

    await user.type(screen.getByLabelText(/o que você comeu/i), "Omelete da padaria");
    await user.type(screen.getByLabelText(/calorias/i), "180");
    await user.click(screen.getByRole("button", { name: /^trocar$/i }));

    expect(onAdicionar).toHaveBeenCalledWith(1, { texto: "Omelete da padaria", kcal: 180 });
  });

  it("texto livre sem caloria avisa que não entra no balanço", async () => {
    const user = userEvent.setup();
    const { onAdicionar } = montar();
    await user.click(screen.getByRole("button", { name: /trocar 3 ovos mexidos/i }));
    await user.click(screen.getByRole("tab", { name: "Escrever" }));

    expect(screen.getByText(/não entra no balanço do dia/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/o que você comeu/i), "o que tinha");
    await user.click(screen.getByRole("button", { name: /^trocar$/i }));

    expect(onAdicionar).toHaveBeenCalledWith(1, { texto: "o que tinha", kcal: null });
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

    // Item 1 de 3. Confirmar NÃO avança: a linha ainda pode receber um
    // segundo alimento, e quem terminou toca em "Próximo item".
    expect(screen.getByText(/item 1 de 3/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /queijo cottage/i }));
    expect(screen.getByText(/item 1 de 3/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /próximo item/i }));
    expect(screen.getByText(/item 2 de 3/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /tapioca/i }));

    await user.click(screen.getByRole("button", { name: /próximo item/i }));
    expect(screen.getByText(/item 3 de 3/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /banana/i }));

    // A última linha não oferece "próximo": sair é o botão de voltar.
    expect(screen.queryByRole("button", { name: /próximo item/i })).not.toBeInTheDocument();
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

describe("SheetTrocas — o estado da folha de nível 2", () => {
  /**
   * O bug: `TrocarItem` não remontava entre um item e o seguinte, então o
   * alimento escolhido para a linha 1 continuava carregado na linha 2 — com o
   * botão "Trocar por X" já pronto. Quem percorria a refeição tocava nele e
   * acabava com o MESMO alimento em todas as linhas.
   */
  it("percorrendo a refeição, o item seguinte não herda o alimento do anterior", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: /trocar tudo/i }));
    await user.click(screen.getByRole("tab", { name: "Catálogo" }));
    await user.type(screen.getByLabelText(/alimento/i), "tapioca");
    await user.click(await screen.findByRole("button", { name: /tapioca goma/i }));

    const qtd = screen.getByLabelText(/quantidade/i);
    await waitFor(() => expect(qtd).toHaveValue("1"));
    await user.click(screen.getByRole("button", { name: /adicionar tapioca goma|trocar por tapioca goma/i }));
    await user.click(await screen.findByRole("button", { name: /próximo item/i }));

    // Já no item 2: nada do item 1 pode ter sobrado.
    expect(await screen.findByText(/item 2 de 3/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /trocar por tapioca goma/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/alimento/i)).toHaveValue("");
  });

  /**
   * Zerar o alimento entre um item e o seguinte é o conserto; zerar a ABA
   * seria um atrito novo. Quem está trocando a refeição inteira pelo catálogo
   * teria que escolher "Catálogo" em cada uma das cinco linhas.
   */
  it("percorrendo, a aba escolhida acompanha o item seguinte", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: /trocar tudo/i }));
    await user.click(screen.getByRole("tab", { name: "Catálogo" }));
    await user.type(screen.getByLabelText(/alimento/i), "tapioca");
    await user.click(await screen.findByRole("button", { name: /tapioca goma/i }));

    const qtd = screen.getByLabelText(/quantidade/i);
    await waitFor(() => expect(qtd).toHaveValue("1"));
    await user.click(screen.getByRole("button", { name: /adicionar tapioca goma|trocar por tapioca goma/i }));
    await user.click(await screen.findByRole("button", { name: /próximo item/i }));

    expect(await screen.findByText(/item 2 de 3/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Catálogo" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(/alimento/i)).toBeInTheDocument();
  });

  /**
   * O bug: reabrir uma linha já trocada pelo catálogo abria a aba "Catálogo"
   * — porque a aba lê `trocaAtual.origem` — mas o alimento, a quantidade e a
   * medida não eram reidratados. A pessoa via a aba certa, um campo vazio e
   * NENHUM botão de confirmar. É o "o botão de trocar não funciona".
   */
  it("reabrir uma troca de catálogo traz o alimento de volta, com botão", async () => {
    const user = userEvent.setup();
    montar({
      trocas: [
        troca({
          item_id: 2, origem: "catalogo", nome: "Tapioca goma", porcao: "30 g",
          kcal: 72, food_id: 1, qty_g: 30, measure_id: 1, medidas: 2,
        }),
      ],
    });

    await user.click(screen.getByRole("button", { name: /trocar 1 fatia de pão integral/i }));

    expect(
      await screen.findByRole("button", { name: /adicionar tapioca goma/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/quantidade/i)).toHaveValue("2");
  });
});

describe("SheetTrocas — mais de um alimento por linha", () => {
  it("com uma escolha feita, o botão do catálogo passa a dizer Adicionar", async () => {
    const user = userEvent.setup();
    montar({
      trocas: [troca({ id: 91, item_id: 2, origem: "catalogo", nome: "Tapioca goma", food_id: 1, qty_g: 30, kcal: 72, medidas: 2, measure_id: 1 })],
    });
    await user.click(screen.getByRole("button", { name: /trocar 1 fatia de pão integral/i }));
    await user.click(screen.getByRole("tab", { name: "Catálogo" }));

    expect(await screen.findByRole("button", { name: /^adicionar tapioca goma$/i })).toBeInTheDocument();
  });

  it("escolher no catálogo ACRESCENTA, não substitui", async () => {
    const user = userEvent.setup();
    const { onAdicionar } = montar();
    await user.click(screen.getByRole("button", { name: /trocar 1 fatia de pão integral/i }));
    await user.click(screen.getByRole("tab", { name: "Catálogo" }));
    await user.type(screen.getByLabelText(/alimento/i), "tapioca");
    await user.click(await screen.findByRole("button", { name: /tapioca goma/i }));
    const qtd = screen.getByLabelText(/quantidade/i);
    await waitFor(() => expect(qtd).toHaveValue("1"));
    await user.click(screen.getByRole("button", { name: /trocar por tapioca goma/i }));

    expect(onAdicionar).toHaveBeenCalledWith(2, {
      food_id: 1, qty_g: 15, measure_id: 1, medidas: 1, kcal: 36,
    });
  });

  it("as escolhas já feitas aparecem na folha da linha, com o × de cada uma", async () => {
    const user = userEvent.setup();
    const { onRemoverUma } = montar({
      trocas: [
        troca({ id: 91, item_id: 2, nome: "Pão na chapa", kcal: 210 }),
        troca({ id: 92, item_id: 2, nome: "Suco de laranja", kcal: 90 }),
      ],
    });
    await user.click(screen.getByRole("button", { name: /trocar 1 fatia de pão integral/i }));

    await user.click(await screen.findByRole("button", { name: /remover suco de laranja/i }));
    expect(onRemoverUma).toHaveBeenCalledWith(92);
  });

  it("a refeição empilha as N trocas sob o item riscado", () => {
    montar({
      trocas: [
        troca({ id: 91, item_id: 2, nome: "Pão na chapa", kcal: 210 }),
        troca({ id: 92, item_id: 2, nome: "Suco de laranja", kcal: 90 }),
      ],
    });
    expect(screen.getByText("Pão na chapa · 210 kcal")).toBeInTheDocument();
    expect(screen.getByText("Suco de laranja · 90 kcal")).toBeInTheDocument();
  });

  it("dispensar a linha avisa quem monta a tela", async () => {
    const user = userEvent.setup();
    const { onDispensar } = montar();
    await user.click(screen.getByRole("button", { name: /trocar 3 ovos mexidos/i }));
    await user.click(screen.getByRole("button", { name: /não comi esta linha/i }));
    expect(onDispensar).toHaveBeenCalledWith(1);
  });

  it("linha dispensada aparece como tal, e dá para voltar ao plano", async () => {
    const user = userEvent.setup();
    const { onDesfazer } = montar({
      trocas: [troca({ id: 93, item_id: 1, dispensado: true, nome: "" })],
    });
    expect(screen.getByText(/^dispensado$/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /trocar 3 ovos mexidos/i }));
    await user.click(await screen.findByRole("button", { name: /voltar ao plano/i }));
    expect(onDesfazer).toHaveBeenCalledWith(1);
  });

  it("confirmar não avança sozinho: a linha pode receber outro alimento", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /trocar tudo/i }));
    await user.click(screen.getByRole("tab", { name: "Catálogo" }));
    await user.type(screen.getByLabelText(/alimento/i), "tapioca");
    await user.click(await screen.findByRole("button", { name: /tapioca goma/i }));
    const qtd = screen.getByLabelText(/quantidade/i);
    await waitFor(() => expect(qtd).toHaveValue("1"));
    await user.click(screen.getByRole("button", { name: /trocar por tapioca goma/i }));

    // Continua no item 1, e o caminho para o próximo é explícito.
    expect(screen.getByText(/item 1 de 3/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /próximo item/i })).toBeInTheDocument();
  });
});
