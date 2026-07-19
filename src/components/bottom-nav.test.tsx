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

it("mostra exatamente 5 abas", () => {
  renderNav("/");
  expect(screen.getAllByRole("link")).toHaveLength(5);
  for (const nome of ["Hoje", "Nutrição", "Treino", "Análise", "Mais"]) {
    expect(screen.getByRole("link", { name: new RegExp(nome, "i") })).toBeInTheDocument();
  }
});

it("não mostra as telas de config na barra", () => {
  renderNav("/");
  expect(screen.queryByRole("link", { name: /alimentos/i })).toBeNull();
  expect(screen.queryByRole("link", { name: /refeições/i })).toBeNull();
  expect(screen.queryByRole("link", { name: /^metas$/i })).toBeNull();
});

it("destaca a aba Mais numa rota-filha (/alimentos)", () => {
  renderNav("/alimentos");
  const mais = screen.getByRole("link", { name: /mais/i });
  expect(mais.className).toContain("text-primary");
});
