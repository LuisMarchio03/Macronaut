import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LineChart } from "./line-chart";

it("mostra estado vazio com menos de 2 pontos", () => {
  render(<LineChart pontos={[{ x: "2026-07-06", y: 100 }]} />);
  expect(screen.getByText(/registre mais/i)).toBeInTheDocument();
});

it("desenha uma polyline com 2+ pontos", () => {
  const { container } = render(
    <LineChart pontos={[{ x: "2026-06-30", y: 100 }, { x: "2026-07-06", y: 110 }]} unidade="kg" />,
  );
  expect(container.querySelector("polyline")).toBeInTheDocument();
});
