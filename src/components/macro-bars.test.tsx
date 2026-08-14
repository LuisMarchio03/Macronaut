import { it, expect, describe } from "vitest";
import { render, screen } from "@testing-library/react";
import { MacroBars } from "./macro-bars";

const render3 = (consumido: [number, number, number], meta: [number, number, number]) =>
  render(
    <MacroBars
      consumido={{ kcal: 0, prot_g: consumido[0], carb_g: consumido[1], gord_g: consumido[2] }}
      meta={{ kcal: 0, prot_g: meta[0], carb_g: meta[1], gord_g: meta[2] }}
    />,
  );

it("mostra consumido/meta de cada macro", () => {
  render3([80, 100, 20], [160, 200, 55]);
  expect(screen.getByLabelText("Proteína: 80 de 160 gramas")).toBeInTheDocument();
  expect(screen.getByLabelText("Carboidrato: 100 de 200 gramas")).toBeInTheDocument();
  expect(screen.getByLabelText("Gordura: 20 de 55 gramas")).toBeInTheDocument();
});

describe("nome e valor não colidem", () => {
  it("mantém nome e número como textos separados e legíveis", () => {
    // Antes o nome e o valor ficavam no mesmo eixo sem folga e "Carboidrato"
    // encostava em "47 / 160 g", virando "CARBOIDRATO47 / 160 g".
    render3([47, 47, 5], [150, 160, 50]);
    expect(screen.getByText("Carboidrato")).toBeInTheDocument();
    expect(screen.queryByText(/Carboidrato\d/)).toBeNull();
  });
});

describe("meta estourada", () => {
  it("avisa quanto passou em vez de mostrar barra cheia como se fosse sucesso", () => {
    render3([0, 0, 70], [150, 160, 50]);
    expect(screen.getByText("20 g acima da meta")).toBeInTheDocument();
  });

  it("não avisa quando está dentro da meta", () => {
    render3([0, 0, 50], [150, 160, 50]);
    expect(screen.queryByText(/acima da meta/)).toBeNull();
  });

  it("não estoura a largura da barra além de 100%", () => {
    render3([300, 0, 0], [150, 160, 50]);
    const barra = screen.getByLabelText("Proteína: 300 de 150 gramas");
    expect((barra.firstElementChild as HTMLElement).style.width).toBe("100%");
  });
});

it("não divide por zero quando a meta é zero", () => {
  render3([10, 0, 0], [0, 0, 0]);
  const barra = screen.getByLabelText("Proteína: 10 de 0 gramas");
  expect((barra.firstElementChild as HTMLElement).style.width).toBe("0%");
});
