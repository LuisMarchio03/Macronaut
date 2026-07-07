import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

it("renderiza o texto do botão", () => {
  render(<Button>Salvar</Button>);
  expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
});
