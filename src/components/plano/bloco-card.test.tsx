import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BlocoCard } from "./bloco-card";
import type { BlocoDoDia, EstadoBloco } from "@/domain/plano-dia";
import type { PlanBlock, PlanItem } from "@/domain/plano-types";

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
    temTrocas?: boolean;
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
      temTrocas={overrides.temTrocas}
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
  it("oferece a troca quando o plano tem substituições para o bloco", async () => {
    const onTrocar = vi.fn();
    montar("agora", { temTrocas: true, onTrocar });
    await userEvent.click(screen.getByRole("button", { name: /trocar/i }));
    expect(onTrocar).toHaveBeenCalled();
  });

  it("não oferece troca quando o plano não lista nenhuma", () => {
    // Um botão que abre uma lista vazia é pior do que botão nenhum.
    montar("agora", { temTrocas: false, onTrocar: vi.fn() });
    expect(screen.queryByRole("button", { name: /trocar/i })).toBeNull();
  });

  it("não oferece troca num bloco já feito", () => {
    montar("feito", { temTrocas: true, onTrocar: vi.fn() });
    expect(screen.queryByRole("button", { name: /trocar/i })).toBeNull();
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
