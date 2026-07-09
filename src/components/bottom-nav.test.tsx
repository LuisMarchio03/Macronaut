import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BottomNav } from "./bottom-nav";

function renderNav(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

it("mostra exatamente 4 abas", () => {
  renderNav("/");
  expect(screen.getAllByRole("link")).toHaveLength(4);
  for (const nome of ["Hoje", "Treino", "Análise", "Ajustes"]) {
    expect(screen.getByRole("link", { name: new RegExp(nome, "i") })).toBeInTheDocument();
  }
});

it("não mostra as telas de config na barra", () => {
  renderNav("/");
  expect(screen.queryByRole("link", { name: /alimentos/i })).toBeNull();
  expect(screen.queryByRole("link", { name: /refeições/i })).toBeNull();
  expect(screen.queryByRole("link", { name: /^metas$/i })).toBeNull();
});

it("destaca a aba Ajustes numa rota-filha (/alimentos)", () => {
  renderNav("/alimentos");
  const ajustes = screen.getByRole("link", { name: /ajustes/i });
  expect(ajustes.className).toContain("text-primary");
});
