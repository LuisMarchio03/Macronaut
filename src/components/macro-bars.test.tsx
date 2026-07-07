import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MacroBars } from "./macro-bars";

it("mostra consumido/meta de cada macro", () => {
  render(<MacroBars
    consumido={{ kcal: 0, prot_g: 80, carb_g: 100, gord_g: 20 }}
    meta={{ kcal: 0, prot_g: 160, carb_g: 200, gord_g: 55 }} />);
  expect(screen.getByText(/80.*\/.*160/)).toBeInTheDocument();
});
