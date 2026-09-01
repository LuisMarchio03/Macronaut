import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BlocoCard } from "./bloco-card";
import type { BlocoDoDia, EstadoBloco } from "@/domain/plano-dia";
import type { PlanBlock, PlanItem, TrocaDeItem } from "@/domain/plano-types";

const bloco = (p: Partial<PlanBlock> = {}): PlanBlock => ({
  id: 1,
  plan_id: 1,
  tipo: "refeicao",
  nome: "Almoço",
  hora_inicio: "12:00",
  hora_fim: "13:00",
  ancora: null,
  kcal_alvo: 500,
  ml_alvo: null,
  observacao: null,
  ordem: 0,
  ...p,
});

const item = (id: number, texto: string): PlanItem => ({
  id,
  block_id: 1,
  texto,
  categoria: null,
  food_id: null,
  qty_g: null,
  ordem: id,
});

function montar(
  estado: EstadoBloco,
  overrides: {
    bloco?: Partial<PlanBlock>;
    itens?: PlanItem[];
    aguaNoBloco?: number;
    emFoco?: boolean;
    trocas?: TrocaDeItem[];
    kcalPorItem?: Map<number, number>;
    onMarcar?: (feito: boolean) => void;
    onTrocar?: () => void;
    onAgua?: (ml: number) => void;
  } = {},
) {
  const item2: BlocoDoDia = { bloco: bloco(overrides.bloco), estado, check: null };
  return render(
    <BlocoCard
      item={item2}
      itens={overrides.itens ?? [item(1, "120g de frango"), item(2, "arroz integral")]}
      aguaNoBloco={overrides.aguaNoBloco}
      emFoco={overrides.emFoco}
      trocas={overrides.trocas}
      kcalPorItem={overrides.kcalPorItem}
      onMarcar={overrides.onMarcar ?? (() => {})}
      onTrocar={overrides.onTrocar}
      onAgua={overrides.onAgua}
    />,
  );
}

describe("bloco da vez", () => {
  it("mostra os alimentos e a ação principal", () => {
    montar("agora");
    expect(screen.getByText("120g de frango")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comi" })).toBeInTheDocument();
  });

  it("marca a etapa atual para leitor de tela só quando é o foco", () => {
    // Dois blocos podem estar dentro da janela ao mesmo tempo; "passo atual"
    // é um só, e quem decide qual é a página.
    const semFoco = montar("agora");
    expect(semFoco.container.querySelector('[aria-current="step"]')).toBeNull();
    semFoco.unmount();

    const comFoco = montar("agora", { emFoco: true });
    expect(comFoco.container.querySelector('[aria-current="step"]')).toBeInTheDocument();
  });

  it("avisa quando passou do horário sem depender só da cor", () => {
    montar("atrasado");
    expect(screen.getByText("passou do horário")).toBeInTheDocument();
  });

  it("diz 'Tomei' em suplemento, não 'Comi'", () => {
    montar("agora", { bloco: { tipo: "suplemento", nome: "Creatina" } });
    expect(screen.getByRole("button", { name: "Tomei" })).toBeInTheDocument();
  });
});

describe("blocos que não são o da vez", () => {
  it("não despeja a lista de alimentos na tela", () => {
    // Com todos abertos a tela vira metros de rolagem e nada se destaca.
    montar("proximo");
    expect(screen.queryByText("120g de frango")).toBeNull();
  });

  it("ainda deixa marcar, num alvo com rótulo acessível", () => {
    montar("proximo");
    const botao = screen.getByRole("button", { name: "Marcar Almoço como feito" });
    expect(botao).toHaveAttribute("aria-pressed", "false");
  });

  it("mostra nome, horário e caloria mesmo fechado", () => {
    montar("proximo");
    expect(screen.getByText("Almoço")).toBeInTheDocument();
    expect(screen.getByText("12h – 13h")).toBeInTheDocument();
    expect(screen.getByText("~500 kcal")).toBeInTheDocument();
  });
});

describe("marcar e desmarcar", () => {
  it("chama onMarcar(true) ao tocar em Comi", async () => {
    const onMarcar = vi.fn();
    montar("agora", { onMarcar });
    await userEvent.click(screen.getByRole("button", { name: "Comi" }));
    expect(onMarcar).toHaveBeenCalledWith(true);
  });

  it("chama onMarcar(false) ao desmarcar", async () => {
    const onMarcar = vi.fn();
    montar("feito", { onMarcar });
    await userEvent.click(screen.getByRole("button", { name: "Desmarcar Almoço" }));
    expect(onMarcar).toHaveBeenCalledWith(false);
  });

  it("bloco feito fica com o botão pressionado", () => {
    montar("feito");
    expect(screen.getByRole("button", { name: "Desmarcar Almoço" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("trocar", () => {
  const troca = (item_id: number, nome: string, kcal: number | null = null): TrocaDeItem => ({
    id: item_id, data: "2026-08-31", block_id: 1, item_id, origem: "plano", swap_id: 1,
    nome, porcao: null, kcal, food_id: null, qty_g: null, measure_id: null, medidas: null,
    dispensado: false,
  });

  it("oferece a troca no bloco da vez", async () => {
    const onTrocar = vi.fn();
    montar("agora", { onTrocar });
    await userEvent.click(screen.getByRole("button", { name: /trocar/i }));
    expect(onTrocar).toHaveBeenCalled();
  });

  it("oferece a troca num bloco FORA da janela de horário", async () => {
    // Planejar a substituição do almoço às 9h é o caso comum. Antes o botão
    // só existia enquanto o bloco estava aberto, e o almoço às 9h não está.
    const onTrocar = vi.fn();
    montar("proximo", { onTrocar });
    await userEvent.click(screen.getByRole("button", { name: /trocar em/i }));
    expect(onTrocar).toHaveBeenCalled();
  });

  it("oferece a troca num bloco já feito", async () => {
    // Corrigir a troca de uma refeição marcada exigia desmarcá-la — o caminho
    // se fechava atrás de você.
    const onTrocar = vi.fn();
    montar("feito", { onTrocar });
    await userEvent.click(screen.getByRole("button", { name: /trocar em/i }));
    expect(onTrocar).toHaveBeenCalled();
  });

  it("não oferece troca em bloco sem itens", () => {
    // Um botão que abre uma refeição vazia é pior do que botão nenhum.
    montar("agora", { itens: [], onTrocar: vi.fn() });
    expect(screen.queryByRole("button", { name: /trocar/i })).toBeNull();
  });

  it("mostra o item trocado, com o original riscado", () => {
    montar("agora", { trocas: [troca(1, "Tapioca", 90)] });
    expect(screen.getByText("120g de frango").className).toContain("line-through");
    expect(screen.getByText("Tapioca · 90 kcal")).toBeInTheDocument();
    // O item não trocado continua inteiro.
    expect(screen.getByText("arroz integral").className).not.toContain("line-through");
  });

  it("mais de um item da mesma refeição pode aparecer trocado", () => {
    montar("agora", { trocas: [troca(1, "Tapioca", 90), troca(2, "Batata-doce", 110)] });
    expect(screen.getByText("Tapioca · 90 kcal")).toBeInTheDocument();
    expect(screen.getByText("Batata-doce · 110 kcal")).toBeInTheDocument();
  });
});

describe("bloco de água", () => {
  const agua = { tipo: "agua" as const, nome: "ÁGUA", ml_alvo: 750, kcal_alvo: null };

  it("mostra o progresso do período", () => {
    montar("agora", { bloco: agua, aguaNoBloco: 300, onAgua: vi.fn() });
    expect(screen.getByText("300 / 750 ml")).toBeInTheDocument();
    expect(
      screen.getByLabelText("ÁGUA 12h – 13h: 300 de 750 mililitros"),
    ).toBeInTheDocument();
  });

  it("os botões de gole aparecem só no período da vez", () => {
    // Quatro períodos abertos ao mesmo tempo seriam oito botões competindo.
    montar("proximo", { bloco: agua, onAgua: vi.fn() });
    expect(screen.queryByRole("button", { name: "+200 ml" })).toBeNull();

    montar("agora", { bloco: agua, onAgua: vi.fn() });
    expect(screen.getByRole("button", { name: "+200 ml" })).toBeInTheDocument();
  });

  it("registra o gole no período", async () => {
    const onAgua = vi.fn();
    montar("agora", { bloco: agua, onAgua });
    await userEvent.click(screen.getByRole("button", { name: "+500 ml" }));
    expect(onAgua).toHaveBeenCalledWith(500);
  });

  it("não oferece 'Comi' num bloco de água", () => {
    montar("agora", { bloco: agua, onAgua: vi.fn() });
    expect(screen.queryByRole("button", { name: /^comi$/i })).toBeNull();
  });

  it("período cumprido não vira botão de desmarcar", () => {
    // Água se acompanha por volume; não há o que desmarcar.
    montar("proximo", { bloco: agua, aguaNoBloco: 750 });
    expect(screen.queryByRole("button", { name: /marcar/i })).toBeNull();
  });
});

describe("bloco ancorado a evento", () => {
  it("mostra a âncora no lugar do horário", () => {
    montar("pendente", {
      bloco: {
        tipo: "suplemento",
        nome: "CREATINA",
        hora_inicio: null,
        hora_fim: null,
        ancora: "Após almoço",
        kcal_alvo: null,
      },
    });
    expect(screen.getByText("Após almoço")).toBeInTheDocument();
  });
});

describe("BlocoCard — a caloria depois da troca", () => {
  const t = (item_id: number, nome: string, kcal: number | null): TrocaDeItem => ({
    id: item_id, data: "2026-08-31", block_id: 1, item_id, origem: "catalogo", swap_id: null,
    nome, porcao: null, kcal, food_id: 9, qty_g: 100, measure_id: null, medidas: null,
    dispensado: false,
  });

  it("sem troca, mostra só a meta do plano", () => {
    montar("agora", { trocas: [] });
    expect(screen.getByText("~500 kcal")).toBeInTheDocument();
  });

  it("com troca, mostra o realizado contra a meta", () => {
    montar("agora", {
      trocas: [t(1, "Pão", 380)],
      kcalPorItem: new Map([[2, 100]]),
    });
    expect(screen.getByText("480 / ~500 kcal")).toBeInTheDocument();
  });

  it("estourando a meta, avisa", () => {
    montar("agora", {
      trocas: [t(1, "Lanche", 510)],
      kcalPorItem: new Map([[2, 100]]),
    });
    const alvo = screen.getByText("610 / ~500 kcal");
    expect(alvo.className).toContain("text-warning");
  });

  it("com parcela desconhecida, o número ganha o +", () => {
    montar("agora", {
      trocas: [t(1, "Pão", 380), t(2, "Pão da padaria", null)],
    });
    expect(screen.getByText("380+ / ~500 kcal")).toBeInTheDocument();
  });

  it("a linha dispensada aparece como tal", () => {
    montar("agora", {
      trocas: [{ ...t(1, "", null), dispensado: true }],
      kcalPorItem: new Map([[2, 100]]),
    });
    expect(screen.getByText(/dispensado/i)).toBeInTheDocument();
  });
});
